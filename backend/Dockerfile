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

# Upgrade pip to avoid build dependency isolation issues
RUN pip install --no-cache-dir --upgrade pip

# Copy dependency requirements
COPY requirements.txt .

# Install PyTorch CPU using --extra-index-url (keeps PyPI available for build tools like flit_core)
RUN pip install --no-cache-dir torch torchvision --extra-index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# Copy backend source code including weights
COPY . .

EXPOSE 8080

# Render and Cloud Run both provide the PORT environment variable
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1
