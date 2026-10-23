from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth

security = HTTPBearer()

def get_current_user(token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        # Verify the Firebase ID token
        decoded_token = auth.verify_id_token(token.credentials)
        # return the Firebase UID
        return decoded_token.get('uid')
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Invalid Firebase Auth token: {e}")