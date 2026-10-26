# app/services/ml_service.py
import torch
import torchvision.transforms as transforms
from PIL import Image
import torchvision.models as models
import torch.nn as nn
import os
from pathlib import Path

# Limit PyTorch to 1 CPU thread to prevent memory bloat on constrained containers (Render 512MB RAM)
try:
    torch.set_num_threads(1)
except Exception:
    pass

# ────────────────────────────────────────────────
# Model Loading (EfficientNet B0)
# ────────────────────────────────────────────────
model = models.efficientnet_b0(weights=None)
model.classifier[1] = nn.Linear(model.classifier[1].in_features, 7)

# Resolve model path flexibly (env var -> local repo path -> container path)
def resolve_model_path() -> Path:
    env_path = os.getenv("SKIN_MODEL_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)

    # Candidate 1: Workspace root / ml / skin_model.pth (local development)
    workspace_candidate = Path(__file__).resolve().parents[3] / "ml" / "skin_model.pth"
    if workspace_candidate.exists():
        return workspace_candidate

    # Candidate 2: In-container backend / ml / skin_model.pth
    backend_ml_candidate = Path(__file__).resolve().parents[2] / "ml" / "skin_model.pth"
    if backend_ml_candidate.exists():
        return backend_ml_candidate

    # Candidate 3: In-container backend / weights / skin_model.pth
    backend_weights = Path(__file__).resolve().parent.parent.parent / "weights" / "skin_model.pth"
    if backend_weights.exists():
        return backend_weights

    container_weights_candidate = Path(__file__).resolve().parent.parent / "weights" / "skin_model.pth"
    if container_weights_candidate.exists():
        return container_weights_candidate

    # Fallback to direct current working directory
    cwd_candidate = Path.cwd() / "ml" / "skin_model.pth"
    if cwd_candidate.exists():
        return cwd_candidate

    # Return workspace candidate as default (will raise clean FileNotFoundError below if missing)
    return workspace_candidate

SKIN_MODEL_PATH = resolve_model_path()

if not SKIN_MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Skin model weights not found at: {SKIN_MODEL_PATH}. "
        f"Set SKIN_MODEL_PATH environment variable to point to the valid .pth file."
    )

print(f"[ML Service] Loading model weights from: {SKIN_MODEL_PATH}")
model.load_state_dict(torch.load(str(SKIN_MODEL_PATH), map_location="cpu"))
model.eval()

# Labels
label_names = ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc']

# Preprocessing
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ────────────────────────────────────────────────
# Prediction
# ────────────────────────────────────────────────
def predict_image(image_path: str):
    img = Image.open(image_path).convert("RGB")
    img_tensor = transform(img).unsqueeze(0)

    with torch.no_grad():
        outputs = model(img_tensor)
        probabilities = torch.nn.functional.softmax(outputs, dim=1)
        confidence = float(torch.max(probabilities) * 100)
        predicted_class = int(torch.argmax(outputs, dim=1))

    disease = label_names[predicted_class]
    return disease, round(confidence, 2)

# ────────────────────────────────────────────────
# Feature Extraction for Vector DB (EfficientNet safe)
# ────────────────────────────────────────────────
# EfficientNetB0 ke liye features module + global pool = 1280-dim vector
feature_extractor = nn.Sequential(
    model.features,
    nn.AdaptiveAvgPool2d(1)
)
feature_extractor.eval()

def extract_features(image_path: str):
    img = Image.open(image_path).convert("RGB")
    img_tensor = transform(img).unsqueeze(0)

    with torch.no_grad():
        features = feature_extractor(img_tensor)

    # Flatten to 1280-dim
    features = features.view(features.size(0), -1).squeeze()
    return features.cpu().numpy().tolist()  # Qdrant ke liye list







  