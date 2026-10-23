import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.utils.auth_dependency import get_current_user
from app.services.firebase_service import db
from firebase_admin import firestore
import openai
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
client = openai.OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENAI_API_KEY", "dummy_key")
)

class ChatMessageRequest(BaseModel):
    chatId: str
    message: str
    questionnaire: Optional[Dict[str, Any]] = None

@router.post("/chat")
async def handle_chat(request: ChatMessageRequest, user_id: str = Depends(get_current_user)):
    try:
        # 1. Fetch chat history and images for context natively
        messages_ref = db.collection("users").document(user_id).collection("chats").document(request.chatId).collection("messages").stream()
        history = [msg.to_dict() for msg in messages_ref]
        # Sort locally by timestamp to bypass Firestore Composite Index requirements
        # Because timestamp might be a Firestore Sentinel or Datetime, stringify safely or handle None
        def get_time(x):
            t = x.get("timestamp")
            if not t: return ""
            # If it's a string, return as is. If not (datetime or Firestore timestamp), try formatting or str it
            return str(t)
        history.sort(key=get_time)

        # Look for the last image uploaded in this exact session
        images_only = [msg for msg in history if "image_url" in msg and "prediction" in msg]
        latest_image = images_only[-1] if images_only else None

        # 3. Construct LLM Prompt
        system_prompt = """
        You are an AI Dermatology Assistant. Your primary goal is to provide supportive, non-diagnostic medical guidance based on the given context.
        You have access to a machine learning prediction of a skin lesion.
        You MUST NOT make a definitive diagnosis, and explicitly state that users should consult a certified dermatologist for a real medical opinion.
        """

        context = "We are analyzing a skin condition."
        if latest_image:
            context += f" The ML model predicts {latest_image.get('prediction', 'Unknown')} with {latest_image.get('confidence', 0)}% confidence.\n"
            
        if request.questionnaire:
            context += f" Patient details: Age {request.questionnaire.get('age')}, Gender {request.questionnaire.get('gender')}, Area: {request.questionnaire.get('location')}, Duration: {request.questionnaire.get('duration')} days, Itch/Pain Form Scale: {request.questionnaire.get('painScale')}.\n"
            
            # Rule based update - severity score
            conf = float(latest_image.get("confidence", 0)) if latest_image else 0
            rule_score = int(request.questionnaire.get('painScale', 0)) * 20 # Simple mapping 0-100
            final_score = (conf * 0.6) + (rule_score * 0.4)
            context += f" Computed Severity Score is: {final_score:.2f} / 100.\n"

        llm_messages = [{"role": "system", "content": system_prompt + "\nContext:\n" + context}]
        for msg in history:
            # Avoid sending long URL data to LLM context redundantly
            c = msg["content"]
            if msg.get("prediction"): c += f" [Model predicts: {msg['prediction']}]"
            llm_messages.append({"role": msg["role"] if msg["role"] in ["user", "assistant", "system"] else "user", "content": c})
            
        llm_messages.append({"role": "user", "content": request.message})

        # 4. Call OpenAI
        response = client.chat.completions.create(
            model="gpt-3.5-turbo", # Can use gpt-4 or gemini via a compatible bridge
            messages=llm_messages,
            max_tokens=500
        )
        assistant_content = response.choices[0].message.content

        # Backend no longer writes. Returns explicitly to frontend to manage schema lifecycle.
        return {"reply": assistant_content}

    except Exception as e:
        print(f"[Chat Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete-chat")
async def delete_chat(chat_id: str, user_id: str = Depends(get_current_user)):
    try:
        chat_ref = db.collection("users").document(user_id).collection("chats").document(chat_id)
        # To delete a document with subcollections, we need to delete subcollection docs first
        messages = chat_ref.collection("messages").stream()
        batch = db.batch()
        for msg in messages:
            batch.delete(msg.reference)
        batch.delete(chat_ref)
        batch.commit()
        return {"message": "Chat deleted successfully"}
    except Exception as e:
        print(f"[Delete Chat Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete-all-chats")
async def delete_all_chats(user_id: str = Depends(get_current_user)):
    try:
        chats = db.collection("users").document(user_id).collection("chats").stream()
        for chat in chats:
            # Recursively delete each chat
            messages = chat.reference.collection("messages").stream()
            batch = db.batch()
            for msg in messages:
                batch.delete(msg.reference)
            batch.delete(chat.reference)
            batch.commit()
        return {"message": "All chats deleted successfully"}
    except Exception as e:
        print(f"[Delete All Chats Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))
