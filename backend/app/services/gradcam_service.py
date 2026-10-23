import cv2
import torch
import numpy as np
from PIL import Image
from torchvision import transforms
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
import os
import uuid
from tempfile import NamedTemporaryFile
from app.services.ml_service import model
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
import cloudinary.uploader

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def generate_heatmap(image_path: str, predicted_class: int, user_id: str, chat_id: str):
    """
    Generate Grad-CAM heatmap, upload to Cloudinary and return secure URL.
    """
    image = Image.open(image_path).convert("RGB")
    input_tensor = transform(image).unsqueeze(0)

    # Select a target layer compatible with the model architecture.
    if hasattr(model, 'layer4'):
        target_layer = model.layer4[-1]
    elif hasattr(model, 'features'):
        target_layer = None
        for m in reversed(list(model.features.children())):
            if any(isinstance(sub, torch.nn.Conv2d) for sub in m.modules()):
                target_layer = m
                break
        if target_layer is None:
            target_layer = model.features[-1]
    else:
        target_layer = list(model.children())[-1]

    with GradCAM(model=model, target_layers=[target_layer]) as cam:
        grayscale_cam = cam(input_tensor=input_tensor, targets=[ClassifierOutputTarget(predicted_class)])
        if isinstance(grayscale_cam, np.ndarray):
            gcam = grayscale_cam[0]
        else:
            gcam = grayscale_cam[0]

        rgb_img = np.array(image.resize((224, 224))) / 255.0
        visualization = show_cam_on_image(rgb_img, gcam, use_rgb=True)

    # Save to a temporary file safely on Windows
    with NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        heatmap_path = tmp.name
    
    # Outside the 'with' block, the file handle is closed, so cv2 can write to it safely.
    cv2.imwrite(heatmap_path, cv2.cvtColor(visualization, cv2.COLOR_RGB2BGR))

    # Upload to Cloudinary
    try:
        folder_path = f"derma_heatmaps/{user_id}/{chat_id}"
        result = cloudinary.uploader.upload(
            heatmap_path,
            folder=folder_path,
            public_id=f"heatmap_{uuid.uuid4().hex}"
        )
        secure_url = result.get("secure_url")
    finally:
        # cleanup local temp file
        try:
            os.remove(heatmap_path)
        except Exception:
            pass

    return secure_url