# Dataset Documentation & Specification

## Overview

The **AI Derma Assistant (DermaScan)** platform relies on a dual-dataset architecture:
1. **Benchmark Base Dataset**: The **HAM10000** ("Human Against Machine with 10,000 training images") dataset, used for baseline neural network pre-training and vector embedding initialization.
2. **Human-in-the-Loop Active Dataset (`dataset_images`)**: A dynamic dataset containing verified clinical contributions from doctors and user-uploaded cases audited by platform administrators.

---

## 1. Primary Benchmark Dataset: HAM10000

The primary dataset used to train the core classification model (EfficientNet-B0 / ResNet18) is **HAM10000**, curated by the Department of Dermatology at the Medical University of Vienna and the Cliffside Skin Cancer Center.

* **Total Images**: 10,015 dermatoscopic images
* **Image Format**: RGB, 24-bit color
* **Metadata Fields**: `lesion_id`, `image_id`, `dx` (diagnosis), `dx_type` (confirmation method), `age`, `sex`, `localization`

---

## 2. Lesion Categories & Disease Classes

The model classifies skin lesions into **7 distinct diagnostic categories**:

| Abbreviation | Full Clinical Name | Malignancy Status | Description |
| :--- | :--- | :--- | :--- |
| **`akiec`** | Actinic Keratoses & Intraepithelial Carcinoma | Precancerous / Malignant | Non-invasive squamous cell carcinoma or precancerous skin patches caused by sun damage. |
| **`bcc`** | Basal Cell Carcinoma | Malignant | Common form of skin cancer arising from basal cells in the lower layer of the epidermis. |
| **`bkl`** | Benign Keratosis-like Lesions | Benign | Non-cancerous skin growths including seborrheic keratoses, solar lentigines, and lichen planus-like keratoses. |
| **`df`** | Dermatofibroma | Benign | Common benign cutaneous nodule consisting of fibrous tissue, usually found on limbs. |
| **`mel`** | Melanoma | Malignant | High-risk, aggressive malignant skin cancer originating from pigment-producing melanocytes. |
| **`nv`** | Melanocytic Nevi | Benign | Common moles and benign pigment-producing cell clusters. |
| **`vasc`** | Vascular Lesions | Benign / Vascular | Vascular skin abnormalities including cherry angiomas, pyogenic granulomas, and cutaneous hemorrhages. |

---

## 3. Data Preprocessing & Input Pipelines

### Image Standardization
All input images undergo standard computer vision normalization before model inference and vector embedding generation:

* **Target Resolution**: $224 \times 224$ pixels
* **Color Space**: RGB (3 channels)
* **Data Augmentation (Training)**: Random Horizontal Flip, Random Rotation ($\pm 10^\circ$), Color Jitter
* **Normalization Parameters**:
  * **Mean**: $[0.485, 0.456, 0.406]$
  * **Standard Deviation**: $[0.229, 0.224, 0.225]$

### Vector Database Embeddings (Qdrant)
* **Collection Name**: `skin_cases`
* **Embedding Dimensionality**: 1280-dimensional (EfficientNet-B0 feature extractor) or 512-dimensional (ResNet18 FC layer input)
* **Distance Metric**: Cosine Similarity ($\text{Cosine Distance} = 1 - \cos(\theta)$)
* **Payload Metadata**: `image_id`, `disease`, `confidence`, `user_id`, `source`

---

## 4. Active Dataset & Human Verification Queue

### Firestore Collection: `dataset_images`
When a user uploads an image for screening or a verified doctor contributes a case via the Doctor Dashboard, a document is recorded in the `dataset_images` collection:

```json
{
  "id": "uuid-v4-string",
  "image_url": "https://res.cloudinary.com/...",
  "heatmap_url": "https://res.cloudinary.com/...",
  "prediction": "mel",
  "confidence": 94.5,
  "source": "doctor" | "user",
  "is_verified": false,
  "verified_label": null,
  "reviewed_by": null,
  "reviewed_at": null,
  "used_for_training": false,
  "created_at": "TIMESTAMP"
}
```

### Verification Pipeline (`export_dataset.py` & `train_resnet.py`)
1. **Admin Audit**: Administrators review cases in `/admin-dashboard`. If the prediction is verified or corrected, `is_verified` becomes `true` and `verified_label` is saved.
2. **Dataset Export**: The script [`export_dataset.py`](file:///C:/Users/anju2/Desktop/ai-derma-assistant/backend/scripts/export_dataset.py) fetches verified cases from Firestore and downloads images into structured directories (`ml/dataset_verified/{label}/`).
3. **Model Fine-Tuning**: [`train_resnet.py`](file:///C:/Users/anju2/Desktop/ai-derma-assistant/ml/train_resnet.py) loads `dataset_verified` using PyTorch `ImageFolder` to perform continuous learning and update model weights.

---

## 5. Data Privacy & Compliance Rules

1. **Anonymization**: All medical images uploaded by patients or clinicians are stripped of EXIF headers and personal identification metadata prior to storage.
2. **Access Control**: User chat history and uploaded images are scoped to the authenticated owner (`users/{userId}/chats/{chatId}`).
3. **Non-Diagnostic Use Disclaimer**: Dataset samples and model classifications serve informational, educational, and research reference purposes only. They are not intended as clinical diagnostic guarantees.
