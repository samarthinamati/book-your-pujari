import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "pujari_db")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
