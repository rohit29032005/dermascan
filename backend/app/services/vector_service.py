# app/services/vector_service.py

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import uuid
import os
from typing import List, Dict, Any

# Try to infer vector dimension from the ML model feature extractor
try:
    from app.services import ml_service
    import torch
    with torch.no_grad():
        sample = torch.zeros(1, 3, 224, 224)
        if hasattr(ml_service, 'feature_extractor'):
            feats = ml_service.feature_extractor(sample)
            VECTOR_SIZE_DETECTED = feats.view(feats.size(0), -1).size(1)
        else:
            # fallback: run full model and infer output dim
            out = ml_service.model(sample)
            VECTOR_SIZE_DETECTED = out.view(out.size(0), -1).size(1)
    print(f"[VectorService] Detected model vector dim: {VECTOR_SIZE_DETECTED}")
except Exception:
    VECTOR_SIZE_DETECTED = None

# ────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────
COLLECTION_NAME = "skin_cases"
VECTOR_SIZE = VECTOR_SIZE_DETECTED or 512  # prefer detected dim, fallback to 512
QDRANT_HOST = "localhost"
QDRANT_PORT = 6334         # gRPC port (recommended)

# Initialize Qdrant client (Cloud-ready with local development fallback)
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

if QDRANT_URL:
    print(f"[VectorService] Connecting to managed Qdrant instance: {QDRANT_URL}")
    client = QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY or None,
        prefer_grpc=False
    )
else:
    print("[VectorService] Using local storage mode (./qdrant_storage)")
    client = QdrantClient(path="./qdrant_storage")
# ────────────────────────────────────────────────
# Automatic collection creation / check
# ────────────────────────────────────────────────
def ensure_collection_exists():
    try:
        info = client.get_collection(COLLECTION_NAME)
        existing_size = None
        try:
            # Handle both object and dict access for vectors_config
            if isinstance(info, dict):
                config = info.get("config", {}).get("params", {}).get("vectors", {})
                existing_size = config.get("size")
            else:
                existing_size = info.vectors_config.size
        except Exception:
            pass

        if existing_size is None:
            print(f"[Qdrant] Collection '{COLLECTION_NAME}' exists (unknown vector size).")
        else:
            print(f"[Qdrant] Collection '{COLLECTION_NAME}' exists (vector size={existing_size}).")

        if existing_size is not None and existing_size != VECTOR_SIZE:
            print(f"[Qdrant] Collection vector size ({existing_size}) != model vector size ({VECTOR_SIZE}). Recreating collection...")
            # delete and recreate to match model vector dim
            client.delete_collection(collection_name=COLLECTION_NAME)
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)
            )
            print(f"[Qdrant] Collection '{COLLECTION_NAME}' recreated with vector size={VECTOR_SIZE}.")

    except Exception:
        # If not found → create it
        print(f"[Qdrant] Collection '{COLLECTION_NAME}' not found. Creating with vector size={VECTOR_SIZE}...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=VECTOR_SIZE,
                distance=Distance.COSINE
            )
        )
        print(f"[Qdrant] Collection '{COLLECTION_NAME}' created successfully with vector size={VECTOR_SIZE}!")

# Call this once at module load
ensure_collection_exists()

# Optional debug
try:
    cols = client.get_collections()
    col_list = cols.collections if not isinstance(cols, dict) else cols.get("collections", [])
    print(f"[Qdrant] Current collections: {col_list}")
except Exception:
    pass

# ────────────────────────────────────────────────
# Store vector
# ────────────────────────────────────────────────
def store_vector(
    image_id: str,
    vector: List[float],
    payload: Dict[str, Any] = None
) -> str:
    if payload is None:
        payload = {}

    point_id = str(uuid.uuid4())

    payload["image_id"] = image_id

    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=point_id,
                vector=vector,
                payload=payload
            )
        ]
    )

    print(f"[Qdrant] Stored vector for image_id={image_id} with point_id={point_id}")
    return point_id

# ────────────────────────────────────────────────
# Search similar
# ────────────────────────────────────────────────
# def search_similar(
#     query_vector: List[float],
#     limit: int = 5
# ) -> List[Dict]:
#     results = client.search(
#         collection_name=COLLECTION_NAME,
#         query_vector=query_vector,
#         limit=limit,
#         with_payload=True
#     )

#     formatted = [
#         {
#             "score": hit.score,
#             "point_id": hit.id,
#             "image_id": hit.payload.get("image_id"),
#             "disease": hit.payload.get("disease"),
#             "confidence": hit.payload.get("confidence"),
#         }
#         for hit in results
#     ]

#     return formatted

def search_similar(
    query_vector: List[float],
    limit: int = 5,
    exclude_image_id: str = None
) -> List[Dict]:
    """
    Search for similar vectors in Qdrant with support for both query_points and search.
    """
    try:
        fetch_limit = limit + 2 if exclude_image_id else limit
        hits = []

        if hasattr(client, "query_points"):
            response = client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                limit=fetch_limit,
                with_payload=True
            )
            hits = response.points if hasattr(response, "points") else response
        elif hasattr(client, "search"):
            hits = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                limit=fetch_limit,
                with_payload=True
            )
        else:
            print("[Qdrant Search Error] Neither query_points nor search method found on Qdrant client")
            return []

        formatted = []
        for hit in hits:
            try:
                if isinstance(hit, dict):
                    score = hit.get("score")
                    pid = hit.get("id")
                    payload = hit.get("payload") or {}
                else:
                    score = getattr(hit, "score", None)
                    pid = getattr(hit, "id", None)
                    payload = getattr(hit, "payload", {}) or {}

                img_id = payload.get("image_id")
                # Filter out current uploaded image if requested
                if exclude_image_id and img_id == exclude_image_id:
                    continue

                raw_score = float(score) if score is not None else 0.0
                # Cosine similarity in Qdrant ranges from -1 to 1; for non-negative embeddings normalize to 0-100%
                sim_percent = round(max(0.0, min(1.0, raw_score)) * 100, 1)

                formatted.append({
                    "score": sim_percent,
                    "similarity": sim_percent,
                    "raw_score": raw_score,
                    "point_id": str(pid),
                    "image_id": img_id,
                    "disease": payload.get("disease"),
                    "confidence": payload.get("confidence"),
                    "image_url": payload.get("image_url"),
                    "is_verified": payload.get("is_verified", False),
                    "source": payload.get("source", "user"),
                })

                if len(formatted) >= limit:
                    break

            except Exception as item_err:
                print(f"[Qdrant] Skipping malformed hit: {item_err}")
                continue

        print(f"[Qdrant] Found {len(formatted)} similar cases (requested limit={limit})")
        return formatted

    except Exception as e:
        print(f"[Qdrant Search Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return []


def count_similar_cases(disease: str = None) -> int:
    """
    Count points matching a disease in Qdrant (or total points if disease is None).
    """
    try:
        if not client.collection_exists(COLLECTION_NAME):
            return 0
        if disease:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            cnt = client.count(
                collection_name=COLLECTION_NAME,
                count_filter=Filter(must=[FieldCondition(key="disease", match=MatchValue(value=disease))])
            )
            return cnt.count
        else:
            cnt = client.count(collection_name=COLLECTION_NAME)
            return cnt.count
    except Exception as e:
        print(f"[Qdrant Count Error] {e}")
        return 0


def get_similar_cases_overview(disease: str = None) -> Dict[str, Any]:
    """
    Get high-level summary of similar cases in Qdrant repository.
    """
    try:
        total = count_similar_cases()
        matching = count_similar_cases(disease) if disease else total
        return {
            "total_repository_cases": total,
            "disease_reported_cases": matching,
            "disease": disease
        }
    except Exception as e:
        print(f"[Qdrant Overview Error] {e}")
        return {"total_repository_cases": 0, "disease_reported_cases": 0, "disease": disease}