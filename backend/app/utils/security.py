import bcrypt
from jose import jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
load_dotenv()
SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

def hash_password(password: str):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

def verify_password(password: str, hashed: bytes):
    return bcrypt.checkpw(password.encode("utf-8"), hashed)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})

    if not SECRET_KEY:
        raise ValueError("JWT_SECRET is not set in environment variables!")
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)