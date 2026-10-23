import torch
import pandas as pd
from PIL import Image
from torchvision import transforms
from torchvision.models import resnet18
from torch.utils.data import Dataset, DataLoader
import torch.nn as nn
import os

# Dataset paths
IMAGE_DIR = "dataset/images"
CSV_PATH = "dataset/HAM10000_metadata.csv"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

metadata = pd.read_csv(CSV_PATH)

class SkinDataset(Dataset):

    def __init__(self, dataframe, transform=None):
        self.df = dataframe
        self.transform = transform
        self.labels = list(self.df["dx"].unique())
        self.label_map = {label:i for i,label in enumerate(self.labels)}

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):

        img_name = self.df.iloc[idx]["image_id"] + ".jpg"
        img_path = os.path.join(IMAGE_DIR, img_name)

        image = Image.open(img_path).convert("RGB")

        label = self.label_map[self.df.iloc[idx]["dx"]]

        if self.transform:
            image = self.transform(image)

        return image, label


transform = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor()
])

dataset = SkinDataset(metadata, transform)

loader = DataLoader(dataset, batch_size=32, shuffle=True)

model = resnet18(weights="DEFAULT")
model.fc = nn.Linear(model.fc.in_features, 7)

model = model.to(device)

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.0001)

for epoch in range(5):

    total_loss = 0

    for images, labels in loader:

        images = images.to(device)
        labels = labels.to(device)

        outputs = model(images)

        loss = criterion(outputs, labels)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    print("Epoch:", epoch, "Loss:", total_loss)

torch.save(model.state_dict(), "model.pth")

print("Training complete")