from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from typing import Optional, List
from bson import ObjectId
import logging
import os
import motor.motor_asyncio
import razorpay
import jwt
import bcrypt
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
security = HTTPBearer()

# MongoDB Setup
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client.book_your_pujari

# Razorpay Setup
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "dummy_key")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "dummy_secret")

try:
    razorpay_client = razorpay.Client(
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
    )
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


# ==================== AUTHENTICATION ====================

JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    "book-your-pujari-change-this-secret-in-render"
)

JWT_ALGORITHM = "HS256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")


def create_access_token(data: dict):
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(days=7)

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        user_id = payload.get("user_id")
        role = payload.get("role")

        if not user_id or not role:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

        try:
            object_id = ObjectId(user_id)
        except Exception:
            raise HTTPException(
                status_code=401,
                detail="Invalid user ID"
            )

        user = await db.users.find_one({
            "_id": object_id
        })

        if not user:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )

        return {
            "id": str(user["_id"]),
            "email": user.get("email", ""),
            "name": user.get("name", ""),
            "phone": user.get("phone", ""),
            "role": user.get("role", role)
        }

    except HTTPException:
        raise

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )


async def require_role(user: dict, roles: List[str]):
    if user["role"] not in roles and user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Unauthorized role access"
        )


# ==================== ADMIN ACCOUNT SETUP ====================

async def ensure_admin_account():
    admin_phone = os.environ.get("ADMIN_PHONE")
    admin_password = os.environ.get("ADMIN_PASSWORD")

    if not admin_phone or not admin_password:
        logger.warning(
            "ADMIN_PHONE or ADMIN_PASSWORD is not configured."
        )
        return

    existing_admin = await db.users.find_one({
        "phone": admin_phone
    })

    password_hash = hash_password(admin_password)

    if existing_admin:
        await db.users.update_one(
            {"_id": existing_admin["_id"]},
            {
                "$set": {
                    "role": "admin",
                    "password_hash": password_hash,
                    "phone": admin_phone,
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )

        logger.info("Admin account updated.")

    else:
        admin_user = {
            "phone": admin_phone,
            "password_hash": password_hash,
            "name": "Admin",
            "email": "",
            "role": "admin",
            "created_at": datetime.utcnow().isoformat()
        }

        await db.users.insert_one(admin_user)

        logger.info("Admin account created.")


# ==================== AUTH & LOGIN ROUTES ====================

@api_router.post("/auth/login")
async def login(credentials: UserLogin):

    user = await db.users.find_one({
        "phone": credentials.phone
    })

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid phone number or password"
        )

    password_hash = (
        user.get("password_hash")
        or user.get("password")
    )

    if not password_hash:
        raise HTTPException(
            status_code=401,
            detail="Password is not configured for this account"
        )

    if not verify_password(
        credentials.password,
        password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid phone number or password"
        )

    token = create_access_token({
        "user_id": str(user["_id"]),
        "role": user.get("role", "customer")
    })

    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user.get("email", ""),
            "name": user.get("name", ""),
            "phone": user.get("phone", ""),
            "role": user.get("role", "customer")
        }
    }


@api_router.get("/auth/me")
async def get_me(
    user: dict = Depends(get_current_user)
):
    return user


# ==================== SAINT ROUTES ====================

@api_router.post("/saints/profile")
async def create_saint_profile(
    profile: SaintProfile,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["saint"])

    existing_profile = await db.saint_profiles.find_one({
        "user_id": user["id"]
    })

    if existing_profile:
        raise HTTPException(
            status_code=400,
            detail="Profile already exists"
        )

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
async def get_my_saint_profile(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["saint"])

    profile = await db.saint_profiles.find_one({
        "user_id": user["id"]
    })

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Profile not found"
        )

    profile["id"] = str(profile.pop("_id"))

    return profile


@api_router.put("/saints/profile")
async def update_saint_profile(
    updates: SaintProfileUpdate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["saint"])

    update_dict = {
        k: v
        for k, v in updates.dict().items()
        if v is not None
    }

    update_dict["updated_at"] = datetime.utcnow().isoformat()

    result = await db.saint_profiles.find_one_and_update(
        {"user_id": user["id"]},
        {"$set": update_dict},
        return_document=True
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Profile not found"
        )

    result["id"] = str(result.pop("_id"))

    return result


@api_router.delete("/saints/profile")
async def delete_saint_profile(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["saint"])

    result = await db.saint_profiles.delete_one({
        "user_id": user["id"]
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Profile not found"
        )

    return {
        "message": "Profile deleted successfully"
    }


@api_router.get("/saints/search")
async def search_saints(
    location: Optional[str] = None,
    pooja: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {
        "is_approved": True,
        "is_active": True
    }

    if location:
        query["operating_areas"] = {
            "$regex": location,
            "$options": "i"
        }

    saints = await db.saint_profiles.find(
        query
    ).to_list(1000)

    for saint in saints:
        saint["id"] = str(saint.pop("_id"))

    return saints


@api_router.get("/saints/{saint_id}")
async def get_saint_details(
    saint_id: str,
    user: dict = Depends(get_current_user)
):
    try:
        saint = await db.saint_profiles.find_one({
            "_id": ObjectId(saint_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid saint ID"
        )

    if not saint:
        raise HTTPException(
            status_code=404,
            detail="Saint not found"
        )

    saint["id"] = str(saint.pop("_id"))

    return saint


# ==================== BOOKING ROUTES ====================

@api_router.post("/bookings")
async def create_booking(
    booking: BookingCreate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["customer"])

    try:
        saint = await db.saint_profiles.find_one({
            "_id": ObjectId(booking.saint_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid saint ID"
        )

    if not saint:
        raise HTTPException(
            status_code=404,
            detail="Saint not found"
        )

    base_price = 1000
    platform_commission = round(base_price * 0.10)
    total_price = round(
        base_price + platform_commission
    )

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

    result = await db.bookings.insert_one(
        booking_dict
    )

    booking_dict["id"] = str(result.inserted_id)
    booking_dict.pop("_id", None)

    return booking_dict


@api_router.get("/bookings/my-bookings")
async def get_my_bookings(
    user: dict = Depends(get_current_user)
):
    bookings = await db.bookings.find().to_list(1000)

    for booking in bookings:
        booking["id"] = str(booking.pop("_id"))

    return bookings


# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/dashboard")
async def admin_dashboard(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    total_bookings = await db.bookings.count_documents({})

    paid_bookings = await db.bookings.count_documents({
        "payment_status": "paid"
    })

    active_saints = await db.saint_profiles.count_documents({
        "is_active": True,
        "is_approved": True
    })

    pending_saints = await db.saint_profiles.count_documents({
        "is_approved": False
    })

    pending_bookings = await db.bookings.count_documents({
        "booking_status": "pending"
    })

    revenue_result = await db.bookings.aggregate([
        {
            "$match": {
                "payment_status": "paid"
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {
                    "$sum": "$platform_commission"
                }
            }
        }
    ]).to_list(1)

    revenue = 0

    if revenue_result:
        revenue = revenue_result[0].get(
            "total",
            0
        )

    return {
        "total_bookings": total_bookings,
        "paid_bookings": paid_bookings,
        "active_saints": active_saints,
        "pending_saints": pending_saints,
        "pending_bookings": pending_bookings,
        "revenue": revenue
    }


@api_router.get("/admin/bookings")
async def admin_get_bookings(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    bookings = await db.bookings.find().to_list(1000)

    for booking in bookings:
        booking["id"] = str(booking.pop("_id"))

    return bookings


# ==================== STARTUP ====================

@app.on_event("startup")
async def startup_event():
    await ensure_admin_account()


# ==================== INCLUDE ROUTER ====================

app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
