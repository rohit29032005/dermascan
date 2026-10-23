import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
import os
from pathlib import Path

# Configuration
DATASET_PATH = Path(__file__).resolve().parent / "dataset_verified"
MODEL_SAVE_PATH = Path(__file__).resolve().parent / "skin_model_new.pth"
BATCH_SIZE = 16
LEARNING_RATE = 0.0001
EPOCHS = 10
NUM_CLASSES = 7

# Device setup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def train_model():
    print(f"--- Starting Training Pipeline ---")
    print(f"Using device: {device}")
    
    if not DATASET_PATH.exists():
        print(f"Error: Dataset not found at {DATASET_PATH}. Please run the export script first.")
        return

    # Data augmentation and normalization
    data_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    # Load dataset using ImageFolder
    try:
        dataset = datasets.ImageFolder(str(DATASET_PATH), transform=data_transforms)
        dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
        print(f"Dataset loaded: {len(dataset)} images across {len(dataset.classes)} classes.")
        print(f"Detected classes: {dataset.classes}")
    except Exception as e:
        print(f"Error loading dataset: {str(e)}")
        return

    # Initialize ResNet18
    # Using weights="DEFAULT" for transfer learning
    model = models.resnet18(weights="DEFAULT")
    
    # Update the fully connected layer for our 7 classes
    model.fc = nn.Linear(model.fc.in_features, NUM_CLASSES)
    model = model.to(device)

    # Loss and Optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    # Training Loop
    model.train()
    for epoch in range(EPOCHS):
        running_loss = 0.0
        correct = 0
        total = 0
        
        for images, labels in dataloader:
            images, labels = images.to(device), labels.to(device)
            
            # Forward pass
            outputs = model(images)
            loss = criterion(outputs, labels)
            
            # Backward and optimize
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            
            # Accuracy calculation
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
        epoch_loss = running_loss / len(dataloader)
        epoch_acc = 100 * correct / total
        print(f"Epoch [{epoch+1}/{EPOCHS}] - Loss: {epoch_loss:.4f}, Accuracy: {epoch_acc:.2f}%")

    # Save model weights
    print(f"Training complete. Saving model to {MODEL_SAVE_PATH}...")
    torch.save(model.state_dict(), str(MODEL_SAVE_PATH))
    print(f"Model saved successfully.")
    
    # Optional: Swap the models (Uncomment if you want to deploy immediately)
    # deploy_model()

def deploy_model():
    """Sets the newly trained model as the active model."""
    active_model_path = Path(__file__).resolve().parent / "skin_model.pth"
    backup_path = Path(__file__).resolve().parent / "skin_model_backup.pth"
    
    if active_model_path.exists():
        os.rename(active_model_path, backup_path)
        print(f"Backed up old model to {backup_path}")
        
    os.rename(MODEL_SAVE_PATH, active_model_path)
    print(f"New model deployed as {active_model_path}")

if __name__ == "__main__":
    train_model()
