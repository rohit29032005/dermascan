from fastapi import APIRouter, Depends
from app.schemas.question_schema import Questionnaire
from app.utils.auth_dependency import get_current_user
from app.utils.severity_calc import calculate_severity
from pymongo import MongoClient
import os
from bson import ObjectId

router = APIRouter()

def get_images_collection():
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database connection string missing")
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        return client["derma_db"]["images"]
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=f"Database connection error: {str(e)}")

@router.post("/submit-questionnaire")
def submit_questionnaire(data: Questionnaire, user_id: str = Depends(get_current_user)):
    images = get_images_collection()
    image = images.find_one({"_id": ObjectId(data.image_id)})

    confidence = image["confidence"]

    final_score, level = calculate_severity(
        confidence,
        data.itching,
        data.pain,
        data.spread
    )

    images.update_one(
        {"_id": ObjectId(data.image_id)},
        {"$set": {
            "questionnaire": data.dict(),
            "final_score": final_score,
            "severity": level
        }}
    )

    return {
        "final_score": final_score,
        "severity": level
    }