import hashlib

def generate_hash(file_bytes: bytes):
    """
    Generate unique hash for an image using SHA256
    """
    return hashlib.sha256(file_bytes).hexdigest()