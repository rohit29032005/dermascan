from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

import cloudinary
import os

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_SECRET")
)

from app.routes import auth_routes, image_routes, question_routes, chat_routes, doctor_routes

app = FastAPI(title="AI Derma Assistant API")

# Configure CORS
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://dermascan-alpha.vercel.app",
    "https://ai-derma-assistant.vercel.app",
]
if allowed_origins_env and allowed_origins_env.strip() != "*":
    for o in allowed_origins_env.split(","):
        cleaned = o.strip()
        if cleaned and cleaned not in origins:
            origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if allowed_origins_env.strip() != "*" else ["*"],
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router, prefix="/auth")
app.include_router(image_routes.router, prefix="/api")
app.include_router(question_routes.router, prefix="/api")
app.include_router(chat_routes.router, prefix="/api")
app.include_router(doctor_routes.router, prefix="/api")

@app.get("/")
def home():
    return {"message": "AI Derma Assistant Backend Running"}