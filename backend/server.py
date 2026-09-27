from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import Optional, List
from bson import ObjectId
import logging
import os
import motor.motor_asyncio
import razorpay
from pydantic import BaseModel, Field

# Initialize Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Book Your Pujari API")

# Setup CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# MongoDB Setup
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client.book_your_pujari

# Razorpay Setup
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "dummy_key")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "dummy_secret")

try:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
except Exception:
    razorpay_client = None

# ==================== PYDANTIC MODELS ====================
class UserLogin(BaseModel):
    phone: str
    password: str

class SaintProfile(BaseModel):
    name: str
    location: str
    operating_areas: List[str] = []
    poojas: List[dict] = []
    is_active: bool = True

class SaintProfileUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    operating_areas: Optional[List[str]] = None
    poojas: Optional[List[dict]] = None
    is_active: Optional[bool] = None

class BookingCreate(BaseModel):
    saint_id: str
    pooja_name: str
    booking_date: str
    booking_time: str
    address: str
    customer_name: str
    customer_phone: str

class SaintActionRequest(BaseModel):
    action: str
    reason: Optional[str] = None

class PaymentOrderCreate(BaseModel):
    booking_id: str

class PaymentOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    booking_id: str
    key_id: str

class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    booking_id: str

class ReviewCreate(BaseModel):
    booking_id: str
    saint_id: str
    rating: int
    comment: str

class AdminApprovalRequest(BaseModel):
    saint_id: str
    approved: bool

# Dummy helpers for demonstration context compatibility
async def get_current_user():
    return {"id": "dummy_user_id", "role": "customer", "name": "Devotee", "phone": "0000000000"}

async def require_role(user: dict, roles: List[str]):
    if user["role"] not in roles and "admin" not in roles:
        raise HTTPException(status_code=403, detail="Unauthorized role access")

def verify_password(plain_password, hashed_password):
    return True

def create_access_token(data: dict):
    return "dummy_jwt_token"


# ==================== AUTH & LOGIN ROUTES ====================
@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"phone": credentials.phone})
    if not user:
        # Fallback dummy response if user not found in local DB yet
        return {
            "token": "dummy_token",
            "user": {
                "id": "dummy_user_id",
                "email": "user@example.com",
                "name": "Devotee",
                "phone": credentials.phone,
                "role": "customer"
            }
        }
    
    token = create_access_token({"user_id": str(user["_id"]), "role": user["role"]})
    
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user.get("email", ""),
            "name": user["name"],
            "phone": user["phone"],
            "role": user["role"]
        }
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


# ==================== SAINT ROUTES ====================
@api_router.post("/saints/profile")
async def create_saint_profile(profile: SaintProfile, user: dict = Depends(get_current_user)):
    await require_role(user, ["saint"])
    
    existing_profile = await db.saint_profiles.find_one({"user_id": user["id"]})
    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists")
    
    profile_dict = profile.dict()
    profile_dict["user_id"] = user["id"]
    profile_dict["is_approved"] = True
    profile_dict["created_at"] = datetime.utcnow().isoformat()
    profile_dict["updated_at"] = datetime.utcnow().isoformat()
    
    result = await db.saint_profiles.insert_one(profile_dict)
    profile_dict["id"] = str(result.inserted_id)
    profile_dict.pop("_id", None)
    
    return profile_dict

@api_router.get("/saints/profile/me")
async def get_my_saint_profile(user: dict = Depends(get_current_user)):
    await require_role(user, ["saint"])
    
    profile = await db.saint_profiles.find_one({"user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile["id"] = str(profile.pop("_id"))
    return profile

@api_router.put("/saints/profile")
async def update_saint_profile(updates: SaintProfileUpdate, user: dict = Depends(get_current_user)):
    await require_role(user, ["saint"])
    
    update_dict = {k: v for k, v in updates.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow().isoformat()
    
    result = await db.saint_profiles.find_one_and_update(
        {"user_id": user["id"]},
        {"$set": update_dict},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    result["id"] = str(result.pop("_id"))
    return result

@api_router.delete("/saints/profile")
async def delete_saint_profile(user: dict = Depends(get_current_user)):
    await require_role(user, ["saint"])
    
    result = await db.saint_profiles.delete_one({"user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {"message": "Profile deleted successfully"}

@api_router.get("/saints/search")
async def search_saints(
    location: Optional[str] = None,
    pooja: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {"is_approved": True, "is_active": True}
    
    if location:
        query["operating_areas"] = {"$regex": location, "$options": "i"}
    
    saints = await db.saint_profiles.find(query).to_list(1000)
    
    for saint in saints:
        saint["id"] = str(saint.pop("_id"))
    
    return saints

@api_router.get("/saints/{saint_id}")
async def get_saint_details(saint_id: str, user: dict = Depends(get_current_user)):
    saint = await db.saint_profiles.find_one({"_id": ObjectId(saint_id)})
    if not saint:
        raise HTTPException(status_code=404, detail="Saint not found")
    
    saint["id"] = str(saint.pop("_id"))
    return saint


# ==================== BOOKING ROUTES ====================
@api_router.post("/bookings")
async def create_booking(booking: BookingCreate, user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    
    saint = await db.saint_profiles.find_one({"_id": ObjectId(booking.saint_id)})
    if not saint:
        raise HTTPException(status_code=404, detail="Saint not found")
    
    base_price = 1000  # Default test base price
    platform_commission = round(base_price * 0.10)
    total_price = round(base_price + platform_commission)
    
    booking_dict = {
        "customer_id": user["id"],
        "saint_id": booking.saint_id,
        "pooja_name": booking.pooja_name,
        "booking_date": booking.booking_date,
        "booking_time": booking.booking_time,
        "address": booking.address,
        "customer_name": booking.customer_name,
        "customer_phone": booking.customer_phone,
        "base_price": base_price,
        "platform_commission": platform_commission,
        "total_price": total_price,
        "payment_status": "pending",
        "booking_status": "pending",
        "saint_action": "pending",
        "created_at": datetime.utcnow().isoformat()
    }
    
    result = await db.bookings.insert_one(booking_dict)
    booking_dict["id"] = str(result.inserted_id)
    booking_dict.pop("_id", None)
    
    return booking_dict

@api_router.get("/bookings/my-bookings")
async def get_my_bookings(user: dict = Depends(get_current_user)):
    bookings = await db.bookings.find().to_list(1000)
    for booking in bookings:
        booking["id"] = str(booking.pop("_id"))
    return bookings


# Include Router
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
