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
        try:
            predicted_idx = label_names.index(disease)
        except ValueError:
            predicted_idx = 0
            
        heatmap_url = generate_heatmap(temp_path, predicted_idx, user_id=user_id, chat_id=chat_id)

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
        if q_data and 'painScale' in q_data:
            conf = float(confidence)
            rule_score = int(q_data.get('painScale', 0)) * 20 
            severity_score = (conf * 0.6) + (rule_score * 0.4)

        # We no longer save to the global 'images' collection here!
        # The frontend uses this returning JSON to write directly into users/{userId}/chats/{chatId}/messages
        inserted_id = str(uuid.uuid4())

        # 9. Store vector in Qdrant
        store_vector(
            image_id=inserted_id,
            vector=vector,
            payload={
                "disease": disease,
                "confidence": confidence,
                "user_id": user_id
            }
        )

        # 10. Store metadata in dataset_images collection for training pipeline
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
            # Not raising exception here to avoid breaking the user flow if dataset tracking fails

        # 11. Search similar vectors
        similar_cases = search_similar(vector)
        similar_count = len(similar_cases)

        # Cleanup temp file
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

        return {
            "message": "Image uploaded & predicted successfully",
            "prediction": disease,
            "confidence": f"{confidence:.2f}%",
            "severity": severity_score,
            "image_url": secure_url,
            "similar_cases_found": similar_count,
            "heatmap_url": heatmap_url,
            "similar_cases": [
                {
                    "score": case["score"],
                    "image_id": case["image_id"],
                    "disease": case.get("disease", "Unknown")
                }
                for case in similar_cases
            ] if similar_cases else [],
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