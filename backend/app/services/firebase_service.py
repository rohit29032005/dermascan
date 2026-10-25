import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from dotenv import load_dotenv

load_dotenv()

# We expect a path to the service account key in .env
SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_CREDENTIALS_JSON_PATH", "serviceAccountKey.json")

def init_firebase():
    if not firebase_admin._apps:
        try:
            # 1. Try credentials from raw JSON string in environment (ideal for Render/Railway/Fly)
            raw_json_str = os.getenv("FIREBASE_CREDENTIALS_JSON")
            if raw_json_str:
                cred_dict = json.loads(raw_json_str)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                print("[Firebase] Initialized with FIREBASE_CREDENTIALS_JSON string.")
                return

            # 2. Try file paths (including Render Secret Files at /etc/secrets/serviceAccountKey.json)
            possible_paths = [
                SERVICE_ACCOUNT_PATH,
                "/etc/secrets/serviceAccountKey.json",
                os.path.join(os.getcwd(), "serviceAccountKey.json")
            ]
            for path in possible_paths:
                if path and os.path.exists(path):
                    cred = credentials.Certificate(path)
                    firebase_admin.initialize_app(cred)
                    print(f"[Firebase] Initialized with Service Account JSON file ({path}).")
                    return

            # 3. Fallback to Application Default Credentials (GCP / Cloud Run native IAM)
            firebase_admin.initialize_app()
            print("[Firebase] Initialized with Application Default Credentials (GCP native).")
        except Exception as e:
            print(f"[Firebase] Initialization error: {e}")
            raise

init_firebase()

db = firestore.client()

