FROM python:3.10-slim

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# Install system dependencies required for OpenCV, Pillow and headless rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency requirements
COPY requirements.txt .

# Install PyTorch CPU first to avoid heavy CUDA wheels (saves ~3GB)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code including weights
COPY . .

EXPOSE 8080

# Cloud Run uses PORT environment variable
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1
