from fastapi import APIRouter, HTTPException
from app.schemas.user_schema import UserSignup, UserLogin
from app.utils.security import hash_password, verify_password, create_access_token
from app.utils.age_calc import calculate_age
from datetime import datetime
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()  # <--- Yeh add karo

router = APIRouter()

def get_users_collection():
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        raise HTTPException(status_code=503, detail="Database connection string missing")
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        return client["derma_db"]["users"]
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection error: {str(e)}")

@router.post("/signup")
def signup(user: UserSignup):
    users = get_users_collection()
    existing = users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    age = calculate_age(user.dob)

    hashed_pw = hash_password(user.password)

    user_data = {
        "name": user.name,
        "email": user.email,
        "password": hashed_pw,
        "dob": str(user.dob),
        "age": age,
        "blood_group": user.blood_group,
        "gender": user.gender,
        "created_at": datetime.utcnow()
    }

    users.insert_one(user_data)

    return {"message": "User created successfully"}

@router.post("/login")
def login(user: UserLogin):
    users = get_users_collection()
    db_user = users.find_one({"email": user.email})
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_access_token({"user_id": str(db_user["_id"])})

    return {"access_token": token}