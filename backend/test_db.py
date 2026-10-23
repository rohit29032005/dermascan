from dotenv import load_dotenv
import os
from pymongo import MongoClient

load_dotenv()
uri = os.getenv("MONGO_URI")

print("MONGO_URI from .env:", uri)  # Yeh print karo — agar None hai to problem yahin

if not uri:
    print("Error: MONGO_URI not found in .env!")
else:
    try:
        client = MongoClient(uri)
        client.admin.command('ping')  # Test connection
        print("MongoDB Atlas connected successfully! Ping worked.")
        print("Databases:", client.list_database_names())
    except Exception as e:
        print("Connection failed:", str(e))