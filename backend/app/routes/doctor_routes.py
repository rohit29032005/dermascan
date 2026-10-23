from fastapi import APIRouter, Depends, HTTPException, Query
from app.utils.auth_dependency import get_current_user
from app.services.firebase_service import db
import httpx
import os

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form
import cloudinary.uploader
import tempfile

router = APIRouter()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

@router.post("/doctor-upload")
async def doctor_upload(
    file: UploadFile = File(...),
    label: str = Form(...),
    notes: str = Form(None),
    user_id: str = Depends(get_current_user)
):
    temp_path = None
    try:
        # 1. Verify user is a doctor
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists or user_doc.to_dict().get("role") != "doctor":
            raise HTTPException(status_code=403, detail="Access denied. Only doctors can upload data.")

        # 2. Save temporary file
        file_bytes = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            tmp.write(file_bytes)
            temp_path = tmp.name

        # 3. Upload to Cloudinary (doctor_labeled folder)
        upload_result = cloudinary.uploader.upload(
            temp_path,
            folder="doctor_labeled",
            public_id=f"doc_{uuid.uuid4().hex}"
        )
        secure_url = upload_result.get("secure_url")

        # 4. Save to dataset_images collection
        inserted_id = str(uuid.uuid4())
        db.collection("dataset_images").document(inserted_id).set({
            "image_url": secure_url,
            "verified_label": label,
            "added_by": "doctor",
            "reviewer_email": user_doc.to_dict().get("email"),
            "notes": notes,
            "is_verified": True,
            "source": "doctor",
            "created_at": datetime.utcnow()
        })

        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

        return {"message": "Data contributed successfully", "image_url": secure_url}

    except Exception as e:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
        print(f"[Doctor Upload Error] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/doctors")
async def get_doctors(chat_id: str, user_id: str = Depends(get_current_user)):
    try:
        # 1. Fetch user location from Firestore
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        user_data = user_doc.to_dict()
        location = user_data.get("location")
        
        if not location or location.get("lat") is None or location.get("lng") is None:
            return {"doctors": [], "message": "User location not set. Please enable location services."}
        
        lat = location["lat"]
        lng = location["lng"]
        
        # If no API key, return mocks to avoid crashing
        if not GOOGLE_MAPS_API_KEY:
             return {"doctors": [
                 {"name": "City Dermatology Clinic (Sample)", "address": "123 Healthcare Plaza, Metro North", "rating": 4.9},
                 {"name": "Skin Specialty Hospital (Sample)", "address": "789 Medical Row, West View", "rating": 4.6}
             ], "message": "Google Maps API Key missing in backend. Displaying sample data."}

        # 2. Call Google Places API
        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{lat},{lng}",
            "radius": 10000, # 10km radius
            "type": "doctor",
            "keyword": "dermatologist",
            "key": GOOGLE_MAPS_API_KEY
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()
            
        if data.get("status") != "OK":
            return {"doctors": [], "message": f"Places API status: {data.get('status')}"}
            
        results = data.get("results", [])
        doctors = []
        for res in results[:3]: # Take top 3 closest or best matching
            doctors.append({
                "name": res.get("name"),
                "address": res.get("vicinity"),
                "rating": res.get("rating")
            })
            
        return {"doctors": doctors}

    except Exception as e:
        print(f"[Doctor API Error] {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch nearby doctors")
