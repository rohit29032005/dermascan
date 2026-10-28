import os
import tempfile
import uuid
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, Form
from dotenv import load_dotenv

from app.utils.auth_dependency import get_current_user
from app.services.firebase_service import db
from app.services.ml_service import predict_image, extract_features, label_names
from app.services.vector_service import store_vector, search_similar
from app.utils.image_hash import generate_hash
from app.services.gradcam_service import generate_heatmap
import cloudinary.uploader

load_dotenv()

router = APIRouter()

DISEASE_METADATA = {
    'akiec': {
        'name': 'Actinic Keratosis',
        'full_name': 'Actinic Keratoses and Intraepithelial Carcinoma',
        'type': 'Pre-cancerous / Malignant',
        'severity_desc': 'Early stage pre-cancerous lesion requiring clinical dermoscopy evaluation.'
    },
    'bcc': {
        'name': 'Basal Cell Carcinoma',
        'full_name': 'Basal Cell Carcinoma',
        'type': 'Malignant (Common)',
        'severity_desc': 'Most common form of skin cancer. Highly treatable when diagnosed early.'
    },
    'bkl': {
        'name': 'Benign Keratosis',
        'full_name': 'Benign Keratosis-like Lesions',
        'type': 'Benign',
        'severity_desc': 'Non-cancerous skin growth (seborrheic keratosis, solar lentigo).'
    },
    'df': {
        'name': 'Dermatofibroma',
        'full_name': 'Dermatofibroma',
        'type': 'Benign',
        'severity_desc': 'Common benign cutaneous firm nodule.'
    },
    'mel': {
        'name': 'Melanoma',
        'full_name': 'Malignant Melanoma',
        'type': 'High Risk Malignant',
        'severity_desc': 'Serious form of skin cancer that develops in melanocytes. Urgent dermatologist evaluation advised.'
    },
    'nv': {
        'name': 'Melanocytic Nevus (Mole)',
        'full_name': 'Melanocytic Nevi',
        'type': 'Benign',
        'severity_desc': 'Common, usually benign mole or collection of pigment-producing cells.'
    },
    'vasc': {
        'name': 'Vascular Lesion',
        'full_name': 'Vascular Lesions',
        'type': 'Benign',
        'severity_desc': 'Benign blood vessel anomaly (angioma, pyogenic granuloma).'
    }
}

@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    chat_id: str = Form(...),
    questionnaire: str = Form(None),
    user_id: str = Depends(get_current_user)
):
    temp_path = None
    try:
        import json
        q_data = {}
        if questionnaire:
            q_data = json.loads(questionnaire)

        # 1. Read file bytes
        file_bytes = await file.read()

        # 2. Duplicate check using hash
        hash_value = generate_hash(file_bytes)
        
        # 3. Save temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            tmp.write(file_bytes)
            temp_path = tmp.name

        # 4. ML Prediction
        disease, confidence = predict_image(temp_path)

        # 5. Heatmap Generation
        heatmap_url = None
        try:
            try:
                predicted_idx = label_names.index(disease)
            except ValueError:
                predicted_idx = 0
            heatmap_url = generate_heatmap(temp_path, predicted_idx, user_id=user_id, chat_id=chat_id)
        except Exception as heat_err:
            print(f"[GradCAM Warning] Failed to generate heatmap (continuing analysis): {heat_err}")

        # 6. Feature Extraction (Vector)
        vector = extract_features(temp_path)

        # 7. Upload Original Image to Cloudinary
        folder_path = f"derma_uploads/{user_id}/{chat_id}"
        upload_result = cloudinary.uploader.upload(
            temp_path,
            folder=folder_path,
            public_id=f"image_{uuid.uuid4().hex}"
        )
        secure_url = upload_result.get("secure_url")

        # 8. Compute Severity if Questionnaire is provided
        severity_score = None
        # 8. Compute Severity if Questionnaire is provided
        severity_score = None
        if q_data and 'painScale' in q_data:
            conf = float(confidence)
            rule_score = int(q_data.get('painScale', 0)) * 20 
            severity_score = (conf * 0.6) + (rule_score * 0.4)

        inserted_id = str(uuid.uuid4())

        # 9. Search similar vectors BEFORE storing new vector to get genuine historical matches
        similar_cases = search_similar(vector, limit=5, exclude_image_id=inserted_id)

        # Hydrate similar cases with image URLs and verification status from Firestore if missing
        for sc in similar_cases:
            if not sc.get("image_url") and sc.get("image_id"):
                try:
                    doc = db.collection("dataset_images").document(sc["image_id"]).get()
                    if doc.exists:
                        d_dict = doc.to_dict() or {}
                        sc["image_url"] = d_dict.get("image_url")
                        if not sc.get("disease"):
                            sc["disease"] = d_dict.get("prediction") or d_dict.get("verified_label")
                        if "is_verified" not in sc or not sc.get("is_verified"):
                            sc["is_verified"] = d_dict.get("is_verified", False)
                except Exception as sc_err:
                    print(f"[Similar Case Hydration Warning] {sc_err}")

        # 10. Store vector in Qdrant with complete payload
        store_vector(
            image_id=inserted_id,
            vector=vector,
            payload={
                "disease": disease,
                "confidence": confidence,
                "user_id": user_id,
                "image_url": secure_url,
                "is_verified": False,
                "source": "user",
                "created_at": datetime.utcnow().isoformat()
            }
        )

        # 11. Store metadata in dataset_images collection for training pipeline
        try:
            db.collection("dataset_images").document(inserted_id).set({
                "image_url": secure_url,
                "heatmap_url": heatmap_url,
                "prediction": disease,
                "confidence": confidence,
                "verified_label": None,
                "is_verified": False,
                "reviewed_by": None,
                "reviewed_at": None,
                "used_for_training": False,
                "created_at": datetime.utcnow()
            })
        except Exception as e:
            print(f"[Firestore dataset_images Error] {str(e)}")

        # 12. Calculate Similar Cases Reported Statistics
        from app.services.vector_service import count_similar_cases
        firestore_disease_count = 0
        firestore_verified_count = 0
        total_firestore_cases = 0

        try:
            for d in db.collection("dataset_images").stream():
                total_firestore_cases += 1
                d_val = d.to_dict() or {}
                pred = d_val.get("prediction") or d_val.get("verified_label")
                if pred and str(pred).lower() == str(disease).lower():
                    firestore_disease_count += 1
                    if d_val.get("is_verified"):
                        firestore_verified_count += 1
        except Exception as fe:
            print(f"[Firestore Count Warning] {fe}")

        qdrant_disease_count = count_similar_cases(disease)
        qdrant_total_count = count_similar_cases()

        # Both counts include the newly added current case
        similar_cases_reported = max(firestore_disease_count, qdrant_disease_count, 1)
        total_platform_cases = max(total_firestore_cases, qdrant_total_count, 1)
        verified_cases_reported = firestore_verified_count

        disease_info = DISEASE_METADATA.get(disease.lower(), {
            "name": disease.upper(),
            "full_name": disease.upper(),
            "type": "Clinical Lesion",
            "severity_desc": "Clinical dermatological screening condition."
        })

        # Cleanup temp file
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

        formatted_similar_cases = [
            {
                "score": case.get("score"),
                "similarity": case.get("similarity", case.get("score")),
                "image_id": case.get("image_id"),
                "disease": case.get("disease", "Unknown"),
                "disease_name": DISEASE_METADATA.get(str(case.get("disease", "")).lower(), {}).get("name", str(case.get("disease", "Unknown")).upper()),
                "confidence": case.get("confidence"),
                "image_url": case.get("image_url"),
                "is_verified": case.get("is_verified", False),
                "source": case.get("source", "user")
            }
            for case in similar_cases
        ]

        return {
            "message": "Image uploaded & predicted successfully",
            "prediction": disease,
            "disease_name": disease_info.get("name"),
            "disease_full_name": disease_info.get("full_name"),
            "disease_type": disease_info.get("type"),
            "clinical_notes": disease_info.get("severity_desc"),
            "confidence": f"{confidence:.2f}%",
            "confidence_value": float(confidence),
            "severity": severity_score,
            "image_url": secure_url,
            "heatmap_url": heatmap_url,
            "similar_cases_reported": similar_cases_reported,
            "similar_cases_found": len(formatted_similar_cases),
            "verified_cases_reported": verified_cases_reported,
            "total_platform_cases": total_platform_cases,
            "similar_cases": formatted_similar_cases,
            "imageId": inserted_id
        }

    except Exception as e:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
        print(f"[Upload Error] {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {str(e)}"
        )


@router.get("/similar-cases-report")
async def get_similar_cases_report(
    disease: str = None,
    image_id: str = None,
    user_id: str = Depends(get_current_user)
):
    """
    Retrieve clinical similar case report and historical statistics for a given disease condition.
    """
    try:
        from app.services.vector_service import count_similar_cases

        disease_clean = disease.lower() if disease else None
        
        q_count = count_similar_cases(disease_clean) if disease_clean else count_similar_cases()
        total_q = count_similar_cases()

        fs_count = 0
        fs_verified = 0
        total_fs = 0
        try:
            for d in db.collection("dataset_images").stream():
                total_fs += 1
                val = d.to_dict() or {}
                p = val.get("prediction") or val.get("verified_label")
                if disease_clean and p and str(p).lower() == disease_clean:
                    fs_count += 1
                    if val.get("is_verified"):
                        fs_verified += 1
        except Exception as fe:
            print(f"[Similar Cases Report Firestore Warning] {fe}")

        reported_count = max(fs_count, q_count)
        total_cases = max(total_fs, total_q, 1)

        info = DISEASE_METADATA.get(disease_clean, {
            "name": (disease_clean or "Unknown").upper(),
            "full_name": (disease_clean or "Unknown").upper(),
            "type": "Clinical Lesion",
            "severity_desc": "Clinical skin screening"
        })

        return {
            "disease": disease_clean,
            "disease_name": info.get("name"),
            "disease_full_name": info.get("full_name"),
            "disease_type": info.get("type"),
            "clinical_notes": info.get("severity_desc"),
            "similar_cases_reported": reported_count,
            "verified_cases_reported": fs_verified,
            "total_cases_in_registry": total_cases,
            "frequency_percentage": round((reported_count / total_cases * 100), 1) if total_cases > 0 else 0
        }
    except Exception as e:
        print(f"[Similar Cases Report Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))