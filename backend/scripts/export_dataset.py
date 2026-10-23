import os
import httpx
import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path

# Initialization
# Adjust the path to serviceAccountKey.json relative to this script
SERVICE_ACCOUNT_PATH = Path(__file__).resolve().parents[1] / "serviceAccountKey.json"

if not firebase_admin._apps:
    cred = credentials.Certificate(str(SERVICE_ACCOUNT_PATH))
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Settings
EXPORT_DIR = Path(__file__).resolve().parents[2] / "ml" / "dataset_verified"
COLLECTION_NAME = "dataset_images"

def download_image(url, save_path):
    """Downloads an image from a URL and saves it to the specified path."""
    try:
        response = httpx.get(url)
        if response.status_code == 200:
            with open(save_path, "wb") as f:
                f.write(response.content)
            return True
        else:
            print(f"Failed to download image: {url} (Status: {response.status_code})")
            return False
    except Exception as e:
        print(f"Error downloading {url}: {str(e)}")
        return False

def export_verified_dataset():
    print(f"--- Starting Dataset Export ---")
    print(f"Fetching verified images from Firestore...")
    
    # Query verified but not yet used for training (optional, but keep it simple for now as per request)
    docs = db.collection(COLLECTION_NAME).where("is_verified", "==", True).stream()
    
    count = 0
    downloaded = 0
    
    for doc in docs:
        data = doc.to_dict()
        label = data.get("verified_label")
        image_url = data.get("image_url")
        doc_id = doc.id
        
        if not label or not image_url:
            continue
            
        count += 1
        
        # Create folder for the label
        label_dir = EXPORT_DIR / label
        label_dir.mkdir(parents=True, exist_ok=True)
        
        # Define filename (using Firestore Doc ID to ensure uniqueness)
        file_extension = os.path.splitext(image_url.split("?")[0])[-1]
        if not file_extension:
            file_extension = ".jpg" # Default
            
        filename = f"{doc_id}{file_extension}"
        save_path = label_dir / filename
        
        print(f"[{count}] Downloading {label}/{filename}...")
        if download_image(image_url, save_path):
            downloaded += 1
            # Mark as used for training
            # db.collection(COLLECTION_NAME).document(doc_id).update({"used_for_training": True})

    print(f"--- Export Complete ---")
    print(f"Total verified documents found: {count}")
    print(f"Successfully downloaded: {downloaded} images")
    print(f"Dataset location: {EXPORT_DIR}")

if __name__ == "__main__":
    export_verified_dataset()
