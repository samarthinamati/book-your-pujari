import asyncio
import uuid

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, List
from bson import ObjectId
import logging
import math
import os
import httpx
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



# ==================== DELHIVERY CONFIGURATION ====================

DELHIVERY_API_TOKEN = os.getenv("DELHIVERY_API_TOKEN", "").strip()

# Automatic read-only tracking
# Tracking is read-only, so enable it by default when a Delhivery token is present.
# Set DELHIVERY_AUTO_TRACKING_ENABLED=false in Render to turn it off.
DELHIVERY_AUTO_TRACKING_ENABLED = (
    os.getenv("DELHIVERY_AUTO_TRACKING_ENABLED", "true").strip().lower() == "true"
)
DELHIVERY_AUTO_TRACKING_INTERVAL_SECONDS = max(
    300, int(os.getenv("DELHIVERY_AUTO_TRACKING_INTERVAL_SECONDS", "900"))
)
DELHIVERY_AUTO_TRACKING_BATCH_SIZE = max(
    1, min(100, int(os.getenv("DELHIVERY_AUTO_TRACKING_BATCH_SIZE", "50")))
)

# Keep shipment creation disabled
DELHIVERY_TEST_MODE = (
    os.getenv("DELHIVERY_TEST_MODE", "true").strip().lower() == "true"
)
DELHIVERY_LIVE_SHIPMENTS_ENABLED = (
    os.getenv("DELHIVERY_LIVE_SHIPMENTS_ENABLED", "false")
    .strip()
    .lower() == "true"
)

# Existing shipment environment (leave unchanged)
# Production is selected only by an explicit environment setting.
# Set DELHIVERY_ENV=production for a live account or DELHIVERY_ENV=staging
# for sandbox testing. DELHIVERY_BASE_URL can override either URL.
DELHIVERY_ENV = os.getenv("DELHIVERY_ENV", "production").strip().lower()
if DELHIVERY_ENV not in {"production", "staging"}:
    raise RuntimeError("DELHIVERY_ENV must be either 'production' or 'staging'.")
_DEFAULT_DELHIVERY_BASE_URL = (
    "https://track.delhivery.com"
    if DELHIVERY_ENV == "production"
    else "https://staging-express.delhivery.com"
)
DELHIVERY_BASE_URL = os.getenv(
    "DELHIVERY_BASE_URL",
    _DEFAULT_DELHIVERY_BASE_URL,
).strip().rstrip("/")

# Separate production tracking environment
DELHIVERY_TRACKING_BASE_URL = os.getenv(
    "DELHIVERY_TRACKING_BASE_URL",
    "https://track.delhivery.com"
).strip().rstrip("/")

DELHIVERY_WAREHOUSE_URL = (
    f"{DELHIVERY_BASE_URL}/api/backend/clientwarehouse/create/"
)
DELHIVERY_SHIPMENT_URL = (
    f"{DELHIVERY_BASE_URL}/api/cmu/create.json"
)
DELHIVERY_TRACKING_URL = (
    f"{DELHIVERY_TRACKING_BASE_URL}/api/v1/packages/json/"
)
DELHIVERY_PICKUP_REQUEST_URL = (
    f"{DELHIVERY_BASE_URL}/fm/request/new/"
)

DELHIVERY_PICKUP_TIME = os.getenv(
    "DELHIVERY_PICKUP_TIME", "12:00:00"
).strip()

DELHIVERY_EXISTING_PICKUP_NAME = "PUJARIGO B2C"

# ==================== END DELHIVERY CONFIGURATION ====================

# Razorpay Setup
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "dummy_key")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "dummy_secret")

try:
    razorpay_client = razorpay.Client(
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
    )
except Exception:
    razorpay_client = None

# ==================== DELHIVERY WAREHOUSE MODELS ====================

class DelhiveryWarehouseResponse(BaseModel):
    message: str
    delhivery_pickup_name: str
    delhivery_pickup_status: str


class DelhiveryShippingEstimateRequest(BaseModel):
    pickup_pincode: str = Field(..., min_length=6, max_length=6)
    delivery_pincode: str = Field(..., min_length=6, max_length=6)
    weight_grams: int = Field(..., gt=0, le=100000)
    payment_mode: str = Field(default="Pre-paid")
    shipping_mode: str = Field(default="E")


class StoreCartShippingEstimateItem(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=1, le=50)


class StoreCartShippingEstimateRequest(BaseModel):
    items: List[StoreCartShippingEstimateItem]
    delivery_pincode: str = Field(..., min_length=6, max_length=6)
    payment_method: str = Field(default="online")


# ==================== DELHIVERY SHIPPING RATE ESTIMATE ====================





# ==================== PYDANTIC MODELS ====================

class UserLogin(BaseModel):
    phone: str
    password: Optional[str] = None
    role: Optional[str] = None


class UserRegister(BaseModel):
    name: str
    phone: str
    password: Optional[str] = None
    role: str = "customer"

class SellerApplication(BaseModel):
    shop_name: str = Field(..., min_length=2, max_length=120)
    owner_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=5, max_length=20)
    password: str = Field(..., min_length=4, max_length=128)
    email: str = Field(default="", max_length=254)
    shop_address: str = Field(..., min_length=5, max_length=1000)
    city: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., pattern=r"^[0-9]{6}$")

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

class SellerApprovalRequest(BaseModel):
    approved: bool

class SellerPickupDaysUpdate(BaseModel):
    pickup_days: List[str]
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
@api_router.post("/store/shipping/estimate")
async def estimate_store_shipping(
    payload: StoreCartShippingEstimateRequest,
    user: dict = Depends(get_current_user),
):
    """Estimate the cart's Delhivery charge using the approved seller pickup PIN."""
    await require_role(user, ["customer", "admin"])

    delivery_pincode = payload.delivery_pincode.strip()
    if not delivery_pincode.isdigit() or len(delivery_pincode) != 6:
        raise HTTPException(status_code=400, detail="Enter a valid six-digit delivery PIN code")

    payment_method = payload.payment_method.strip().lower()
    if payment_method not in {"online", "cod"}:
        raise HTTPException(status_code=400, detail="Invalid payment method")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    seller_id = None
    pickup_pincode = ""
    total_weight_grams = 0

    for item in payload.items:
        try:
            product_oid = ObjectId(item.product_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid product ID")

        product = await db.store_products.find_one({"_id": product_oid, "is_available": True})
        if not product:
            raise HTTPException(status_code=400, detail="A cart product is unavailable")
        if int(product.get("stock", 0)) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product.get('name', 'product')}")

        current_seller_id = str(product.get("seller_id", "")).strip()
        if not current_seller_id:
            raise HTTPException(status_code=400, detail="Product has no assigned seller")

        seller = await db.seller_applications.find_one({"user_id": current_seller_id, "status": "approved"})
        if not seller:
            raise HTTPException(status_code=400, detail="Product seller is not approved")

        current_pickup_pincode = str(seller.get("pincode", "")).strip()
        if not current_pickup_pincode.isdigit() or len(current_pickup_pincode) != 6:
            raise HTTPException(status_code=400, detail="Seller pickup PIN code is invalid")

        # Require a confirmed seller warehouse before quoting a live shipment.
        if seller.get("delhivery_pickup_status") != "registered" or seller.get("delhivery_pickup_verified") is not True:
            raise HTTPException(status_code=409, detail="Seller's Delhivery pickup location is not yet registered and verified")

        if seller_id is None:
            seller_id = current_seller_id
            pickup_pincode = current_pickup_pincode
        elif seller_id != current_seller_id:
            raise HTTPException(status_code=400, detail="Please place separate orders for products from different sellers.")

        item_weight = max(int(product.get("weight_grams", 500)), 1)
        total_weight_grams += item_weight * item.quantity

    shipping_fee = await get_delhivery_shipping_fee(
        pickup_pincode=pickup_pincode,
        delivery_pincode=delivery_pincode,
        weight_grams=total_weight_grams,
        payment_mode="COD" if payment_method == "cod" else "Pre-paid",
        shipping_mode="S",
    )

    return {
        "provider": "Delhivery",
        "currency": "INR",
        "shipping_mode": "S",
        "payment_mode": "COD" if payment_method == "cod" else "Pre-paid",
        "pickup_pincode": pickup_pincode,
        "delivery_pincode": delivery_pincode,
        "weight_grams": total_weight_grams,
        "shipping_fee": shipping_fee,
        "note": "Estimated charges only. Final courier charges may differ.",
    }


@api_router.post("/store/admin/delhivery/connection-test")
async def test_delhivery_api_connection(
    payload: DelhiveryShippingEstimateRequest,
    user: dict = Depends(get_current_user),
):
    """Safely verify the configured Delhivery API using a rate quote only.

    This endpoint never creates a shipment, AWB, warehouse, or pickup request.
    It deliberately does not change either shipment safety environment flag.
    """
    await require_role(user, ["admin"])

    shipping_fee = await get_delhivery_shipping_fee(
        pickup_pincode=payload.pickup_pincode,
        delivery_pincode=payload.delivery_pincode,
        weight_grams=payload.weight_grams,
        payment_mode=payload.payment_mode,
        shipping_mode=payload.shipping_mode,
    )

    return {
        "success": True,
        "provider": "Delhivery",
        "connection": "authenticated_rate_request_succeeded",
        "environment": "staging" if "staging" in DELHIVERY_BASE_URL.lower() else "production_or_custom",
        "rate_quote_received": True,
        "estimated_shipping_fee": shipping_fee,
        "shipment_created": False,
        "awb_created": False,
        "pickup_requested": False,
        "test_mode_unchanged": True,
        "live_shipments_flag_unchanged": True,
    }


async def get_delhivery_shipping_fee(
    pickup_pincode: str,
    delivery_pincode: str,
    weight_grams: int,
    payment_mode: str,
    shipping_mode: str = "S",
) -> float:
    """Return Delhivery's estimated shipping charge in INR."""
    if not DELHIVERY_API_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Shipping rate service is not configured",
        )

    pickup_pincode = str(pickup_pincode).strip()
    delivery_pincode = str(delivery_pincode).strip()
    if (
        not pickup_pincode.isdigit() or len(pickup_pincode) != 6
        or not delivery_pincode.isdigit() or len(delivery_pincode) != 6
    ):
        raise HTTPException(
            status_code=400,
            detail="Valid six-digit pickup and delivery PIN codes are required",
        )

    if payment_mode not in {"Pre-paid", "COD"}:
        raise HTTPException(status_code=400, detail="Invalid shipping payment mode")
    if shipping_mode not in {"E", "S"}:
        raise HTTPException(status_code=400, detail="Invalid shipping mode")
    if int(weight_grams) < 1:
        raise HTTPException(status_code=400, detail="Package weight must be positive")

    params = {
        "md": shipping_mode,
        "cgm": int(weight_grams),
        "o_pin": pickup_pincode,
        "d_pin": delivery_pincode,
        "ss": "Delivered",
        "pt": payment_mode,
    }
    headers = {
        "Authorization": f"Token {DELHIVERY_API_TOKEN}",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"{DELHIVERY_BASE_URL}/api/kinko/v1/invoice/charges/.json",
                params=params,
                headers=headers,
            )
        if response.status_code >= 400:
            logger.error(
                "Delhivery rate estimate failed: HTTP %s; response=%s",
                response.status_code,
                response.text[:500],
            )
            raise HTTPException(
                status_code=502,
                detail=f"Delhivery rate request failed (HTTP {response.status_code}). Check the backend logs and live account permissions.",
            )
        rate_data = response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Shipping estimate request timed out")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Unable to contact shipping service")
    except ValueError:
        raise HTTPException(status_code=502, detail="Invalid response from shipping service")

    if not isinstance(rate_data, list) or not rate_data or not isinstance(rate_data[0], dict):
        raise HTTPException(status_code=502, detail="No valid shipping rate was returned")
    try:
        shipping_fee = float(rate_data[0]["total_amount"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="Invalid shipping fee returned by Delhivery")
    if not math.isfinite(shipping_fee) or shipping_fee < 0:
        raise HTTPException(status_code=502, detail="Invalid shipping fee returned by Delhivery")
    return round(shipping_fee, 2)




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

@api_router.post("/auth/register")
async def register(credentials: UserRegister):
    phone = credentials.phone.strip()
    name = credentials.name.strip()
    role = credentials.role if credentials.role in ["customer", "saint"] else "customer"
    password = (credentials.password or "").strip()

    if not name or not phone:
        raise HTTPException(
            status_code=400,
            detail="Name and phone number are required"
        )

    # Customers register with phone only. Saints must create a password.
    if role == "saint" and len(password) < 4:
        raise HTTPException(
            status_code=400,
            detail="Saint password must be at least 4 characters"
        )

    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this phone number already exists"
        )

    user = {
        "name": name,
        "phone": phone,
        "email": "",
        "role": role,
        "created_at": datetime.utcnow().isoformat(),
    }

    if role == "saint":
        user["password_hash"] = hash_password(password)

    result = await db.users.insert_one(user)
    user_id = str(result.inserted_id)

    token = create_access_token({
        "user_id": user_id,
        "role": role
    })

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": "",
            "name": name,
            "phone": phone,
            "role": role,
        },
    }

# ==================== SELLER APPLICATION ====================

@api_router.post("/store/seller/apply")
async def apply_as_seller(application: SellerApplication):
    """Submit a seller application without requiring a prior login.

    A new phone number gets a customer account first. Seller privileges are
    granted only by the existing admin approval endpoint.
    """
    phone = application.phone.strip()
    owner_name = application.owner_name.strip()
    shop_name = application.shop_name.strip()
    password = application.password.strip()
    email = application.email.strip()
    shop_address = application.shop_address.strip()
    city = application.city.strip()
    pincode = application.pincode.strip()

    if not phone or not owner_name or not shop_name:
        raise HTTPException(status_code=400, detail="Owner name, shop name and phone number are required")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    existing_user = await db.users.find_one({"phone": phone})
    if existing_user and existing_user.get("role", "customer") != "customer":
        raise HTTPException(status_code=409, detail="This phone number already belongs to another account type")

    existing_application = await db.seller_applications.find_one({
        "phone": phone,
        "status": {"$in": ["pending", "approved"]}
    })
    if existing_application:
        raise HTTPException(status_code=409, detail="A seller application already exists for this phone number")

    if existing_user:
        user_id = str(existing_user["_id"])
        # Keep the existing customer's profile, but update email if it is blank.
        if email and not existing_user.get("email"):
            await db.users.update_one({"_id": existing_user["_id"]}, {"$set": {"email": email}})
    else:
        customer = {
            "name": owner_name,
            "phone": phone,
            "email": email,
            "role": "customer",
            "created_at": datetime.utcnow().isoformat(),
        }
        try:
            result = await db.users.insert_one(customer)
            user_id = str(result.inserted_id)
        except Exception:
            # Re-check in case another registration request used this phone concurrently.
            existing_user = await db.users.find_one({"phone": phone})
            if not existing_user:
                raise HTTPException(status_code=500, detail="Could not create the account. Please try again.")
            if existing_user.get("role", "customer") != "customer":
                raise HTTPException(status_code=409, detail="This phone number already belongs to another account type")
            user_id = str(existing_user["_id"])

    seller_application = {
        "user_id": user_id,
        "password_hash": hash_password(password),
        "shop_name": shop_name,
        "owner_name": owner_name,
        "phone": phone,
        "email": email,
        "shop_address": shop_address,
"city": city,
"pincode": pincode,

# Delhivery pickup-location details
"delhivery_pickup_name": "",
"delhivery_pickup_status": "not_registered",
"delhivery_pickup_id": "",
"delhivery_pickup_verified": False,       

"status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }

    try:
        result = await db.seller_applications.insert_one(seller_application)
    except Exception:
        raise HTTPException(status_code=409, detail="Could not submit the application. Please try again.")

    return {
        "id": str(result.inserted_id),
        "status": "pending",
        "message": "Seller application submitted for admin approval"
    }

# ==================== ADMIN SELLER APPROVAL ====================

@api_router.get("/store/admin/seller-applications")
async def list_seller_applications(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    applications = await db.seller_applications.find(
        {}
    ).sort("created_at", -1).to_list(500)

    results = []

    for application in applications:
        results.append({
            "id": str(application["_id"]),
            "user_id": application.get("user_id", ""),
            "shop_name": application.get("shop_name", ""),
            "owner_name": application.get("owner_name", ""),
            "phone": application.get("phone", ""),
            "email": application.get("email", ""),
"shop_address": application.get("shop_address", ""),
"city": application.get("city", ""),
"pincode": application.get("pincode", ""),

"delhivery_pickup_name": application.get(
    "delhivery_pickup_name", ""
),
"delhivery_pickup_status": application.get(
    "delhivery_pickup_status", "not_registered"
),
"delhivery_pickup_id": application.get(
    "delhivery_pickup_id", ""
),

"status": application.get("status", "pending"),
            "created_at": application.get("created_at", ""),
        })

    return results


@api_router.put("/store/admin/seller-applications/{application_id}")
async def review_seller_application(
    application_id: str,
    payload: SellerApprovalRequest,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    try:
        application_object_id = ObjectId(application_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid application ID"
        )

    application = await db.seller_applications.find_one({
        "_id": application_object_id
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Seller application not found"
        )
   

    if application.get("status") != "pending":
        raise HTTPException(
            status_code=400,
            detail="This application has already been reviewed"
        )

    new_status = "approved" if payload.approved else "rejected"

    await db.seller_applications.update_one(
        {"_id": application_object_id},
        {"$set": {
            "status": new_status,
            "reviewed_at": datetime.utcnow().isoformat(),
            "reviewed_by": user["id"],
        }}
    )

    if payload.approved:
        await db.users.update_one(
            {"_id": ObjectId(application["user_id"]), "role": "customer"},
            {
                "$set": {
                    "role": "seller",
                    "password_hash": application.get("password_hash"),
                }
            }
        )

    return {
        "message": f"Seller application {new_status}",
        "status": new_status,
    }
    # ==================== SELLER PICKUP DAY SETTINGS ====================

SELLER_PICKUP_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


@api_router.get("/store/seller/pickup-settings")
async def get_seller_pickup_settings(
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Approved seller application not found",
        )

    return {
        "pickup_days": application.get("pickup_days", []),
        "available_days": SELLER_PICKUP_DAYS,
    }


@api_router.put("/store/seller/pickup-settings")
async def update_seller_pickup_settings(
    payload: SellerPickupDaysUpdate,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Approved seller application not found",
        )

    selected_days = []

    for day in payload.pickup_days:
        normalized_day = day.strip().capitalize()

        if normalized_day not in SELLER_PICKUP_DAYS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid pickup day: {day}",
            )

        if normalized_day not in selected_days:
            selected_days.append(normalized_day)

    if not selected_days:
        raise HTTPException(
            status_code=400,
            detail="Please select at least one pickup day",
        )

    await db.seller_applications.update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "pickup_days": selected_days,
                "pickup_days_updated_at": datetime.utcnow().isoformat(),
            }
        },
    )

    return {
        "message": "Pickup days saved successfully",
        "pickup_days": selected_days,
    }


class SellerPickupLocationUpdate(BaseModel):
    delhivery_pickup_name: str = Field(..., min_length=2, max_length=120)

class SellerPickupVerificationRequest(BaseModel):
    confirmed_in_delhivery: bool = False


@api_router.put(
    "/store/admin/seller-applications/{application_id}/verify-pickup"
)
async def verify_seller_pickup_location(
    application_id: str,
    payload: SellerPickupVerificationRequest,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])

    if payload.confirmed_in_delhivery is not True:
        raise HTTPException(
            status_code=400,
            detail="Confirm the warehouse in Delhivery before verification.",
        )

    try:
        application_object_id = ObjectId(application_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid seller application ID",
        )

    application = await db.seller_applications.find_one({
        "_id": application_object_id,
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Approved seller application not found",
        )

    if application.get("delhivery_pickup_status") != "verification_pending":
        raise HTTPException(
            status_code=400,
            detail="This pickup location is not awaiting verification.",
        )

    required_fields = [
        "delhivery_pickup_name",
        "shop_address",
        "city",
        "pincode",
    ]

    if any(not str(application.get(field, "")).strip()
           for field in required_fields):
        raise HTTPException(
            status_code=400,
            detail="Seller pickup address details are incomplete.",
        )

    await db.seller_applications.update_one(
        {"_id": application_object_id},
        {
            "$set": {
                "delhivery_pickup_status": "registered",
                "delhivery_pickup_verified": True,
                "delhivery_pickup_verified_at": datetime.utcnow().isoformat(),
                "delhivery_pickup_verified_by": user["id"],
            }
        },
    )

    return {
        "message": "Seller pickup location marked as verified.",
        "delhivery_pickup_status": "registered",
        "delhivery_pickup_verified": True,
    }



@api_router.put("/store/admin/seller-applications/{application_id}/pickup-location")
async def update_seller_pickup_location(
    application_id: str,
    payload: SellerPickupLocationUpdate,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])

    # Validate seller application ID.
    try:
        application_object_id = ObjectId(application_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid seller application ID",
        )

    application = await db.seller_applications.find_one({
        "_id": application_object_id,
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Seller application not found",
        )
    if application.get("status") != "approved":
        raise HTTPException(
            status_code=400,
            detail="Please approve the seller application before registering its pickup location.",
    )

    pickup_name = payload.delhivery_pickup_name.strip()

   
    if len(pickup_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Enter a valid Delhivery pickup-location name",
        )

    # Test mode: simulate registration without contacting Delhivery.
    if DELHIVERY_TEST_MODE:
        pickup_name = payload.delhivery_pickup_name.strip()

        if len(pickup_name) < 2:
            raise HTTPException(
                status_code=400,
                detail="Enter a valid test pickup-location name",
            )

        await db.seller_applications.update_one(
            {"_id": application_object_id},
            {
                "$set": {
                    "delhivery_pickup_name": pickup_name,
                    "delhivery_pickup_status": "test_registered",
                    "delhivery_registration_response": {
                        "test_mode": True,
                        "message": "Simulated registration; Delhivery was not contacted.",
                    },
                    "updated_at": datetime.utcnow().isoformat(),
                }
            },
        )

        return {
            "message": (
                "Test registration successful. No request was sent to Delhivery."
            ),
            "delhivery_pickup_name": pickup_name,
            "delhivery_pickup_status": "test_registered",
            "test_mode": True,
        }

        
    # Allow seller pickup registration only when explicitly enabled.
    if not DELHIVERY_LIVE_SHIPMENTS_ENABLED:
        raise HTTPException(
            status_code=403,
            detail=(
                "Seller pickup registration is disabled. "
                "Confirm Delhivery API access before enabling it."
            ),
        )

    if application.get("delhivery_pickup_status") in [
        "registered",
        "verification_pending",
        "registration_in_progress",
    ]:
        raise HTTPException(
            status_code=409,
            detail=(
                "A warehouse registration already exists or is in progress. "
                "Verify its status in Delhivery before trying again."
            ),
        )

    if not DELHIVERY_API_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Delhivery API token is not configured on the server",
        )

    # Read the actual seller details from the application.
    shop_name = str(application.get("shop_name", "")).strip()
    owner_name = str(application.get("owner_name", "")).strip()
    phone = str(application.get("phone", "")).strip()
    email = str(application.get("email", "")).strip()
    address = str(application.get("shop_address", "")).strip()
    city = str(application.get("city", "")).strip()
    pincode = str(application.get("pincode", "")).strip()

    missing = [
        field for field, value in {
            "shop_name": shop_name,
            "owner_name": owner_name,
            "phone": phone,
            "shop_address": address,
            "city": city,
            "pincode": pincode,
        }.items()
        if not value
    ]

    if missing:
        raise HTTPException(
            status_code=400,
            detail="Seller application is missing required details: "
                   + ", ".join(missing),
        )

    # Delhivery requires a return address too.
    # This uses the seller's shop address as the return address.
    warehouse_payload = {
        "name": pickup_name,
        "registered_name": shop_name or owner_name,
        "phone": phone,
        "address": address,
        "city": city,
        "pin": pincode,
        "country": "India",
        "return_address": address,
        "return_city": city,
        "return_pin": pincode,
        "return_country": "India",
    }

    if email:
        warehouse_payload["email"] = email

    headers = {
        "Authorization": f"Token {DELHIVERY_API_TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    # Do not mark the warehouse as registered unless Delhivery confirms
    # a successful response. A timeout can leave the result uncertain.
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                DELHIVERY_WAREHOUSE_URL,
                headers=headers,
                json=warehouse_payload,
            )
    except httpx.TimeoutException as exc:
        logger.warning(
            "Delhivery warehouse registration timed out for application %s",
            application_id,
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Delhivery did not respond in time. Registration status "
                "is uncertain; check Delhivery before retrying."
            ),
        ) from exc
    except httpx.RequestError as exc:
        logger.exception("Delhivery warehouse request failed")
        raise HTTPException(
            status_code=502,
            detail="Unable to contact Delhivery. Please try again later.",
        ) from exc

    try:
        result_data = response.json()
    except ValueError:
        result_data = {}

    # Delhivery may return an HTTP error or an application-level error.
    if not response.is_success:
        logger.error(
            "Delhivery warehouse registration failed: HTTP %s",
            response.status_code,
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Delhivery rejected the warehouse registration. "
                "Check the seller details and Delhivery account."
            ),
        )

    if (
        isinstance(result_data, dict)
        and (
            result_data.get("success") is False
            or result_data.get("status") == "Failed"
            or result_data.get("error")
            or result_data.get("errors")
        )
    ):
        logger.warning(
            "Delhivery returned a warehouse registration error for %s",
            application_id,
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Delhivery did not confirm warehouse registration. "
                "Check the details and Delhivery response before retrying."
            ),
        )

    # Store the exact pickup name and registration result after a
    # successful HTTP response without a reported application error.
    await db.seller_applications.update_one(
        {"_id": application_object_id},
        {
            "$set": {
                "delhivery_pickup_name": pickup_name,
                "delhivery_pickup_status": "verification_pending",
                "delhivery_pickup_verified": False,
                "delhivery_pickup_id": str(
                    result_data.get("id", "")
                    if isinstance(result_data, dict)
                    else ""
                ),
                "delhivery_registration_response": result_data,
                "updated_at": datetime.utcnow().isoformat(),
            }
        },
    )

    return {
        "message": (
            "Delhivery accepted the registration request. "
            "Verify the warehouse in Delhivery before using it for shipments."
        ),
        "delhivery_pickup_name": pickup_name,
        "delhivery_pickup_status": "verification_pending",
    }


@api_router.put(
    "/store/admin/seller-applications/{application_id}/use-existing-pickup"
)
async def use_existing_delhivery_pickup(
    application_id: str,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])
    raise HTTPException(
        status_code=403,
        detail=(
            "Shared pickup locations are disabled. Each approved seller "
            "must have a separate Delhivery warehouse."
        ),
    )


@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    phone = credentials.phone.strip()

    if not phone:
        raise HTTPException(
            status_code=400,
            detail="Phone number is required"
        )

    user = await db.users.find_one({"phone": phone})

    if not user:
        raise HTTPException(
            status_code=401,
            detail="No account found for this phone number"
        )

    actual_role = user.get("role", "customer")
    requested_role = (credentials.role or "").strip().lower()

    if requested_role and requested_role != actual_role:
        raise HTTPException(
            status_code=403,
            detail="This phone number is not registered for the selected account type"
        )

    # Customers continue using phone-only login.
    # Saints, admins, and sellers must use their password.
    if actual_role in ["saint", "admin", "seller"]:
        password = credentials.password or ""
        password_hash = user.get("password_hash") or user.get("password")

        if (
            not password
            or not password_hash
            or not verify_password(password, password_hash)
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid phone number or password"
            )

    elif actual_role != "customer":
        raise HTTPException(
            status_code=403,
            detail="Unsupported account type"
        )

    token = create_access_token({
        "user_id": str(user["_id"]),
        "role": actual_role
    })

    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user.get("email", ""),
            "name": user.get("name", ""),
            "phone": user.get("phone", ""),
            "role": actual_role
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

    profile = await db.saint_profiles.find_one({
        "user_id": user["id"]
    })

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Profile not found"
        )

    update_dict = {}

    if updates.name is not None:
        update_dict["name"] = updates.name.strip()

    if updates.location is not None:
        update_dict["location"] = updates.location.strip()

    if updates.operating_areas is not None:
        update_dict["operating_areas"] = [
            area.strip()
            for area in updates.operating_areas
            if area and area.strip()
        ]

    if updates.poojas is not None:
        update_dict["poojas"] = updates.poojas

    if updates.is_active is not None:
        update_dict["is_active"] = updates.is_active

    update_dict["updated_at"] = datetime.utcnow().isoformat()

    await db.saint_profiles.update_one(
        {"_id": profile["_id"]},
        {"$set": update_dict}
    )

    updated_profile = await db.saint_profiles.find_one({
        "_id": profile["_id"]
    })

    updated_profile["id"] = str(updated_profile.pop("_id"))

    return updated_profile


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
        "is_active": True
    }

    if location:
        query["operating_areas"] = {
            "$regex": location.strip(),
            "$options": "i"
        }

    if pooja:
        query["poojas.name"] = {
            "$regex": pooja.strip(),
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

    if not saint.get("is_active", True):
        raise HTTPException(
            status_code=400,
            detail="This Saint is currently unavailable"
        )

    # Find the price set by the Saint for the selected pooja.
    selected_pooja = None

    for pooja in saint.get("poojas", []):
        if (
            str(pooja.get("name", "")).strip().lower()
            == booking.pooja_name.strip().lower()
        ):
            selected_pooja = pooja
            break

    if not selected_pooja:
        raise HTTPException(
            status_code=404,
            detail="Selected pooja was not found for this Saint"
        )

    try:
        base_price = float(selected_pooja.get("price", 0))
    except (TypeError, ValueError):
        base_price = 0

    if base_price <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid price set for this pooja"
        )

    # Platform commission = 10% of Saint's price.
    # Total is rounded UP to the next whole rupee.
    import math

    total_price = math.ceil(base_price * 1.10)
    platform_commission = total_price - base_price

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
async def get_my_bookings(
    user: dict = Depends(get_current_user)
):
    if user.get("role") == "customer":
        query = {
            "customer_id": user["id"]
        }

    elif user.get("role") == "saint":
        profile = await db.saint_profiles.find_one({
            "user_id": user["id"]
        })

        if not profile:
            return []

        query = {
            "saint_id": str(profile["_id"]),
            "payment_status": "paid"
        }

    else:
        query = {}

    bookings = await db.bookings.find(
        query
    ).sort(
        "created_at",
        -1
    ).to_list(1000)

    for booking in bookings:
        booking["id"] = str(booking.pop("_id"))

    return bookings


# ==================== PAYMENT ROUTES ====================

@api_router.post(
    "/payment/create-order",
    response_model=PaymentOrderResponse
)
async def create_payment_order(
    payload: PaymentOrderCreate,
    user: dict = Depends(get_current_user)
):
    booking = await db.bookings.find_one({
        "_id": ObjectId(payload.booking_id)
    })

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if (
        booking.get("customer_id") != user["id"]
        and user.get("role") != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail="Unauthorized booking access"
        )

    if razorpay_client is None:
        raise HTTPException(
            status_code=500,
            detail="Payment service is not configured"
        )

    amount = int(booking.get("total_price", 0) * 100)

    try:
        order = razorpay_client.order.create({
            "amount": amount,
            "currency": "INR",
            "receipt": payload.booking_id,
            "payment_capture": 1,
        })
    except Exception as exc:
        logger.exception("Razorpay order creation failed")
        raise HTTPException(
            status_code=502,
            detail="Unable to create payment order"
        ) from exc

    await db.bookings.update_one(
        {"_id": booking["_id"]},
        {"$set": {"razorpay_order_id": order["id"]}}
    )

    return {
        "order_id": order["id"],
        "amount": amount,
        "currency": "INR",
        "booking_id": payload.booking_id,
        "key_id": RAZORPAY_KEY_ID,
    }


@api_router.post("/payment/verify")
async def verify_payment(
    payload: PaymentVerify,
    user: dict = Depends(get_current_user)
):
    booking = await db.bookings.find_one({
        "_id": ObjectId(payload.booking_id)
    })

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if (
        booking.get("customer_id") != user["id"]
        and user.get("role") != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail="Unauthorized booking access"
        )

    if razorpay_client is None:
        raise HTTPException(
            status_code=500,
            detail="Payment service is not configured"
        )

    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
        })
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Payment verification failed"
        ) from exc

    await db.bookings.update_one(
        {"_id": booking["_id"]},
        {"$set": {
            "payment_status": "paid",
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
            "booking_status": "pending",
            "paid_at": datetime.utcnow().isoformat(),
        }}
    )

    return {
        "message": "Payment verified successfully",
        "booking_id": payload.booking_id
    }


# ==================== REVIEW ROUTES ====================

@api_router.post("/reviews")
async def create_review(
    review: ReviewCreate,
    user: dict = Depends(get_current_user)
):
    if user.get("role") != "customer":
        raise HTTPException(
            status_code=403,
            detail="Only customers can submit reviews"
        )

    if review.rating < 1 or review.rating > 5:
        raise HTTPException(
            status_code=400,
            detail="Rating must be between 1 and 5"
        )

    booking = await db.bookings.find_one({
        "_id": ObjectId(review.booking_id)
    })

    if not booking or booking.get("customer_id") != user["id"]:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    if booking.get("payment_status") != "paid":
        raise HTTPException(
            status_code=400,
            detail="Only paid bookings can be reviewed"
        )

    existing = await db.reviews.find_one({
        "booking_id": review.booking_id
    })

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Review already submitted"
        )

    review_doc = {
        "booking_id": review.booking_id,
        "saint_id": review.saint_id,
        "customer_id": user["id"],
        "rating": review.rating,
        "comment": review.comment.strip(),
        "created_at": datetime.utcnow().isoformat(),
    }

    result = await db.reviews.insert_one(review_doc)
    review_doc["id"] = str(result.inserted_id)
    review_doc.pop("_id", None)

    return review_doc


@api_router.get("/reviews/saint/{saint_id}")
async def get_saint_reviews(
    saint_id: str,
    user: dict = Depends(get_current_user)
):
    reviews = await db.reviews.find(
        {"saint_id": saint_id}
    ).sort(
        "created_at",
        -1
    ).to_list(1000)

    for review in reviews:
        review["id"] = str(review.pop("_id"))

    return reviews


# ==================== SAINT BOOKING ACTION ====================

@api_router.put("/bookings/{booking_id}/saint-action")
async def saint_booking_action(
    booking_id: str,
    action: SaintActionRequest,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["saint"])

    if action.action not in ["accept", "reject"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid booking action"
        )

    try:
        booking = await db.bookings.find_one({
            "_id": ObjectId(booking_id)
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid booking ID"
        )

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found"
        )

    # Customer must complete payment before Saint can accept or reject.
    if booking.get("payment_status") != "paid":
        raise HTTPException(
            status_code=400,
            detail="Customer has not completed payment yet"
        )

    if booking.get("saint_id") is None:
        raise HTTPException(
            status_code=400,
            detail="Booking has no saint"
        )

    profile = await db.saint_profiles.find_one({
        "_id": ObjectId(booking["saint_id"])
    })

    if not profile or profile.get("user_id") != user["id"]:
        raise HTTPException(
            status_code=403,
            detail="This booking is not assigned to you"
        )

    status_value = (
        "accepted" if action.action == "accept" else "rejected"
    )

    update = {
        "saint_action": status_value,
        "updated_at": datetime.utcnow().isoformat()
    }

    if action.action == "accept":
        update["booking_status"] = "confirmed"
    else:
        update["booking_status"] = "rejected"

    await db.bookings.update_one(
        {"_id": booking["_id"]},
        {"$set": update}
    )

    return {
        "message": f"Booking {action.action}ed successfully",
        "booking_id": booking_id,
        "saint_action": status_value
    }


# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/analytics")
async def admin_analytics(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    total_bookings = await db.bookings.count_documents({})
    paid_bookings = await db.bookings.count_documents({
        "payment_status": "paid"
    })
    active_saints = await db.saint_profiles.count_documents({
        "is_active": True
    })
    pending_saints = 0
    total_saints = await db.saint_profiles.count_documents({})
    pending_bookings = await db.bookings.count_documents({
        "booking_status": "pending"
    })

    revenue_result = await db.bookings.aggregate([
        {"$match": {"payment_status": "paid"}},
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$platform_commission"}
            }
        }
    ]).to_list(1)

    revenue = (
        revenue_result[0].get("total", 0)
        if revenue_result else 0
    )

    return {
        "total_bookings": total_bookings,
        "paid_bookings": paid_bookings,
        "active_saints": active_saints,
        "total_saints": total_saints,
        "pending_saints": pending_saints,
        "pending_bookings": pending_bookings,
        "revenue": revenue,
    }


@api_router.get("/admin/saints/pending")
async def admin_pending_saints(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    # Existing frontend endpoint; returns all active Saints.
    saints = await db.saint_profiles.find({
        "is_active": True
    }).sort(
        "created_at",
        -1
    ).to_list(1000)

    for saint in saints:
        saint["id"] = str(saint.pop("_id"))
        saint["is_approved"] = True

    return saints


@api_router.post("/admin/saints/approve")
async def admin_approve_saint(
    payload: AdminApprovalRequest,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    if payload.approved:
        raise HTTPException(
            status_code=400,
            detail="Saints are automatically active. Admin cannot approve Saints."
        )

    try:
        saint_id = ObjectId(payload.saint_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid saint ID"
        )

    result = await db.saint_profiles.update_one(
        {"_id": saint_id},
        {"$set": {
            "is_active": False,
            "is_approved": False,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Saint not found"
        )

    return {
        "message": "Saint rejected",
        "approved": False,
        "is_active": False
    }


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
        "is_active": True
    })

    total_saints = await db.saint_profiles.count_documents({})
    pending_saints = 0

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
        "total_saints": total_saints,
        "pending_saints": pending_saints,
        "pending_bookings": pending_bookings,
        "revenue": revenue
    }


@api_router.get("/admin/bookings")
async def admin_get_bookings(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    bookings = await db.bookings.find().sort(
        "created_at",
        -1
    ).to_list(1000)

    result = []

    for booking in bookings:
        booking_id = str(booking.pop("_id"))

        # Customer details
        customer = None
        customer_id = booking.get("customer_id")

        if customer_id:
            try:
                customer = await db.users.find_one({
                    "_id": ObjectId(customer_id)
                })
            except Exception:
                customer = None

        booking["customer_name"] = (
            booking.get("customer_name")
            or (customer or {}).get("name", "")
        )
        booking["customer_phone"] = (
            booking.get("customer_phone")
            or (customer or {}).get("phone", "")
        )
        booking["customer_email"] = (
            customer or {}
        ).get("email", "")

        # Saint details
        saint = None
        saint_id = booking.get("saint_id")

        if saint_id:
            try:
                saint = await db.saint_profiles.find_one({
                    "_id": ObjectId(saint_id)
                })
            except Exception:
                saint = None

        if saint:
            booking["saint_name"] = saint.get("name", "Unknown")
            booking["saint_location"] = saint.get("location", "")
            booking["saint_operating_areas"] = saint.get(
                "operating_areas", []
            )
            booking["saint_poojas"] = saint.get("poojas", [])
            booking["saint_is_active"] = saint.get(
                "is_active", False
            )
            booking["saint_is_approved"] = saint.get(
                "is_approved", True
            )

            saint_user = None
            saint_user_id = saint.get("user_id")

            if saint_user_id:
                try:
                    saint_user = await db.users.find_one({
                        "_id": ObjectId(saint_user_id)
                    })
                except Exception:
                    saint_user = None

            booking["saint_phone"] = (
                saint_user or {}
            ).get("phone", "")
            booking["saint_email"] = (
                saint_user or {}
            ).get("email", "")

        else:
            booking["saint_name"] = "Saint not found"
            booking["saint_phone"] = ""
            booking["saint_email"] = ""
            booking["saint_location"] = ""
            booking["saint_operating_areas"] = []
            booking["saint_poojas"] = []
            booking["saint_is_active"] = False
            booking["saint_is_approved"] = False

        booking["id"] = booking_id
        result.append(booking)

    return result


# ==================== STARTUP ====================

_delhivery_tracking_task = None


@app.on_event("startup")
async def startup_event():
    global _delhivery_tracking_task
    await ensure_admin_account()
    if DELHIVERY_AUTO_TRACKING_ENABLED and DELHIVERY_API_TOKEN:
        _delhivery_tracking_task = asyncio.create_task(
            _delhivery_tracking_scheduler()
        )
        logger.info(
            "Delhivery auto-tracking enabled; interval=%s seconds",
            DELHIVERY_AUTO_TRACKING_INTERVAL_SECONDS,
        )
    else:
        logger.info("Delhivery auto-tracking is disabled by configuration.")


@app.on_event("shutdown")
async def shutdown_event():
    global _delhivery_tracking_task
    if _delhivery_tracking_task:
        _delhivery_tracking_task.cancel()
        try:
            await _delhivery_tracking_task
        except asyncio.CancelledError:
            pass
        _delhivery_tracking_task = None
    client.close()



# ==================== PUJARIGO SAMAGRI STORE ====================

from pydantic import ConfigDict
from bson import ObjectId


class StoreProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str = Field(default="", max_length=2000)
    category: str = Field(default="Puja Samagri", max_length=80)
    price: float = Field(..., gt=0, le=100000)
    image_url: str = Field(default="", max_length=2000)
    stock: int = Field(default=0, ge=0, le=100000)
    weight_grams: int = Field(..., gt=0, le=100000)
    is_available: bool = True
    is_gift: bool = False
    is_returnable: bool = False
    tags: List[str] = []



def serialize_store_product(product: dict) -> dict:
    return {
        "id": str(product["_id"]),
        "name": product.get("name", ""),
        "description": product.get("description", ""),
        "category": product.get("category", "Puja Samagri"),
        "is_gift": product.get("is_gift", False),
        "is_returnable": product.get("is_returnable", False),
        "tags": product.get("tags", []),
        "price": product.get("price", 0),
        "image_url": product.get("image_url", ""),
        "is_returnable": product.get("is_returnable", False),
        "stock": product.get("stock", 0),
       "weight_grams": product.get("weight_grams", 0),
        "is_available": product.get("is_available", True),
        "seller_id": product.get("seller_id", ""),
        "shop_name": product.get("shop_name", ""),
        "pickup_address": product.get("pickup_address", ""),
        "pickup_city": product.get("pickup_city", ""),
        "pickup_pincode": product.get("pickup_pincode", ""),
        "created_at": product.get("created_at", ""),
    }


@api_router.get("/store/products")
async def list_store_products():
    products = await db.store_products.find({
        "is_available": True,
        "stock": {"$gt": 0}
    }).sort("created_at", -1).to_list(200)

    return [serialize_store_product(p) for p in products]


@api_router.post("/store/admin/products")
async def create_store_product(
    payload: StoreProductCreate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    product = payload.dict()
    product["created_at"] = datetime.utcnow().isoformat()
    product["updated_at"] = datetime.utcnow().isoformat()

    result = await db.store_products.insert_one(product)
    product["_id"] = result.inserted_id

    return serialize_store_product(product)

class StoreProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    category: Optional[str] = Field(default=None, max_length=80)
    is_gift: Optional[bool] = None
    is_returnable: Optional[bool] = None
    tags: Optional[List[str]] = None
    price: Optional[float] = Field(default=None, gt=0, le=100000)
    image_url: Optional[str] = Field(default=None, max_length=2000)
    stock: Optional[int] = Field(default=None, ge=0, le=100000)
    weight_grams: Optional[int] = Field(default=None, gt=0, le=100000)
    is_available: Optional[bool] = None


@api_router.put("/store/admin/products/{product_id}")
async def update_store_product(
    product_id: str,
    payload: StoreProductUpdate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    try:
        object_id = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")

    updates = payload.dict(exclude_unset=True)

    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")

    updates["updated_at"] = datetime.utcnow().isoformat()

    result = await db.store_products.update_one(
        {"_id": object_id},
        {"$set": updates}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    product = await db.store_products.find_one({"_id": object_id})
    return serialize_store_product(product)

@api_router.put("/store/seller/products/{product_id}")
async def update_seller_product(
    product_id: str,
    payload: StoreProductUpdate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=403,
            detail="Your seller account is not approved",
        )

    try:
        object_id = ObjectId(product_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid product ID",
        )

    updates = payload.dict(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No changes provided",
        )

    updates["updated_at"] = datetime.utcnow().isoformat()

    result = await db.store_products.update_one(
        {
            "_id": object_id,
            "seller_id": user["id"],
        },
        {"$set": updates},
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Product not found or you do not own it",
        )

    product = await db.store_products.find_one({"_id": object_id})
    return serialize_store_product(product)

@api_router.delete("/store/seller/products/{product_id}")
async def hide_seller_product(
    product_id: str,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=403,
            detail="Your seller account is not approved",
        )

    try:
        object_id = ObjectId(product_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid product ID",
        )

    result = await db.store_products.update_one(
        {
            "_id": object_id,
            "seller_id": user["id"],
        },
        {
            "$set": {
                "is_available": False,
                "updated_at": datetime.utcnow().isoformat(),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Product not found or you do not own it",
        )

    return {"message": "Product hidden from customers"}


@api_router.delete("/store/admin/products/{product_id}")
async def delete_store_product(
    product_id: str,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    try:
        object_id = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")

    result = await db.store_products.update_one(
        {"_id": object_id},
        {
            "$set": {
                "is_available": False,
                "updated_at": datetime.utcnow().isoformat()
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    return {"message": "Product marked unavailable"}

# ==================== SELLER PRODUCT MANAGEMENT ====================

@api_router.get("/store/seller/products")
async def list_seller_products(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=403,
            detail="Your seller account is not approved",
        )

    products = await db.store_products.find({
        "seller_id": user["id"],
    }).sort("created_at", -1).to_list(200)

    return [serialize_store_product(p) for p in products]

@api_router.post("/store/seller/products")
async def create_seller_product(
    payload: StoreProductCreate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=403,
            detail="Your seller account is not approved",
        )

    product = payload.dict()
    product["seller_id"] = user["id"]
    product["shop_name"] = application.get("shop_name", "")
    product["pickup_address"] = application.get("shop_address", "")
    product["pickup_city"] = application.get("city", "")
    product["pickup_pincode"] = application.get("pincode", "")
    product["created_at"] = datetime.utcnow().isoformat()
    product["updated_at"] = datetime.utcnow().isoformat()

    result = await db.store_products.insert_one(product)
    product["_id"] = result.inserted_id

    return serialize_store_product(product)
    
@api_router.get("/store/admin/products")
async def get_all_store_products(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    products = await db.store_products.find().sort(
        "created_at", -1
    ).to_list(500)

    return [
        serialize_store_product(product)
        for product in products
    ]

# ==================== ADMIN BANNER MANAGEMENT ====================

class BannerCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default="", max_length=500)
    image_url: str = Field(..., min_length=5, max_length=2000)
    cta_text: Optional[str] = Field(default="", max_length=40)
    link_url: Optional[str] = Field(default="", max_length=2000)
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class BannerUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, min_length=5, max_length=2000)
    cta_text: Optional[str] = Field(default=None, max_length=40)
    link_url: Optional[str] = Field(default=None, max_length=2000)
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


def serialize_banner(banner: dict) -> dict:
    return {
        "id": str(banner["_id"]),
        "title": banner.get("title", ""),
        "description": banner.get("description", ""),
        "image_url": banner.get("image_url", ""),
        "cta_text": banner.get("cta_text", ""),
        "link_url": banner.get("link_url", ""),
        "start_at": banner.get("start_at"),
        "end_at": banner.get("end_at"),
        "is_active": banner.get("is_active", True),
        "sort_order": banner.get("sort_order", 0),
        "created_at": banner.get("created_at", ""),
        "updated_at": banner.get("updated_at", ""),
    }


def banner_is_in_schedule(banner: dict, now: datetime) -> bool:
    if not banner.get("is_active", True):
        return False

    try:
        start_at = banner.get("start_at")
        end_at = banner.get("end_at")

        if start_at:
            start_date = datetime.fromisoformat(start_at)
            if start_date > now:
                return False

        if end_at:
            end_date = datetime.fromisoformat(end_at)
            if end_date < now:
                return False

        return True

    except (ValueError, TypeError):
        return False


# Customer homepage: show only active banners within their schedule.
@api_router.get("/banners")
async def get_customer_banners():
    banners = await db.banners.find({
        "is_active": True
    }).sort([
        ("sort_order", 1),
        ("created_at", -1)
    ]).to_list(100)

    now = datetime.utcnow()
    visible_banners = [
        serialize_banner(banner)
        for banner in banners
        if banner_is_in_schedule(banner, now)
    ]

    return visible_banners


# Admin: list all banners, including inactive and scheduled banners.
@api_router.get("/admin/banners")
async def admin_get_banners(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    banners = await db.banners.find().sort([
        ("sort_order", 1),
        ("created_at", -1)
    ]).to_list(500)

    return [serialize_banner(banner) for banner in banners]


# Admin: create a banner.
@api_router.post("/admin/banners")
async def admin_create_banner(
    payload: BannerCreate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    banner = payload.dict()
    banner["created_at"] = datetime.utcnow().isoformat()
    banner["updated_at"] = datetime.utcnow().isoformat()

    result = await db.banners.insert_one(banner)
    banner["_id"] = result.inserted_id

    return serialize_banner(banner)


# Admin: update a banner.
@api_router.put("/admin/banners/{banner_id}")
async def admin_update_banner(
    banner_id: str,
    payload: BannerUpdate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    try:
        banner_oid = ObjectId(banner_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid banner ID")

    update = payload.dict(exclude_unset=True)

    if not update:
        raise HTTPException(status_code=400, detail="No changes provided")

    update["updated_at"] = datetime.utcnow().isoformat()

    result = await db.banners.update_one(
        {"_id": banner_oid},
        {"$set": update}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Banner not found")

    banner = await db.banners.find_one({"_id": banner_oid})
    return serialize_banner(banner)


# Admin: delete a banner.
@api_router.delete("/admin/banners/{banner_id}")
async def admin_delete_banner(
    banner_id: str,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    try:
        banner_oid = ObjectId(banner_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid banner ID")

    result = await db.banners.delete_one({"_id": banner_oid})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Banner not found")

    return {"message": "Banner deleted successfully"}

# ==================== END ADMIN BANNER MANAGEMENT ====================

# ==================== SAMAGRI STORE ORDERS ====================

class StoreOrderItem(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=1, le=50)


class StoreOrderCreate(BaseModel):
    items: List[StoreOrderItem]
    customer_name: str = Field(..., min_length=2, max_length=120)
    customer_phone: str = Field(..., min_length=10, max_length=10)
    delivery_address: str = Field(..., min_length=5, max_length=1000)
    city: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., min_length=6, max_length=6)
    payment_method: str = Field(default="online")
    coupon_code: Optional[str] = Field(default=None, max_length=40)
    is_gift: bool = False
    gift_recipient_name: Optional[str] = Field(default=None, max_length=120)
    gift_recipient_phone: Optional[str] = Field(default=None, max_length=10)
    gift_delivery_address: Optional[str] = Field(default=None, max_length=1000)
    gift_delivery_city: Optional[str] = Field(default=None, max_length=100)
    gift_delivery_pincode: Optional[str] = Field(default=None, min_length=6, max_length=6)
    gift_message: Optional[str] = Field(default=None, max_length=500)
    gift_wrapping: bool = False



def serialize_store_order(order: dict) -> dict:
    return {
        "id": str(order["_id"]),
        "items": order.get("items", []),
        "customer_name": order.get("customer_name", ""),
        "customer_phone": order.get("customer_phone", ""),
        "delivery_address": order.get("delivery_address", ""),
        "city": order.get("city", ""),
        "pincode": order.get("pincode", ""),
        "product_subtotal": order.get("product_subtotal", 0),
        "discount_amount": order.get("discount_amount", 0),
        "coupon_code": order.get("coupon_code", ""),
        "coupon_description": order.get("coupon_description", ""),
        "is_gift": order.get("is_gift", False),
        "gift_recipient_name": order.get("gift_recipient_name", ""),
        "gift_recipient_phone": order.get("gift_recipient_phone", ""),
        "gift_delivery_address": order.get("gift_delivery_address", ""),
        "gift_delivery_city": order.get("gift_delivery_city", ""),
        "gift_delivery_pincode": order.get("gift_delivery_pincode", ""),
        "gift_message": order.get("gift_message", ""),
        "gift_wrapping": order.get("gift_wrapping", False),
        "platform_fee": order.get("platform_fee", 0),
        "shipping_fee": order.get("shipping_fee", 0),
        "cod_fee": order.get("cod_fee", 0),
        "total_amount": order.get("total_amount", 0),
        "payment_method": order.get("payment_method", "online"),
        "payment_status": order.get("payment_status", "pending"),
        "order_status": order.get("order_status", "Order Placed"),
        "courier": order.get("courier", ""),
        "tracking_number": order.get("tracking_number", ""),
        "tracking_url": order.get("tracking_url", ""),
        "return_status": order.get("return_status", "Not Requested"),
        "delivered_at": order.get("delivered_at", ""),
        "created_at": order.get("created_at", ""),
        "paid_at": order.get("paid_at", ""),
        "razorpay_order_id": order.get("razorpay_order_id", ""),
        "razorpay_payment_id": order.get("razorpay_payment_id", ""),
    }


@api_router.post("/store/orders")
async def create_store_order(
    payload: StoreOrderCreate,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["customer"])

    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    payment_method = (payload.payment_method or "online").strip().lower()
    if payment_method not in {"online", "cod"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid payment method. Choose online or cod.",
        )

    delivery_pincode = (payload.gift_delivery_pincode if payload.is_gift else payload.pincode).strip()
    if not delivery_pincode.isdigit() or len(delivery_pincode) != 6:
        raise HTTPException(status_code=400, detail="Enter a valid six-digit delivery PIN code")
    if payload.is_gift and not (payload.gift_delivery_address or "").strip():
        raise HTTPException(status_code=400, detail="Gift delivery address is required")
    if payload.is_gift and not (payload.gift_delivery_city or "").strip():
        raise HTTPException(status_code=400, detail="Gift delivery city is required")

    order_items = []
    order_seller_id = None
    product_subtotal = 0.0
    total_weight_grams = 0
    seller_pickup_pincode = ""

    # Validate all products and calculate subtotal/weight before reserving stock.
    for item in payload.items:
        try:
            product_id = ObjectId(item.product_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid product ID")

        product = await db.store_products.find_one({
            "_id": product_id,
            "is_available": True,
        })
        if not product:
            raise HTTPException(status_code=404, detail="A product is unavailable")
        if product.get("stock", 0) < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for {product.get('name', 'product')}",
            )

        seller_id = str(product.get("seller_id", ""))
        if not seller_id:
            raise HTTPException(
                status_code=400,
                detail="This product has no assigned seller. Please contact the store administrator.",
            )

        seller_application = await db.seller_applications.find_one({
            "user_id": seller_id,
            "status": "approved",
        })
        if not seller_application:
            raise HTTPException(
                status_code=400,
                detail="This product's seller is not approved. Please contact the store administrator.",
            )

        seller_pincode = str(seller_application.get("pincode", "")).strip()
        if not seller_pincode.isdigit() or len(seller_pincode) != 6:
            raise HTTPException(
                status_code=400,
                detail="The seller must have a valid six-digit pickup PIN code.",
            )

        if order_seller_id is None:
            order_seller_id = seller_id
            seller_pickup_pincode = seller_pincode
        elif order_seller_id != seller_id:
            raise HTTPException(
                status_code=400,
                detail="Please place separate orders for products from different sellers.",
            )

        unit_price = float(product["price"])
        line_total = round(unit_price * item.quantity, 2)
        product_subtotal += line_total
        item_weight = max(int(product.get("weight_grams", 500)), 1)
        total_weight_grams += item_weight * item.quantity

        order_items.append({
            "product_id": str(product["_id"]),
            "seller_id": seller_id,
            "shop_name": seller_application.get("shop_name") or product.get("shop_name", ""),
            "seller_owner_name": seller_application.get("owner_name", ""),
            "seller_phone": seller_application.get("phone", ""),
            "seller_email": seller_application.get("email", ""),
            "seller_shop_address": seller_application.get("shop_address", ""),
            "seller_city": seller_application.get("city", ""),
            "seller_pincode": seller_pincode,
            "seller_delhivery_pickup_name": seller_application.get("delhivery_pickup_name", ""),
            "seller_delhivery_pickup_status": seller_application.get("delhivery_pickup_status", "not_registered"),
            "seller_delhivery_pickup_verified": seller_application.get("delhivery_pickup_verified") is True,
            "name": product["name"],
            "unit_price": unit_price,
            "quantity": item.quantity,
            "line_total": line_total,
            "weight_grams": item_weight,
            "image_url": product.get("image_url", ""),
            "is_returnable": product.get("is_returnable", False),
        })

               # Validate coupons on the server; never trust a discount calculated by the app.
    coupon = None
    discount_amount = 0.0
    coupon_code = (payload.coupon_code or "").strip().upper()

    if coupon_code:
        coupon = await db.store_coupons.find_one({
            "code": coupon_code,
            "is_active": True,
        })

        now_iso = datetime.utcnow().isoformat()

        if not coupon:
            raise HTTPException(status_code=400, detail="Invalid or inactive coupon code")

        if coupon.get("starts_at") and coupon["starts_at"] > now_iso:
            raise HTTPException(status_code=400, detail="This coupon is not active yet")

        if coupon.get("expires_at") and coupon["expires_at"] < now_iso:
            raise HTTPException(status_code=400, detail="This coupon has expired")

        if product_subtotal < float(coupon.get("min_order_amount", 0)):
            raise HTTPException(status_code=400, detail="Minimum order amount not reached for this coupon")

        max_uses = coupon.get("max_uses")

        if max_uses is not None and int(coupon.get("used_count", 0)) >= int(max_uses):
            raise HTTPException(status_code=400, detail="This coupon has reached its usage limit")

        discount_type = coupon.get("discount_type", "percent")

        if discount_type == "fixed":
            discount_amount = float(coupon.get("discount_value", 0))
        else:
            discount_amount = product_subtotal * float(coupon.get("discount_value", 0)) / 100

            if coupon.get("max_discount") is not None:
                discount_amount = min(discount_amount, float(coupon["max_discount"]))

        discount_amount = round(min(discount_amount, product_subtotal), 2)

    # Calculate final order amount after coupon discount.
    discounted_subtotal = round(
        max(0, product_subtotal - discount_amount), 2
    )

    platform_fee = round(discounted_subtotal * 0.02, 2)

    gift_wrapping_fee = 5.00 if payload.gift_wrapping else 0.00

    cod_fee = 10.00 if payment_method == "cod" else 0.00
    if not seller_pickup_pincode:
        raise HTTPException(status_code=400, detail="Seller pickup PIN code is missing")

    # Recalculate the courier charge on the server; never trust the app's estimate.
    shipping_fee = await get_delhivery_shipping_fee(
        pickup_pincode=seller_pickup_pincode,
        delivery_pincode=delivery_pincode,
        weight_grams=total_weight_grams,
        payment_mode="COD" if payment_method == "cod" else "Pre-paid",
        shipping_mode="S",
    )
    total_amount = round(
        discounted_subtotal
        + platform_fee
        + shipping_fee
        + gift_wrapping_fee
        + cod_fee,
        2,
    )
    # COD orders are confirmed at placement, so deduct their stock now.
    # Online orders remain pending and must NOT deduct stock until Razorpay
    # payment has been verified successfully.
    reserved = []
    if payment_method == "cod":
        try:
            for item in payload.items:
                product_id = ObjectId(item.product_id)
                reservation = await db.store_products.update_one(
                    {
                        "_id": product_id,
                        "is_available": True,
                        "stock": {"$gte": item.quantity},
                    },
                    {
                        "$inc": {"stock": -item.quantity},
                        "$set": {"updated_at": datetime.utcnow().isoformat()},
                    },
                )
                if reservation.modified_count == 0:
                    raise HTTPException(
                        status_code=409,
                        detail="Stock changed while placing the order. Please refresh your cart and try again.",
                    )
                reserved.append((product_id, item.quantity))
        except Exception:
            for reserved_id, reserved_quantity in reserved:
                await db.store_products.update_one(
                    {"_id": reserved_id},
                    {"$inc": {"stock": reserved_quantity}},
                )
            raise

    if payload.is_gift:
        if not (payload.gift_recipient_name or "").strip() or not (payload.gift_recipient_phone or "").strip():
            # For gifts, use the normal delivery address but require a named recipient and phone.
            for reserved_id, reserved_quantity in reserved:
                await db.store_products.update_one({"_id": reserved_id}, {"$inc": {"stock": reserved_quantity}})
            raise HTTPException(status_code=400, detail="Gift recipient name and phone are required")
        gift_phone = "".join(ch for ch in payload.gift_recipient_phone if ch.isdigit())
        if len(gift_phone) != 10:
            for reserved_id, reserved_quantity in reserved:
                await db.store_products.update_one({"_id": reserved_id}, {"$inc": {"stock": reserved_quantity}})
            raise HTTPException(status_code=400, detail="Gift recipient phone must contain 10 digits")

    order = {
        "customer_id": user["id"],
        "items": order_items,
        "customer_name": payload.customer_name.strip(),
        "customer_phone": payload.customer_phone.strip(),
        "delivery_address": (payload.gift_delivery_address if payload.is_gift else payload.delivery_address).strip(),
        "city": (payload.gift_delivery_city if payload.is_gift else payload.city).strip(),
        "pincode": delivery_pincode,
        "product_subtotal": product_subtotal,
        "discount_amount": discount_amount,
        "coupon_code": coupon_code,
        "coupon_description": (coupon or {}).get("description", ""),
        "is_gift": payload.is_gift,
        "gift_recipient_name": (payload.gift_recipient_name or "").strip(),
        "gift_recipient_phone": (payload.gift_recipient_phone or "").strip(),
        "gift_delivery_address": (payload.gift_delivery_address or "").strip(),
        "gift_delivery_city": (payload.gift_delivery_city or "").strip(),
        "gift_delivery_pincode": (payload.gift_delivery_pincode or "").strip(),
        "gift_message": (payload.gift_message or "").strip(),
        "gift_wrapping": payload.gift_wrapping,
        "platform_fee": platform_fee,
        "shipping_fee": shipping_fee,
        "gift_wrapping_fee": gift_wrapping_fee,
        "cod_fee": cod_fee,
        "total_amount": total_amount,
        "payment_method": payment_method,
        "payment_status": "pending",
        "stock_deducted": payment_method == "cod",
        "order_status": "Order Placed" if payment_method == "cod" else "Awaiting Payment",
        "courier": "",
        "tracking_number": "",
        "tracking_url": "",
        "return_status": "Not Requested",
        "created_at": datetime.utcnow().isoformat(),
    }

    try:
        result = await db.store_orders.insert_one(order)
    except Exception:
        for reserved_id, reserved_quantity in reserved:
            await db.store_products.update_one(
                {"_id": reserved_id},
                {"$inc": {"stock": reserved_quantity}},
            )
        raise HTTPException(
            status_code=500,
            detail="Could not create the order. Please try again.",
        )

    order["_id"] = result.inserted_id
    if coupon and payment_method == "cod":
        await db.store_coupons.update_one(
            {"_id": coupon["_id"], "is_active": True},
            {"$inc": {"used_count": 1}},
        )
    return serialize_store_order(order)


@api_router.get("/store/orders/my-orders")
async def get_my_store_orders(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["customer"])

    orders = await db.store_orders.find({
        "customer_id": user["id"],
        "$or": [
            {"payment_method": "cod"},
            {"payment_method": {"$ne": "cod"}, "payment_status": "paid"},
        ],
    }).sort("created_at", -1).to_list(200)

    result = []

    for order in orders:
        serialized_order = serialize_store_order(order)

        # Include customer delivery details for the invoice
        serialized_order["customer_name"] = order.get("customer_name", "")
        serialized_order["customer_phone"] = order.get("customer_phone", "")
        serialized_order["delivery_address"] = order.get("delivery_address", "")
        serialized_order["city"] = order.get("city", "")
        serialized_order["pincode"] = order.get("pincode", "")

        # Include seller contact and shop details for the customer.
        serialized_order["items"] = [
            {
                **item,
                "seller_owner_name": item.get("seller_owner_name", ""),
                "seller_phone": item.get("seller_phone", ""),
                "seller_email": item.get("seller_email", ""),
                "seller_shop_address": item.get("seller_shop_address", ""),
                "seller_city": item.get("seller_city", ""),
                "seller_pincode": item.get("seller_pincode", ""),
            }
            for item in serialized_order.get("items", [])
        ]

        result.append(serialized_order)

    return result

@api_router.post("/store/returns/request")
async def create_store_return_request(
    payload: StoreReturnRequest,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["customer"])

    # Validate order ID
    try:
        order_object_id = ObjectId(payload.order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    # Find an order belonging to this customer
    order = await db.store_orders.find_one({
        "_id": order_object_id,
        "customer_id": user["id"],
    })

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Returns are allowed only after delivery
    if order.get("order_status") != "Delivered":
        raise HTTPException(
            status_code=400,
            detail="You can request a return only after delivery",
        )

    delivered_at = order.get("delivered_at")

    if not delivered_at:
        raise HTTPException(
            status_code=400,
            detail="Delivery date is unavailable for this order",
        )

    try:
        delivered_date = datetime.fromisoformat(
            delivered_at.replace("Z", "+00:00")
        )

        # Existing timestamps are stored in UTC.
        if delivered_date.tzinfo is not None:
            delivered_date = delivered_date.replace(tzinfo=None)

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid delivery date",
        )

    if datetime.utcnow() > delivered_date + timedelta(days=7):
        raise HTTPException(
            status_code=400,
            detail="The 7-day return period has expired",
        )

    # Find the purchased product in this order
    order_item = next(
        (
            item for item in order.get("items", [])
            if item.get("product_id") == payload.product_id
        ),
        None,
    )

    if not order_item:
        raise HTTPException(
            status_code=404,
            detail="Product not found in this order",
        )

    # Check the return policy saved at purchase time
    if order_item.get("is_returnable") is not True:
        raise HTTPException(
            status_code=400,
            detail="This product is not eligible for returns",
        )

    purchased_quantity = int(order_item.get("quantity", 0))

    if payload.quantity > purchased_quantity:
        raise HTTPException(
            status_code=400,
            detail="Return quantity exceeds purchased quantity",
        )

    # Prevent duplicate active return requests.
    existing_requests = await db.store_return_requests.find({
        "order_id": payload.order_id,
        "product_id": payload.product_id,
        "customer_id": user["id"],
        "status": {"$in": ["Pending", "Approved"]},
    }).to_list(200)

    already_requested = sum(
        int(request.get("quantity", 0))
        for request in existing_requests
    )

    if already_requested + payload.quantity > purchased_quantity:
        raise HTTPException(
            status_code=400,
            detail="A return request already exists for this quantity",
        )

    now = datetime.utcnow().isoformat()

    return_request = {
        "order_id": payload.order_id,
        "product_id": payload.product_id,
        "customer_id": user["id"],
        "seller_id": order_item.get("seller_id", ""),
        "product_name": order_item.get("name", ""),
        "quantity": payload.quantity,
        "reason": payload.reason.strip(),
        "status": "Pending",
        "created_at": now,
        "reviewed_at": "",
        "reviewed_by": "",
        "review_note": "",
    }

    result = await db.store_return_requests.insert_one(return_request)

    return {
        "message": "Return request submitted successfully",
        "return_request_id": str(result.inserted_id),
        "status": "Pending",
    }

@api_router.get("/store/returns/requests")
async def get_store_return_requests(
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["seller", "admin"])

    if user.get("role") == "admin":
        query = {}
    else:
        query = {"seller_id": user["id"]}

    requests = await db.store_return_requests.find(
        query
    ).sort("created_at", -1).to_list(200)

    result = []

    for request in requests:
        request["id"] = str(request.pop("_id"))
        result.append(request)

    return result


@api_router.put("/store/returns/{return_id}/review")
async def review_store_return_request(
    return_id: str,
    payload: StoreReturnReview,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["seller", "admin"])

    if payload.status not in {"Approved", "Rejected"}:
        raise HTTPException(
            status_code=400,
            detail="Status must be Approved or Rejected",
        )

    try:
        return_object_id = ObjectId(return_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid return request ID",
        )

    request = await db.store_return_requests.find_one({
        "_id": return_object_id
    })

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Return request not found",
        )

    if (
        user.get("role") == "seller"
        and request.get("seller_id") != user["id"]
    ):
        raise HTTPException(
            status_code=403,
            detail="You cannot review another seller's return request",
        )

    if request.get("status") != "Pending":
        raise HTTPException(
            status_code=400,
            detail="This return request has already been reviewed",
        )

    now = datetime.utcnow().isoformat()
    updates = {
        "status": payload.status,
        "review_note": (payload.review_note or "").strip(),
        "reviewed_at": now,
        "reviewed_by": user["id"],
    }

    if payload.status == "Approved":
        try:
            order_object_id = ObjectId(str(request.get("order_id") or ""))
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Original order ID is invalid",
            )

        order = await db.store_orders.find_one({
            "_id": order_object_id
        })

        if not order:
            raise HTTPException(
                status_code=404,
                detail="Original store order not found",
            )

        seller_id = str(request.get("seller_id") or "").strip()

        seller_items = [
            item for item in order.get("items", [])
            if str(item.get("seller_id") or "").strip() == seller_id
            and str(item.get("product_id") or "") == str(request.get("product_id") or "")
        ]

        if not seller_items:
            raise HTTPException(
                status_code=400,
                detail="The returned product could not be matched to this seller's order",
            )

        seller_application = await db.seller_applications.find_one({
            "user_id": seller_id,
            "status": "approved",
        })

        if not seller_application:
            raise HTTPException(
                status_code=400,
                detail="Approved seller address could not be found",
            )
        customer_name = str(
            (
                order.get("gift_recipient_name")
                if order.get("is_gift")
                else order.get("customer_name")
            )
            or order.get("customer_name")
            or ""
        ).strip()

        customer_phone = "".join(
            ch for ch in str(
                (
                    order.get("gift_recipient_phone")
                    if order.get("is_gift")
                    else order.get("customer_phone")
                )
                or order.get("customer_phone")
                or ""
            )
            if ch.isdigit()
        )

        customer_address = str(order.get("delivery_address") or "").strip()
        customer_city = str(order.get("city") or "").strip()
        customer_pin = str(order.get("pincode") or "").strip()
        customer_pin = "".join(ch for ch in customer_pin if ch.isdigit())
        seller_pin = "".join(ch for ch in seller_pin if ch.isdigit())

        seller_address = str(
            seller_application.get("shop_address") or ""
        ).strip()
        seller_city = str(seller_application.get("city") or "").strip()
        seller_pin = str(seller_application.get("pincode") or "").strip()
        seller_name = str(
            seller_application.get("shop_name")
            or seller_application.get("owner_name")
            or ""
        ).strip()

        seller_pickup_name = str(
            seller_application.get("delhivery_pickup_name") or ""
        ).strip()

        required_details = {
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_address": customer_address,
            "customer_city": customer_city,
            "customer_pincode": customer_pin,
            "seller_name": seller_name,
            "seller_address": seller_address,
            "seller_city": seller_city,
            "seller_pincode": seller_pin,
            "seller_delhivery_pickup_name": seller_pickup_name,
        }

        missing = [
            field for field, value in required_details.items()
            if not value
        ]

        if missing:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Reverse pickup details are incomplete.",
                    "missing_fields": missing,
                },
            )

        if len(customer_phone) < 10:
            raise HTTPException(
                status_code=400,
                detail="Customer phone number is invalid",
            )

        customer_pin = "".join(ch for ch in customer_pin if ch.isdigit())
        seller_pin = "".join(ch for ch in seller_pin if ch.isdigit())

        if len(customer_pin) != 6 or len(seller_pin) != 6:
            raise HTTPException(
                status_code=400,
                detail="Both customer and seller pincodes must contain six digits",
            )

        customer_state = await _get_state_from_pincode(customer_pin)
        seller_state = await _get_state_from_pincode(seller_pin)

        reverse_pickup_details = {
            "customer_pickup": {
                "name": customer_name,
                "phone": customer_phone[-10:],
                "address": customer_address,
                "city": customer_city,
                "pincode": customer_pin,
                "state": customer_state,
                "country": "India",
            },
            "seller_return_address": {
                "name": seller_name,
                "phone": str(seller_application.get("phone") or ""),
                "address": seller_address,
                "city": seller_city,
                "pincode": seller_pin,
                "state": seller_state,
                "country": "India",
                "pickup_location_name": seller_pickup_name,
            },
            "product_name": str(request.get("product_name") or ""),
            "quantity": int(request.get("quantity") or 1),
            "prepared_at": now,
        }

        updates["reverse_pickup_details"] = reverse_pickup_details
        updates["reverse_status"] = "prepared_waiting_for_live_approval"

    result = await db.store_return_requests.update_one(
        {
            "_id": return_object_id,
            "status": "Pending",
        },
        {
            "$set": updates
        },
    )

    if result.modified_count != 1:
        raise HTTPException(
            status_code=409,
            detail="Return request was already reviewed. Refresh and check its status.",
        )

    return {
        "message": f"Return request {payload.status.lower()} successfully",
        "status": payload.status,
        "reverse_pickup_prepared": payload.status == "Approved",
        "delhivery_contacted": False,
        "shipment_created": False,
    }




class StorePaymentCreate(BaseModel):
    store_order_id: str


class StorePaymentVerify(BaseModel):
    store_order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str



# ==================== ADMIN STORE ORDER TRACKING ====================
class StoreReturnRequest(BaseModel):
    order_id: str
    product_id: str
    quantity: int = Field(..., ge=1, le=50)
    reason: str = Field(..., min_length=5, max_length=500)

class StoreReturnReview(BaseModel):
    status: str
    review_note: Optional[str] = Field(default="", max_length=500)
    
class StoreOrderTrackingUpdate(BaseModel):
    order_status: str
    courier: Optional[str] = "DTDC"
    tracking_number: Optional[str] = ""
    tracking_url: Optional[str] = ""

class SellerParcelDetailsUpdate(BaseModel):
    weight_grams: int = Field(..., ge=1, le=50000)
    length_cm: float = Field(..., gt=0, le=200)
    width_cm: float = Field(..., gt=0, le=200)
    height_cm: float = Field(..., gt=0, le=200)    

ALLOWED_STORE_ORDER_STATUSES = {
    "Order Placed",
    "Preparing",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
}


@api_router.get("/store/seller/orders")
async def get_seller_store_orders(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=403,
            detail="Your seller account is not approved",
        )

    orders = await db.store_orders.find({
        "items.seller_id": user["id"],
        "$or": [
            {"payment_method": "cod"},
            {"payment_method": {"$ne": "cod"}, "payment_status": "paid"},
        ],
    }).sort("created_at", -1).to_list(200)

    seller_orders = []

    for order in orders:
        seller_items = [
            item for item in order.get("items", [])
            if item.get("seller_id") == user["id"]
        ]

        if not seller_items:
            continue

        
        seller_order = serialize_store_order(order)
        seller_order["seller_parcel"] = order.get("seller_parcel", {})
        seller_order["items"] = seller_items
        seller_order["seller_total"] = round(
            sum(float(item.get("line_total", 0)) for item in seller_items),
            2,
        )

        # Customer delivery details for the seller.
        seller_order["customer_name"] = order.get("customer_name", "")
        seller_order["customer_phone"] = order.get("customer_phone", "")
        seller_order["delivery_address"] = order.get("delivery_address", "")
        seller_order["city"] = order.get("city", "")
        seller_order["pincode"] = order.get("pincode", "")

        seller_orders.append(seller_order)

    return seller_orders

@api_router.put("/store/seller/orders/{order_id}/parcel")
async def update_seller_order_parcel(
    order_id: str,
    payload: SellerParcelDetailsUpdate,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=403,
            detail="Your seller account is not approved",
        )

    try:
        order_object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid order ID",
        )

    order = await db.store_orders.find_one({
        "_id": order_object_id,
        "items.seller_id": user["id"],
    })

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found for this seller",
        )

    if order.get("tracking_number") or order.get("delhivery_status") in {
        "creating",
        "created",
        "unknown",
    }:
        raise HTTPException(
            status_code=409,
            detail="Parcel details cannot be changed after shipment creation has started",
        )

    payment_method = str(
        order.get("payment_method", "")
    ).strip().lower()

    if payment_method != "cod" and order.get("payment_status") != "paid":
        raise HTTPException(
            status_code=400,
            detail="Online payment must be verified before parcel preparation",
        )

    parcel_details = {
        "weight_grams": payload.weight_grams,
        "length_cm": payload.length_cm,
        "width_cm": payload.width_cm,
        "height_cm": payload.height_cm,
        "updated_at": datetime.utcnow().isoformat(),
        "ready_for_pickup": False,
    }

    await db.store_orders.update_one(
        {"_id": order_object_id},
        {
            "$set": {
                "seller_parcel": parcel_details,
                "updated_at": datetime.utcnow().isoformat(),
            }
        },
    )

    return {
        "message": "Parcel details saved successfully",
        "parcel": parcel_details,
    }
@api_router.post("/store/seller/orders/{order_id}/ready-for-pickup")
async def mark_seller_order_ready_for_pickup(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=403,
            detail="Your seller account is not approved",
        )

    try:
        order_object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid order ID",
        )

    order = await db.store_orders.find_one({
        "_id": order_object_id,
        "items.seller_id": user["id"],
    })

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found for this seller",
        )

    if order.get("tracking_number") or order.get("delhivery_status") in {
        "creating",
        "created",
        "unknown",
    }:
        raise HTTPException(
            status_code=409,
            detail="Shipment creation has already started",
        )

    parcel = order.get("seller_parcel") or {}

    required_fields = [
        "weight_grams",
        "length_cm",
        "width_cm",
        "height_cm",
    ]

    if any(parcel.get(field) is None for field in required_fields):
        raise HTTPException(
            status_code=400,
            detail="Please save parcel weight and dimensions first",
        )

    payment_method = str(
        order.get("payment_method", "")
    ).strip().lower()

    if payment_method != "cod" and order.get("payment_status") != "paid":
        raise HTTPException(
            status_code=400,
            detail="Online payment must be verified first",
        )

    await db.store_orders.update_one(
        {"_id": order_object_id},
        {
            "$set": {
                "seller_parcel.ready_for_pickup": True,
                "seller_parcel.ready_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
        },
    )

    automation_result = await _create_delhivery_shipment_for_order(order_id)
    return {
        "message": "Order marked as ready for pickup. Delhivery automation was started.",
        "ready_for_pickup": True,
        "delhivery_automation": automation_result,
    }

@api_router.put("/store/seller/orders/{order_id}/tracking")
async def update_seller_order_tracking(
    order_id: str,
    payload: StoreOrderTrackingUpdate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["seller"])

    application = await db.seller_applications.find_one({
        "user_id": user["id"],
        "status": "approved",
    })

    if not application:
        raise HTTPException(
            status_code=403,
            detail="Your seller account is not approved",
        )

    if payload.order_status not in ALLOWED_STORE_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid order status",
        )

    try:
        object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid order ID",
        )

    order = await db.store_orders.find_one({
        "_id": object_id,
        "items.seller_id": user["id"],
    })

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found for this seller",
        )

    updates = {
        "order_status": payload.order_status,
        "courier": (payload.courier or "").strip(),
        "tracking_number": (payload.tracking_number or "").strip(),
        "tracking_url": (payload.tracking_url or "").strip(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    if (
        payload.order_status == "Delivered"
        and not order.get("delivered_at")
    ):
        updates["delivered_at"] = datetime.utcnow().isoformat()

    await db.store_orders.update_one(
        {"_id": object_id},
        {"$set": updates},
    )
    return {"message": "Seller order tracking updated successfully"}

@api_router.get("/store/admin/orders")
async def get_all_store_orders(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    cutoff_date = datetime.utcnow() - timedelta(days=90)
    cutoff_iso = cutoff_date.isoformat()

    orders = await db.store_orders.find({
        "created_at": {"$gte": cutoff_iso},
        "$or": [
            {"payment_method": "cod"},
            {"payment_method": {"$ne": "cod"}, "payment_status": "paid"},
        ],
    }).sort(
        "created_at", -1
    ).to_list(500)

    return [
        {
            **serialize_store_order(order),
            "customer_name": order.get("customer_name", ""),
            "customer_phone": order.get("customer_phone", ""),
            "delivery_address": order.get("delivery_address", ""),
            "city": order.get("city", ""),
            "pincode": order.get("pincode", ""),
            "items": order.get("items", []),
        }
        for order in orders
    ]
@api_router.put("/store/admin/orders/{order_id}/tracking")
async def update_store_order_tracking(
    order_id: str,
    payload: StoreOrderTrackingUpdate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["admin"])

    if payload.order_status not in ALLOWED_STORE_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid order status"
        )

    try:
        object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid order ID"
        )
    existing_order = await db.store_orders.find_one({
        "_id": object_id
    })
    if not existing_order:
        raise HTTPException(
            status_code=404,
            detail="Store order not found"
        )

    updates = {
        "order_status": payload.order_status,
        "courier": (payload.courier or "").strip(),
        "tracking_number": (payload.tracking_number or "").strip(),
        "tracking_url": (payload.tracking_url or "").strip(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = await db.store_orders.update_one(
        {"_id": object_id},
        {"$set": updates}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Store order not found"
        )

    return {"message": "Order tracking updated successfully"}


@api_router.get("/store/orders/{order_id}")
async def get_my_store_order(
    order_id: str,
    user: dict = Depends(get_current_user)
):
    try:
        object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid order ID"
        )

    order = await db.store_orders.find_one({
        "_id": object_id,
        "customer_id": user["id"],
        "$or": [
            {"payment_method": "cod"},
            {"payment_method": {"$ne": "cod"}, "payment_status": "paid"},
        ],
    })

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    
    return serialize_store_order(order)


# ==================== STORE RAZORPAY PAYMENT ====================

@api_router.post("/store/payment/create-order")
async def create_store_payment_order(
    payload: StorePaymentCreate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["customer"])

    try:
        store_order_object_id = ObjectId(payload.store_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid store order ID")

    store_order = await db.store_orders.find_one({
        "_id": store_order_object_id,
        "customer_id": user["id"]
    })

    if not store_order:
        raise HTTPException(status_code=404, detail="Store order not found")

    if store_order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order is already paid")

    if store_order.get("payment_method") == "cod":
        raise HTTPException(
            status_code=400,
            detail="This is a Cash on Delivery order. Online payment is not required."
        )

    if not razorpay_client or RAZORPAY_KEY_ID == "dummy_key":
        raise HTTPException(status_code=503, detail="Payment service is not configured")
    amount_paise = int(round(float(store_order["total_amount"]) * 100))

    try:
        razorpay_order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": str(store_order["_id"])
        })
    except Exception:
        raise HTTPException(status_code=502, detail="Could not create payment order")

    await db.store_orders.update_one(
        {"_id": store_order_object_id},
        {"$set": {
            "razorpay_order_id": razorpay_order["id"],
            "updated_at": datetime.utcnow().isoformat()
        }}
    )

    return {
        "key_id": RAZORPAY_KEY_ID,
        "razorpay_order_id": razorpay_order["id"],
        "store_order_id": str(store_order["_id"]),
        "amount": amount_paise,
        "currency": "INR"
    }

@api_router.post("/store/payment/verify")
async def verify_store_payment(
    payload: StorePaymentVerify,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["customer"])

    try:
        store_order_object_id = ObjectId(payload.store_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid store order ID")

    store_order = await db.store_orders.find_one({
        "_id": store_order_object_id,
        "customer_id": user["id"]
    })

    if not store_order:
        raise HTTPException(status_code=404, detail="Store order not found")

    if store_order.get("payment_status") == "paid":
        return {"message": "Payment already verified", "payment_status": "paid"}

    if not store_order.get("razorpay_order_id"):
        raise HTTPException(status_code=400, detail="Create the payment order first")

    if payload.razorpay_order_id != store_order["razorpay_order_id"]:
        raise HTTPException(status_code=400, detail="Payment order ID mismatch")

    if not razorpay_client or RAZORPAY_KEY_SECRET == "dummy_secret":
        raise HTTPException(status_code=503, detail="Payment service is not configured")

    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Payment signature is valid. Deduct stock now (not when the pending
    # order was first created). Atomic stock conditions prevent overselling.
    reserved = []
    try:
        for item in store_order.get("items", []):
            product_id = ObjectId(item["product_id"])
            quantity = int(item.get("quantity", 1))
            reservation = await db.store_products.update_one(
                {
                    "_id": product_id,
                    "is_available": True,
                    "stock": {"$gte": quantity},
                },
                {
                    "$inc": {"stock": -quantity},
                    "$set": {"updated_at": datetime.utcnow().isoformat()},
                },
            )
            if reservation.modified_count == 0:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Payment was received, but stock is no longer available. "
                        "Please contact PujariGo support for a refund."
                    ),
                )
            reserved.append((product_id, quantity))
    except Exception:
        for reserved_id, reserved_quantity in reserved:
            await db.store_products.update_one(
                {"_id": reserved_id},
                {"$inc": {"stock": reserved_quantity}},
            )
        raise

    result = await db.store_orders.update_one(
        {
            "_id": store_order_object_id,
            "customer_id": user["id"],
            "payment_status": {"$ne": "paid"},
            "razorpay_order_id": payload.razorpay_order_id
        },
        {
            "$set": {
                "payment_status": "paid",
                "order_status": "Order Placed",
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
                "paid_at": datetime.utcnow().isoformat(),
                "stock_deducted": True,
                "updated_at": datetime.utcnow().isoformat()
            }
        }
    )

    if result.modified_count > 0 and store_order.get("coupon_code"):
        await db.store_coupons.update_one(
            {"code": store_order["coupon_code"], "is_active": True},
            {"$inc": {"used_count": 1}},
        )

    if result.modified_count == 0:
        for reserved_id, reserved_quantity in reserved:
            await db.store_products.update_one(
                {"_id": reserved_id},
                {"$inc": {"stock": reserved_quantity}},
            )

        latest_order = await db.store_orders.find_one(
            {"_id": store_order_object_id}
        )

        if latest_order and latest_order.get("payment_status") == "paid":
            return {
                "message": "Payment already verified",
                "payment_status": "paid"
            }

        raise HTTPException(
            status_code=409,
            detail="Could not update payment status"
        )

    delhivery_automation = None

    if (
        result.modified_count > 0
        and (store_order.get("seller_parcel") or {}).get("ready_for_pickup") is True
    ):
        try:
            delhivery_automation = await _create_delhivery_shipment_for_order(
                payload.store_order_id
            )
        except Exception:
            logger.exception(
                "Payment succeeded but Delhivery automation needs review"
            )
            delhivery_automation = {
                "shipment_created": False,
                "pickup_scheduled": False,
                "automation_status": "needs_attention",
                "message": "Payment succeeded. Shipping needs admin review."
            }

    return {
        "message": "Store payment verified successfully",
        "payment_status": "paid",
        "delhivery_automation": delhivery_automation,
        "store_order_id": payload.store_order_id
    }
    # ==================== CUSTOMER STORE FEATURES ====================

class StoreCouponCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=40)
    description: str = Field(default="", max_length=250)
    discount_type: str = Field(default="percent")  # percent or fixed
    discount_value: float = Field(..., gt=0, le=100000)
    min_order_amount: float = Field(default=0, ge=0)
    max_discount: Optional[float] = Field(default=None, ge=0)
    max_uses: Optional[int] = Field(default=None, ge=1)
    expires_at: Optional[str] = None
    is_active: bool = True


class CouponValidateRequest(BaseModel):
    code: str
    subtotal: float = Field(..., ge=0)


class RecentlyViewedRequest(BaseModel):
    product_id: str


class StoreChatMessageCreate(BaseModel):
    recipient_type: str = Field(..., pattern="^(admin|seller)$")
    recipient_id: Optional[str] = None
    product_id: Optional[str] = None
    order_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=2000)


class StoreChatReply(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


def serialize_coupon(coupon: dict) -> dict:
    return {
        "id": str(coupon["_id"]),
        "code": coupon.get("code", ""),
        "description": coupon.get("description", ""),
        "discount_type": coupon.get("discount_type", "percent"),
        "discount_value": coupon.get("discount_value", 0),
        "min_order_amount": coupon.get("min_order_amount", 0),
        "max_discount": coupon.get("max_discount"),
        "max_uses": coupon.get("max_uses"),
        "used_count": coupon.get("used_count", 0),
        "expires_at": coupon.get("expires_at"),
        "is_active": coupon.get("is_active", True),
    }


async def calculate_coupon_discount(code: str, subtotal: float):
    normalized = (code or "").strip().upper()
    coupon = await db.store_coupons.find_one({"code": normalized, "is_active": True})
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid or inactive coupon code")
    now_iso = datetime.utcnow().isoformat()
    if coupon.get("starts_at") and coupon["starts_at"] > now_iso:
        raise HTTPException(status_code=400, detail="This coupon is not active yet")
    if coupon.get("expires_at") and coupon["expires_at"] < now_iso:
        raise HTTPException(status_code=400, detail="This coupon has expired")
    if subtotal < float(coupon.get("min_order_amount", 0)):
        raise HTTPException(status_code=400, detail="Minimum order amount not reached")
    if coupon.get("max_uses") is not None and int(coupon.get("used_count", 0)) >= int(coupon["max_uses"]):
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    if coupon.get("discount_type") == "fixed":
        discount = float(coupon.get("discount_value", 0))
    else:
        discount = subtotal * float(coupon.get("discount_value", 0)) / 100
        if coupon.get("max_discount") is not None:
            discount = min(discount, float(coupon["max_discount"]))
    return coupon, round(min(discount, subtotal), 2)


@api_router.get("/store/coupons/active")
async def get_active_store_coupons(user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    coupons = await db.store_coupons.find({"is_active": True}).sort("created_at", -1).to_list(100)
    now_iso = datetime.utcnow().isoformat()
    return [serialize_coupon(c) for c in coupons if (not c.get("expires_at") or c["expires_at"] >= now_iso) and (c.get("max_uses") is None or int(c.get("used_count", 0)) < int(c["max_uses"]))]


@api_router.post("/store/coupons/validate")
async def validate_store_coupon(payload: CouponValidateRequest, user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    coupon, discount = await calculate_coupon_discount(payload.code, payload.subtotal)
    return {"valid": True, "coupon": serialize_coupon(coupon), "discount_amount": discount}


@api_router.get("/store/admin/coupons")
async def admin_list_store_coupons(user: dict = Depends(get_current_user)):
    await require_role(user, ["admin"])
    coupons = await db.store_coupons.find().sort("created_at", -1).to_list(500)
    return [serialize_coupon(c) for c in coupons]


@api_router.post("/store/admin/coupons")
async def admin_create_store_coupon(payload: StoreCouponCreate, user: dict = Depends(get_current_user)):
    await require_role(user, ["admin"])
    code = payload.code.strip().upper().replace(" ", "")
    if payload.discount_type not in {"percent", "fixed"}:
        raise HTTPException(status_code=400, detail="discount_type must be percent or fixed")
    if payload.discount_type == "percent" and payload.discount_value > 100:
        raise HTTPException(status_code=400, detail="Percentage discount cannot exceed 100")
    if await db.store_coupons.find_one({"code": code}):
        raise HTTPException(status_code=409, detail="Coupon code already exists")
    coupon = payload.dict()
    coupon["code"] = code
    coupon["used_count"] = 0
    coupon["created_at"] = datetime.utcnow().isoformat()
    coupon["updated_at"] = coupon["created_at"]
    result = await db.store_coupons.insert_one(coupon)
    coupon["_id"] = result.inserted_id
    return serialize_coupon(coupon)


@api_router.put("/store/admin/coupons/{coupon_id}")
async def admin_update_store_coupon(coupon_id: str, payload: StoreCouponCreate, user: dict = Depends(get_current_user)):
    await require_role(user, ["admin"])
    try:
        oid = ObjectId(coupon_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid coupon ID")
    if payload.discount_type not in {"percent", "fixed"} or (payload.discount_type == "percent" and payload.discount_value > 100):
        raise HTTPException(status_code=400, detail="Invalid discount type or value")
    update = payload.dict()
    update["code"] = payload.code.strip().upper().replace(" ", "")
    update["updated_at"] = datetime.utcnow().isoformat()
    duplicate = await db.store_coupons.find_one({"code": update["code"], "_id": {"$ne": oid}})
    if duplicate:
        raise HTTPException(status_code=409, detail="Coupon code already exists")
    result = await db.store_coupons.update_one({"_id": oid}, {"$set": update})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return serialize_coupon(await db.store_coupons.find_one({"_id": oid}))


@api_router.delete("/store/admin/coupons/{coupon_id}")
async def admin_disable_store_coupon(coupon_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, ["admin"])
    try:
        oid = ObjectId(coupon_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid coupon ID")
    result = await db.store_coupons.update_one({"_id": oid}, {"$set": {"is_active": False, "updated_at": datetime.utcnow().isoformat()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"message": "Coupon deactivated"}


@api_router.get("/store/gifts")
async def list_gift_store_products():
    products = await db.store_products.find({
        "is_available": True,
        "stock": {"$gt": 0},
        "$or": [
            {"category": {"$regex": "gift", "$options": "i"}},
            {"tags": {"$in": ["gift", "gifts", "gift-hamper", "festival-gift"]}},
            {"is_gift": True},
        ],
    }).sort("created_at", -1).to_list(200)
    return [serialize_store_product(p) for p in products]


@api_router.post("/store/recently-viewed")
async def add_recently_viewed(payload: RecentlyViewedRequest, user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    try:
        product_oid = ObjectId(payload.product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = await db.store_products.find_one({"_id": product_oid, "is_available": True})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.store_recently_viewed.update_one(
        {"user_id": user["id"], "product_id": str(product_oid)},
        {"$set": {"viewed_at": datetime.utcnow().isoformat()}, "$setOnInsert": {"user_id": user["id"], "product_id": str(product_oid)}},
        upsert=True,
    )
    return {"message": "Recently viewed updated"}


@api_router.get("/store/recently-viewed")
async def get_recently_viewed(user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    rows = await db.store_recently_viewed.find({"user_id": user["id"]}).sort("viewed_at", -1).to_list(30)
    ids = []
    for row in rows:
        try: ids.append(ObjectId(row["product_id"]))
        except Exception: pass
    products = await db.store_products.find({"_id": {"$in": ids}, "is_available": True, "stock": {"$gt": 0}}).to_list(30) if ids else []
    by_id = {str(p["_id"]): p for p in products}
    ordered = [by_id[row["product_id"]] for row in rows if row.get("product_id") in by_id]
    return [serialize_store_product(p) for p in ordered]


@api_router.get("/store/favourites")
async def get_store_favourites(user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    rows = await db.store_favourites.find({"user_id": user["id"]}).sort("created_at", -1).to_list(500)
    ids = []
    for row in rows:
        try: ids.append(ObjectId(row["product_id"]))
        except Exception: pass
    products = await db.store_products.find({"_id": {"$in": ids}, "is_available": True}).to_list(500) if ids else []
    by_id = {str(p["_id"]): p for p in products}
    return [serialize_store_product(by_id[row["product_id"]]) for row in rows if row.get("product_id") in by_id]


@api_router.post("/store/favourites/{product_id}")
async def add_store_favourite(product_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    try: oid = ObjectId(product_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid product ID")
    if not await db.store_products.find_one({"_id": oid, "is_available": True}):
        raise HTTPException(status_code=404, detail="Product not found")
    await db.store_favourites.update_one(
        {"user_id": user["id"], "product_id": str(oid)},
        {"$setOnInsert": {"user_id": user["id"], "product_id": str(oid), "created_at": datetime.utcnow().isoformat()}},
        upsert=True,
    )
    return {"message": "Added to favourites"}


@api_router.delete("/store/favourites/{product_id}")
async def remove_store_favourite(product_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    await db.store_favourites.delete_one({"user_id": user["id"], "product_id": product_id})
    return {"message": "Removed from favourites"}


@api_router.post("/store/chat/messages")
async def send_store_chat_message(payload: StoreChatMessageCreate, user: dict = Depends(get_current_user)):
    await require_role(user, ["customer", "seller"])
    recipient_id = payload.recipient_id
    if payload.recipient_type == "admin":
        recipient_id = "admin"
    else:
        if not recipient_id:
            if not payload.product_id:
                raise HTTPException(status_code=400, detail="Seller ID or product ID is required")
            try: product_oid = ObjectId(payload.product_id)
            except Exception: raise HTTPException(status_code=400, detail="Invalid product ID")
            product = await db.store_products.find_one({"_id": product_oid, "is_available": True})
            if not product or not product.get("seller_id"):
                raise HTTPException(status_code=404, detail="Seller not found for this product")
            recipient_id = str(product["seller_id"])
        seller_app = await db.seller_applications.find_one({"user_id": recipient_id, "status": "approved"})
        if not seller_app:
            raise HTTPException(status_code=404, detail="Approved seller not found")
    if payload.order_id:
        try: order_oid = ObjectId(payload.order_id)
        except Exception: raise HTTPException(status_code=400, detail="Invalid order ID")
        order = await db.store_orders.find_one({"_id": order_oid, "$or": [{"customer_id": user["id"]}, {"items.seller_id": user["id"]}]})
        if not order and user["role"] != "admin":
            raise HTTPException(status_code=403, detail="You cannot message about this order")
    conversation_key = "|".join(sorted([user["id"], recipient_id])) + ("|" + payload.order_id if payload.order_id else "")
    now = datetime.utcnow().isoformat()
    message_doc = {
        "conversation_key": conversation_key,
        "sender_id": user["id"],
        "sender_name": user.get("name", ""),
        "sender_role": user["role"],
        "recipient_id": recipient_id,
        "recipient_type": payload.recipient_type,
        "product_id": payload.product_id or "",
        "order_id": payload.order_id or "",
        "message": payload.message.strip(),
        "created_at": now,
        "read": False,
    }
    result = await db.store_chat_messages.insert_one(message_doc)
    message_doc["id"] = str(result.inserted_id)
    message_doc.pop("_id", None)
    return message_doc


@api_router.get("/store/chat/conversations")
async def get_store_chat_conversations(user: dict = Depends(get_current_user)):
    query = {"$or": [{"sender_id": user["id"]}, {"recipient_id": user["id"]}]}
    if user["role"] == "admin":
        query = {"$or": [{"recipient_id": "admin"}, {"sender_role": "admin"}]}
    messages = await db.store_chat_messages.find(query).sort("created_at", -1).to_list(500)
    seen = set(); conversations = []
    for m in messages:
        key = m.get("conversation_key")
        if key and key not in seen:
            seen.add(key)
            conversations.append({"conversation_key": key, "last_message": m.get("message", ""), "created_at": m.get("created_at", ""), "other_party_id": m.get("recipient_id") if m.get("sender_id") == user["id"] else m.get("sender_id"), "order_id": m.get("order_id", "")})
    return conversations


@api_router.get("/store/chat/messages/{conversation_key}")
async def get_store_chat_messages(conversation_key: str, user: dict = Depends(get_current_user)):
    messages = await db.store_chat_messages.find({"conversation_key": conversation_key}).sort("created_at", 1).to_list(500)
    if not messages or not any(user["id"] in [m.get("sender_id"), m.get("recipient_id")] or (m.get("recipient_id") == "admin" and user["role"] == "admin") for m in messages):
        raise HTTPException(status_code=404, detail="Conversation not found")
    output = []
    for m in messages:
        output.append({"id": str(m["_id"]), "sender_id": m.get("sender_id"), "sender_name": m.get("sender_name"), "sender_role": m.get("sender_role"), "recipient_id": m.get("recipient_id"), "message": m.get("message"), "created_at": m.get("created_at"), "read": m.get("read", False)})
    return output


@api_router.post("/store/chat/messages/{conversation_key}/reply")
async def reply_store_chat_message(conversation_key: str, payload: StoreChatReply, user: dict = Depends(get_current_user)):
    previous = await db.store_chat_messages.find_one({"conversation_key": conversation_key}, sort=[("created_at", -1)])
    if not previous:
        raise HTTPException(status_code=404, detail="Conversation not found")
    allowed = user["id"] in [previous.get("sender_id"), previous.get("recipient_id")] or (user["role"] == "admin" and previous.get("recipient_id") == "admin")
    if not allowed:
        raise HTTPException(status_code=403, detail="You cannot reply to this conversation")
    recipient = previous.get("sender_id") if previous.get("recipient_id") == user["id"] or user["role"] == "admin" else previous.get("recipient_id")
    if recipient == "admin" and user["role"] == "admin":
        recipient = previous.get("sender_id")
    doc = {"conversation_key": conversation_key, "sender_id": user["id"], "sender_name": user.get("name", "PujariGo Support" if user["role"] == "admin" else ""), "sender_role": user["role"], "recipient_id": recipient, "recipient_type": "admin" if user["role"] == "admin" else "seller", "message": payload.message.strip(), "created_at": datetime.utcnow().isoformat(), "read": False}
    result = await db.store_chat_messages.insert_one(doc)
    return {"id": str(result.inserted_id), "conversation_key": conversation_key, "message": doc["message"], "created_at": doc["created_at"]}


# ==================== END CUSTOMER STORE FEATURES ====================

# ==================== DELHIVERY TEST SHIPMENT ====================

@api_router.post("/store/admin/orders/{order_id}/delhivery-test")
async def test_delhivery_shipment(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])

    # Never run this simulation unless test mode is enabled.
    delhivery_test_mode = (
        os.getenv("DELHIVERY_TEST_MODE", "false").strip().lower()
        == "true"
    )

    if not delhivery_test_mode:
        raise HTTPException(
            status_code=403,
            detail="Delhivery test mode must be enabled.",
        )

    try:
        order_object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid store order ID",
        )

    order = await db.store_orders.find_one({
        "_id": order_object_id,
    })

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Store order not found",
        )

    # Online orders must have verified payment before shipment preparation.
    if (
        order.get("payment_method") != "cod"
        and order.get("payment_status") != "paid"
    ):
        raise HTTPException(
            status_code=400,
            detail="Online payment must be verified before shipment preparation.",
        )

    items = order.get("items", [])

    if not items:
        raise HTTPException(
            status_code=400,
            detail="The order contains no items.",
        )

    shipment_items = []

    for item in items:
        shipment_items.append({
            "name": str(item.get("name", "Puja Item")),
            "quantity": int(item.get("quantity", 1)),
            "price": float(item.get("unit_price", 0)),
        })

    # This is only a preview. No request is sent to Delhivery.
    shipment_preview = {
        "pickup_location": DELHIVERY_EXISTING_PICKUP_NAME,
        "order_id": str(order["_id"]),
        "payment_method": order.get("payment_method", ""),
        "payment_status": order.get("payment_status", ""),
        "customer_name": order.get("customer_name", ""),
        "customer_phone": order.get("customer_phone", ""),
        "delivery_address": order.get("delivery_address", ""),
        "city": order.get("city", ""),
        "pincode": order.get("pincode", ""),
        "total_amount": float(order.get("total_amount", 0)),
        "items": shipment_items,
    }

    return {
        "test_mode": True,
        "simulated": True,
        "delhivery_contacted": False,
        "waybill_created": False,
        "message": (
            "Shipment preview prepared successfully. "
            "No shipment or waybill was created."
        ),
        "shipment_preview": shipment_preview,
    }
    
# ==================== DELHIVERY SHIPMENT PREVIEW ====================

@api_router.post("/store/admin/orders/{order_id}/delhivery-staging")
async def create_delhivery_staging_shipment(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])
    

    test_mode = DELHIVERY_TEST_MODE

    if not test_mode:
        raise HTTPException(
            status_code=403,
            detail="Test mode must remain enabled during review.",
        )

    try:
        order_object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid store order ID.",
        )

    order = await db.store_orders.find_one({"_id": order_object_id})

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Store order not found.",
        )

    if not order.get("items"):
        raise HTTPException(
            status_code=400,
            detail="The order contains no items.",
        )

    payment_method = str(order.get("payment_method", "")).lower()

    if payment_method != "cod" and order.get("payment_status") != "paid":
        raise HTTPException(
            status_code=400,
            detail="Online payment must be verified before shipment preparation.",
        )

    if order.get("tracking_number"):
        raise HTTPException(
            status_code=409,
            detail="This order already has a tracking number.",
        )

    shipment_preview = {
        "order_id": str(order["_id"]),
        "pickup_location": DELHIVERY_EXISTING_PICKUP_NAME,
        "customer_name": order.get("customer_name", ""),
        "customer_phone": order.get("customer_phone", ""),
        "delivery_address": order.get("delivery_address", ""),
        "city": order.get("city", ""),
        "pincode": order.get("pincode", ""),
        "payment_method": payment_method,
        "payment_status": order.get("payment_status", ""),
        "total_amount": float(order.get("total_amount", 0)),
        "items": [
            {
                "name": str(item.get("name", "Puja Item")),
                "quantity": int(item.get("quantity", 1)),
                "price": float(item.get("unit_price", 0)),
            }
            for item in order.get("items", [])
        ],
    }

    return {
        "test_mode": True,
        "preview_only": True,
        "delhivery_contacted": False,
        "production_contacted": False,
        "waybill_created": False,
        "shipment_preview": shipment_preview,
        "message": (
            "Preview prepared. No request was sent to Delhivery. "
            "Production integration has not been activated."
        ),
    }



# ==================== DELHIVERY SHIPMENT ====================
# Shipment and tracking URLs are defined once from DELHIVERY_BASE_URL above.


def _delhivery_headers() -> dict:
    return {
        "Authorization": f"Token {DELHIVERY_API_TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }


async def _schedule_delhivery_pickup_for_order(
    order_id: str,
    seller_application: dict,
    pickup_location: str,
):
    """Schedule one pickup request per seller warehouse and pickup date.

    Delhivery may already have automatic pickup enabled. In that case its
    response is recorded and no manual pickup request is repeated.
    """
    order_oid = ObjectId(order_id)
    pickup_days = seller_application.get("pickup_days") or []
    valid_days = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6,
    }
    selected = {valid_days[d] for d in pickup_days if d in valid_days}
    if not selected:
        result = {
            "status": "seller_pickup_days_missing",
            "message": "Seller must choose pickup days before pickup can be scheduled.",
        }
        await db.store_orders.update_one({"_id": order_oid}, {"$set": {
            "delhivery_pickup_request_status": result["status"],
            "delhivery_pickup_request_message": result["message"],
        }})
        return result

    try:
        pickup_clock = datetime.strptime(DELHIVERY_PICKUP_TIME, "%H:%M:%S").time()
    except ValueError:
        result = {
            "status": "invalid_pickup_time_config",
            "message": "DELHIVERY_PICKUP_TIME must use HH:MM:SS format.",
        }
        await db.store_orders.update_one({"_id": order_oid}, {"$set": {
            "delhivery_pickup_request_status": result["status"],
            "delhivery_pickup_request_message": result["message"],
        }})
        return result

    now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
    pickup_date = None
    for offset in range(0, 8):
        candidate = now_ist.date() + timedelta(days=offset)
        if candidate.weekday() in selected and (
            offset > 0 or now_ist.time().replace(tzinfo=None) < pickup_clock
        ):
            pickup_date = candidate
            break
    if pickup_date is None:
        result = {
            "status": "no_pickup_day_available",
            "message": "No selected seller pickup day is available in the next 7 days.",
        }
        await db.store_orders.update_one({"_id": order_oid}, {"$set": {
            "delhivery_pickup_request_status": result["status"],
            "delhivery_pickup_request_message": result["message"],
        }})
        return result

    pickup_date_text = pickup_date.isoformat()
    request_id = f"{pickup_location}:{pickup_date_text}"
    lock_doc = {
        "_id": request_id,
        "pickup_location": pickup_location,
        "pickup_date": pickup_date_text,
        "status": "requesting",
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        await db.delhivery_pickup_requests.insert_one(lock_doc)
    except Exception:
        existing = await db.delhivery_pickup_requests.find_one({"_id": request_id})
        if existing:
            result = {
                "status": existing.get("status", "request_in_progress"),
                "pickup_request_id": existing.get("pickup_request_id"),
                "message": existing.get("message", "A pickup request for this warehouse and date already exists or is being processed."),
            }
            await db.store_orders.update_one({"_id": order_oid}, {"$set": {
                "delhivery_pickup_request_status": result["status"],
                "delhivery_pickup_request_id": result.get("pickup_request_id"),
                "delhivery_pickup_date": pickup_date_text,
            }})
            return result
        raise

    payload = {
        "pickup_time": pickup_clock.strftime("%H:%M:%S"),
        "pickup_date": pickup_date_text,
        "pickup_location": pickup_location,
        "expected_package_count": 1,
    }
    try:
        async with httpx.AsyncClient(timeout=25.0) as http:
            response = await http.post(
                DELHIVERY_PICKUP_REQUEST_URL,
                headers={
                    "Authorization": f"Token {DELHIVERY_API_TOKEN}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        try:
            response_data = response.json()
        except ValueError:
            response_data = {"message": response.text[:1000]}
        response_text = str(response_data)[:1500]
        lower_text = response_text.lower()

        if "auto pickup" in lower_text and ("enabled" in lower_text or "client is on" in lower_text):
            status_value = "automatic_pickup_enabled"
            message = "Delhivery reports that automatic pickup is enabled for this account."
            pickup_id = None
        elif response.is_success:
            status_value = "scheduled"
            pickup_id = str(
                response_data.get("pickup_id")
                or response_data.get("pickup_request_id")
                or response_data.get("pickupId")
                or ""
            ) or None if isinstance(response_data, dict) else None
            message = "Delhivery accepted the pickup request."
        elif any(term in lower_text for term in ("already exist", "already exists", "already raised")):
            status_value = "already_scheduled"
            pickup_id = None
            message = "Delhivery reports an existing pickup request for this warehouse. It may cover ready-to-ship parcels at this location."
        else:
            status_value = "needs_review"
            pickup_id = None
            message = f"Delhivery did not confirm pickup scheduling (HTTP {response.status_code}). Review the Delhivery response before retrying."

        await db.delhivery_pickup_requests.update_one({"_id": request_id}, {"$set": {
            "status": status_value,
            "pickup_request_id": pickup_id,
            "message": message,
            "response": response_data,
            "updated_at": datetime.utcnow().isoformat(),
        }})
        result = {"status": status_value, "pickup_request_id": pickup_id, "message": message}
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        result = {
            "status": "unknown",
            "pickup_request_id": None,
            "message": "Pickup request result is uncertain. Check Delhivery before retrying.",
        }
        await db.delhivery_pickup_requests.update_one({"_id": request_id}, {"$set": {
            "status": "unknown",
            "message": result["message"],
            "updated_at": datetime.utcnow().isoformat(),
        }})
        logger.warning("Delhivery pickup request uncertain for order %s: %s", order_id, type(exc).__name__)

    await db.store_orders.update_one({"_id": order_oid}, {"$set": {
        "delhivery_pickup_request_status": result["status"],
        "delhivery_pickup_request_id": result.get("pickup_request_id"),
        "delhivery_pickup_request_message": result["message"],
        "delhivery_pickup_date": pickup_date_text,
        "delhivery_pickup_time": pickup_clock.strftime("%H:%M:%S"),
        "updated_at": datetime.utcnow().isoformat(),
    }})
    return result


async def _get_state_from_pincode(pincode: str) -> str:
    """Look up an Indian state using a six-digit PIN code."""
    pin = "".join(ch for ch in str(pincode or "") if ch.isdigit())

    if len(pin) != 6:
        raise HTTPException(
            status_code=400,
            detail="A valid six-digit pincode is required."
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            response = await http.get(
                f"https://api.postalpincode.in/pincode/{pin}"
            )
            response.raise_for_status()
            data = response.json()

        if not isinstance(data, list) or not data:
            raise ValueError("Invalid pincode lookup response")

        result = data[0]

        if result.get("Status") != "Success":
            raise HTTPException(
                status_code=400,
                detail=f"No state found for pincode {pin}."
            )

        offices = result.get("PostOffice") or []
        states = {
            str(office.get("State") or "").strip()
            for office in offices
            if office.get("State")
        }

        if len(states) != 1:
            raise HTTPException(
                status_code=400,
                detail="Pincode lookup did not return one clear state."
            )

        return states.pop()

    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(
            "Pincode state lookup failed for %s: %s",
            pin, type(exc).__name__
        )
        raise HTTPException(
            status_code=503,
            detail="Could not verify the state from the pincode. Please try again."
        )


@api_router.post("/store/admin/orders/{order_id}/delhivery-create")
async def create_delhivery_production_shipment(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])
    return await _create_delhivery_shipment_for_order(order_id)


async def _create_delhivery_shipment_for_order(order_id: str):
    """Create one seller-specific shipment, then schedule its warehouse pickup.

    This helper is called by both the admin endpoint and the seller's
    Ready for Pickup action. External calls remain disabled in test mode.
    """

    try:
        order_object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid store order ID.")

    order = await db.store_orders.find_one({"_id": order_object_id})
    if not order:
        raise HTTPException(status_code=404, detail="Store order not found.")

    test_mode = DELHIVERY_TEST_MODE
    if test_mode or not DELHIVERY_LIVE_SHIPMENTS_ENABLED:
        automation_status = "test_mode_waiting" if test_mode else "live_shipments_disabled"
        await db.store_orders.update_one(
            {"_id": order_object_id},
            {"$set": {
                "delhivery_automation_status": automation_status,
                "delhivery_automation_updated_at": datetime.utcnow().isoformat(),
            }},
        )
        return {
            "message": (
                "Order is ready. Automatic Delhivery shipment and pickup "
                "are waiting for staging checks and activation."
            ),
            "shipment_created": False,
            "pickup_scheduled": False,
            "delhivery_contacted": False,
            "automation_status": automation_status,
            "test_mode": test_mode,
        }

    if not DELHIVERY_API_TOKEN:
        raise HTTPException(status_code=503, detail="DELHIVERY_API_TOKEN is not configured.")

    if not (order.get("seller_parcel") or {}).get("ready_for_pickup"):
        raise HTTPException(
            status_code=409,
            detail="Seller must mark the parcel ready for pickup first.",
        )

    if order.get("tracking_number") or order.get("delhivery_status") == "created":
        raise HTTPException(status_code=409, detail="This order already has a Delhivery waybill.")

    payment_method = str(order.get("payment_method", "")).strip().lower()
    if payment_method != "cod" and order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Verify online payment before shipping.")

    items = order.get("items") or []
    # locations have been verified and registered.
    seller_ids = {
        str(item.get("seller_id") or "").strip()
        for item in items
        if item.get("seller_id")
    }

    if seller_ids:
        seller_applications = await db.seller_applications.find({
            "user_id": {"$in": list(seller_ids)}
        }).to_list(500)

        applications_by_user = {
            str(app.get("user_id")): app
            for app in seller_applications
        }

        for seller_id in seller_ids:
            application = applications_by_user.get(seller_id)

            if (
                not application
                or application.get("delhivery_pickup_status") != "registered"
                or application.get("delhivery_pickup_verified") is not True
                or not application.get("delhivery_pickup_name")
                or not application.get("shop_address")
                or not application.get("city")
                or not application.get("pincode")
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Shipment blocked: at least one seller's "
                        "Delhivery pickup location is not verified. "
                        "Register and verify each seller's real pickup "
                        "location before creating a live shipment."
                    ),
                )
    
    if not items:
        raise HTTPException(status_code=400, detail="The order contains no items.")

    # SAFETY: Block mixed-seller orders until separate shipments
    # are implemented for each seller.
    if any(not item.get("seller_id") for item in items):
        raise HTTPException(
            status_code=400,
            detail=(
                "Shipment blocked: one or more products have no seller assigned."
            ),
        )

    shipment_seller_ids = {
        str(item.get("seller_id")).strip()
        for item in items
    }

    if len(shipment_seller_ids) != 1:
        raise HTTPException(
            status_code=400,
            detail=(
                "Shipment blocked: this order contains products from multiple "
                "sellers. Separate seller shipments must be implemented first."
            ),
        )


    required = {
        "customer_name": order.get("customer_name"),
        "customer_phone": order.get("customer_phone"),
        "delivery_address": order.get("delivery_address"),
        "city": order.get("city"),
        "pincode": order.get("pincode"),
    }
    missing = [k for k, v in required.items() if not str(v or "").strip()]
    if missing:
        raise HTTPException(
            status_code=400,
            detail={"message": "Delivery details are incomplete.", "missing_fields": missing},
        )

    phone = "".join(ch for ch in str(order["customer_phone"]) if ch.isdigit())
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Customer phone number is invalid.")
    pin = "".join(ch for ch in str(order["pincode"]) if ch.isdigit())
    if len(pin) != 6:
        raise HTTPException(status_code=400, detail="Customer pincode must contain 6 digits.")

    total = round(float(order.get("total_amount", 0) or 0), 2)
    if total <= 0:
        raise HTTPException(status_code=400, detail="Order total must be greater than zero.")

    products_desc = ", ".join(
        f"{str(item.get('name', 'Puja Item'))[:80]} x {max(1, int(item.get('quantity', 1)))}"
        for item in items
    )[:500]
    quantity = sum(
        max(1, int(item.get("quantity", 1)))
        for item in items
    )
    payment_mode = "COD" if payment_method == "cod" else "Pre-paid"

    saved_parcel = order.get("seller_parcel") or {}
    total_weight_grams = int(saved_parcel.get("weight_grams") or 0)
    if total_weight_grams <= 0:
        total_weight_grams = sum(
            int(item.get("weight_grams", 500) or 500)
            * max(1, int(item.get("quantity", 1)))
            for item in items
        )

    if total_weight_grams <= 0 or total_weight_grams > 100000:
        raise HTTPException(
            status_code=400,
            detail="Shipment blocked: total package weight is invalid.",
        )

    total_weight_kg = total_weight_grams / 1000


    shipment_seller_id = next(iter(shipment_seller_ids))
    seller_application = await db.seller_applications.find_one({
        "user_id": shipment_seller_id,
        "status": "approved",
        "delhivery_pickup_status": "registered",
        "delhivery_pickup_verified": True,
    })

    if not seller_application:
        raise HTTPException(
            status_code=400,
            detail="Shipment blocked: the seller's verified pickup location could not be found.",
        )

    seller_pickup_name = str(
        seller_application.get("delhivery_pickup_name") or ""
    ).strip()

    if not seller_pickup_name:
        raise HTTPException(
            status_code=400,
            detail="Shipment blocked: the seller has no registered pickup location name.",
        )

    # Claim only after all local validation has passed. Ambiguous API outcomes
    # remain locked for manual review to prevent duplicate waybills.
    claim = await db.store_orders.update_one(
        {
            "_id": order_object_id,
            "tracking_number": {"$in": [None, ""]},
            "delhivery_status": {"$nin": ["creating", "created", "unknown"]},
        },
        {"$set": {
            "delhivery_status": "creating",
            "delhivery_attempted_at": datetime.utcnow().isoformat(),
            "delhivery_automation_status": "shipment_creating",
            "updated_at": datetime.utcnow().isoformat(),
        }},
    )
    if claim.modified_count != 1:
        raise HTTPException(
            status_code=409,
            detail="Shipment creation is already in progress or needs manual review. Do not retry until checked.",
        )

    shipment = {
        "name": str(order["customer_name"]).strip(),
        "order": str(order["_id"]),
        "phone": phone[-10:],
        "add": str(order["delivery_address"]).strip(),
        "city": str(order["city"]).strip(),
        "pin": pin,
        "country": "India",
        "payment_mode": payment_mode,
        "products_desc": products_desc or "Puja Samagri",
        "quantity": str(quantity),
        "total_amount": str(total),
        "cod_amount": str(total if payment_mode == "COD" else 0),
        "weight": str(total_weight_kg),
        "shipping_mode": "Surface",
    }
    request_payload = {
        "format": "json",
        "data": __import__("json").dumps({
            "shipments": [shipment],
            "pickup_location": {"name": seller_pickup_name},
        }),
    }

    try:
        async with httpx.AsyncClient(timeout=35.0) as http:
            response = await http.post(
                DELHIVERY_SHIPMENT_URL,
                headers=_delhivery_headers(),
                data=request_payload,
            )
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        await db.store_orders.update_one(
            {"_id": order_object_id, "delhivery_status": "creating"},
            {"$set": {
                "delhivery_status": "unknown",
                "delhivery_error": "Request result uncertain; check Delhivery before retrying.",
                "updated_at": datetime.utcnow().isoformat(),
            }},
        )
        logger.warning("Delhivery request result uncertain for order %s: %s", order_id, type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Delhivery response was not confirmed. Shipment status is unknown; check Delhivery before retrying.",
        ) from exc

    try:
        data = response.json()
    except ValueError:
        data = {}

    packages = data.get("packages", []) if isinstance(data, dict) else []
    package = packages[0] if packages and isinstance(packages[0], dict) else {}
    waybill = str(package.get("waybill") or package.get("wb") or "").strip()
    package_status = str(package.get("status") or "").strip().lower()
    success = (
        response.is_success
        and bool(waybill)
        and package_status in {"success", "successful", "created"}
        and not data.get("error")
    )

    if not success:
        # Do not blindly retry: some carrier responses may be ambiguous.
        await db.store_orders.update_one(
            {"_id": order_object_id, "delhivery_status": "creating"},
            {"$set": {
                "delhivery_status": "unknown",
                "delhivery_http_status": response.status_code,
                "delhivery_error": "Delhivery did not return a clearly confirmed waybill. Check the Delhivery dashboard before retrying.",
                "updated_at": datetime.utcnow().isoformat(),
            }},
        )
        logger.warning(
            "Delhivery shipment not confirmed for order %s (HTTP %s)",
            order_id, response.status_code,
        )
        raise HTTPException(
            status_code=502,
            detail="Delhivery did not confirm a waybill. Check the Delhivery dashboard before retrying to avoid duplicate shipments.",
        )

    tracking_url = f"https://www.delhivery.com/track/package/{waybill}"
    await db.store_orders.update_one(
        {"_id": order_object_id, "delhivery_status": "creating"},
        {"$set": {
            "courier": "Delhivery",
            "tracking_number": waybill,
            "tracking_url": tracking_url,
            "delhivery_status": "created",
            "delhivery_created_at": datetime.utcnow().isoformat(),
            "delhivery_upload_wbn": str(data.get("upload_wbn") or ""),
            "order_status": "Shipped",
            "delhivery_automation_status": "shipment_created",
            "updated_at": datetime.utcnow().isoformat(),
        }},
    )
    pickup_result = await _schedule_delhivery_pickup_for_order(
        order_id, seller_application, seller_pickup_name
    )
    return {
        "message": "Delhivery shipment created and waybill saved.",
        "shipment_created": True,
        "delhivery_contacted": True,
        "pickup_location": seller_pickup_name,
        "pickup_scheduled": pickup_result.get("status") in {
            "scheduled", "automatic_pickup_enabled", "already_scheduled"
        },
        "pickup_result": pickup_result,
        "order_id": order_id,
        "waybill": waybill,
        "courier": "Delhivery",
        "tracking_url": tracking_url,
        "order_status": "Shipped",
    }


# ==================== NOTIFICATIONS SYSTEM ====================

class NotificationCreate(BaseModel):
    user_id: str
    title: str = Field(..., max_length=120)
    message: str = Field(..., max_length=500)
    notification_type: str = Field(default="general")
    reference_id: Optional[str] = None

async def create_notification(user_id: str, title: str, message: str, notification_type: str = "general", reference_id: str = None):
    doc = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "notification_type": notification_type,
        "reference_id": reference_id,
        "is_read": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.store_notifications.insert_one(doc)

@api_router.get("/store/notifications")
async def get_my_notifications(user: dict = Depends(get_current_user)):
    notifications = await db.store_notifications.find({
        "user_id": user["id"]
    }).sort("created_at", -1).to_list(100)

    for n in notifications:
        n["id"] = str(n.pop("_id"))
    return notifications

@api_router.put("/store/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user: dict = Depends(get_current_user)
):
    try:
        oid = ObjectId(notification_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid notification ID"
        )

    await db.store_notifications.update_one(
        {"_id": oid, "user_id": user["id"]},
        {"$set": {"is_read": True}}
    )

    return {"message": "Notification marked as read"}

class StoreProductReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


@api_router.post("/store/products/{product_id}/reviews")
async def create_product_review(
    product_id: str,
    payload: StoreProductReviewCreate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["customer"])

    try:
        product_oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")

    product = await db.store_products.find_one({"_id": product_oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    review_doc = {
        "product_id": str(product_oid),
        "customer_id": user["id"],
        "customer_name": user.get("name", "Customer"),
        "rating": payload.rating,
        "comment": payload.comment.strip(),
        "created_at": datetime.utcnow().isoformat(),
    }

    result = await db.store_product_reviews.insert_one(review_doc)
    review_doc["id"] = str(result.inserted_id)
    review_doc.pop("_id", None)

    # Recalculate average rating & review count for the product
    reviews = await db.store_product_reviews.find({"product_id": str(product_oid)}).to_list(1000)
    avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews) if reviews else 0

    await db.store_products.update_one(
        {"_id": product_oid},
        {"$set": {"average_rating": round(avg_rating, 1), "review_count": len(reviews)}}
    )

    return review_doc

@api_router.get("/store/products/{product_id}/reviews")
async def list_product_reviews(product_id: str):
    reviews = await db.store_product_reviews.find({"product_id": product_id}).sort("created_at", -1).to_list(200)
    for r in reviews:
        r["id"] = str(r.pop("_id"))
    return reviews


# ==================== DELHIVERY TRACKING AUTOMATION ====================

async def _fetch_and_save_delhivery_tracking(order: dict) -> dict:
    """Fetch one waybill's current status and safely persist it."""
    order_id = str(order.get("_id") or "")
    waybill = str(order.get("tracking_number") or "").strip()

    if not waybill or str(order.get("courier") or "").strip().lower() != "delhivery":
        return {"updated": False, "reason": "Delhivery waybill is missing"}
    if not DELHIVERY_API_TOKEN:
        return {"updated": False, "reason": "Delhivery API token is not configured"}

    try:
        async with httpx.AsyncClient(timeout=25.0) as http:
            response = await http.get(
                DELHIVERY_TRACKING_URL,
                headers={
                    "Authorization": f"Token {DELHIVERY_API_TOKEN}",
                    "Accept": "application/json",
                },
                params={"waybill": waybill},
            )
        response.raise_for_status()
        tracking_data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning(
            "Delhivery tracking request failed for order %s (%s)",
            order_id, type(exc).__name__,
        )
        return {"updated": False, "reason": "Carrier tracking request failed"}

    shipment_data = (
        tracking_data.get("ShipmentData", [])
        if isinstance(tracking_data, dict) else []
    )
    shipment = {}
    if (
        isinstance(shipment_data, list)
        and shipment_data
        and isinstance(shipment_data[0], dict)
    ):
        shipment = shipment_data[0].get("Shipment", {}) or {}

    if not isinstance(shipment, dict) or not shipment:
        return {"updated": False, "reason": "No shipment details returned"}

    status_info = shipment.get("Status", {}) or {}
    status_text = str(status_info.get("Status") or "").strip()
    status_type = str(status_info.get("StatusType") or "").strip().upper()
    old_status = str(order.get("order_status") or "Shipped")
    mapped_status = old_status

    # Do not regress a delivered order if the carrier later returns an older scan.
    if old_status != "Delivered":
        if status_type == "DL" or status_text.lower() == "delivered":
            mapped_status = "Delivered"
        elif status_type == "UD" and "out for delivery" in status_text.lower():
            mapped_status = "Out for Delivery"
        elif status_type in {"PU", "PP", "IT", "OT"}:
            mapped_status = "Shipped"

    now = datetime.utcnow().isoformat()
    updates = {
        "delhivery_last_status": status_text,
        "delhivery_last_status_type": status_type,
        "order_status": mapped_status,
        "delhivery_last_checked_at": now,
        "updated_at": now,
    }
    if mapped_status == "Delivered" and not order.get("delivered_at"):
        updates["delivered_at"] = now

    # Save only bounded, useful tracking details; avoid storing the full carrier payload.
    scan_container = shipment.get("Scans", {}) or {}
    scan_details = scan_container.get("ScanDetail", []) if isinstance(scan_container, dict) else []
    if isinstance(scan_details, list):
        updates["delhivery_scan_count"] = len(scan_details)

    await db.store_orders.update_one(
        {"_id": order["_id"], "tracking_number": waybill},
        {"$set": updates},
    )
    return {
        "updated": True,
        "order_id": order_id,
        "tracking_number": waybill,
        "order_status": mapped_status,
        "delhivery_status": status_text,
        "status_type": status_type,
    }


@api_router.get("/store/orders/{order_id}/delhivery-tracking")
async def refresh_my_delhivery_tracking(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    try:
        order_object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid store order ID.")

    query = {"_id": order_object_id}
    if user.get("role") != "admin":
        query["customer_id"] = user["id"]

    order = await db.store_orders.find_one(query)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    waybill = str(order.get("tracking_number") or "").strip()
    if not waybill or str(order.get("courier") or "").strip().lower() != "delhivery":
        return {
            "order_id": order_id,
            "tracking_number": waybill,
            "order_status": order.get("order_status", ""),
            "tracking_url": order.get("tracking_url", ""),
            "message": "Delhivery tracking is not available for this order yet.",
        }

    result = await _fetch_and_save_delhivery_tracking(order)
    if not result.get("updated"):
        raise HTTPException(
            status_code=503,
            detail=result.get("reason", "Unable to refresh tracking right now."),
        )
    result["tracking_url"] = order.get("tracking_url", "")
    return result


async def _run_delhivery_tracking_cycle() -> None:
    """Refresh a limited batch of active Delhivery orders."""
    if not DELHIVERY_AUTO_TRACKING_ENABLED or not DELHIVERY_API_TOKEN:
        return

    now = datetime.utcnow()
    now_text = now.isoformat()
    cutoff = (
        now - timedelta(seconds=DELHIVERY_AUTO_TRACKING_INTERVAL_SECONDS)
    ).isoformat()
    lock_id = "delhivery_tracking_scheduler"
    owner = uuid.uuid4().hex
    lease_until = (now + timedelta(minutes=30)).isoformat()

    # A MongoDB lease prevents multiple Render instances polling the same batch.
    lock_result = await db.automation_locks.update_one(
        {
            "_id": lock_id,
            "$or": [
                {"lease_until": {"$lt": now_text}},
                {"lease_until": {"$exists": False}},
            ],
        },
        {"$set": {"owner": owner, "lease_until": lease_until}},
    )
    if lock_result.matched_count == 0:
        try:
            await db.automation_locks.insert_one({
                "_id": lock_id,
                "owner": owner,
                "lease_until": lease_until,
            })
        except Exception:
            return

    try:
        cursor = db.store_orders.find({
            "courier": {"$regex": "^delhivery$", "$options": "i"},
            "tracking_number": {"$nin": [None, ""]},
            "order_status": {"$nin": ["Delivered", "Cancelled", "Returned"]},
            "$or": [
                {"delhivery_last_checked_at": {"$exists": False}},
                {"delhivery_last_checked_at": {"$lt": cutoff}},
            ],
        }).sort("delhivery_last_checked_at", 1).limit(
            DELHIVERY_AUTO_TRACKING_BATCH_SIZE
        )

        async for order in cursor:
            try:
                await _fetch_and_save_delhivery_tracking(order)
            except Exception:
                logger.exception(
                    "Automatic Delhivery tracking failed for order %s",
                    str(order.get("_id")),
                )
    finally:
        await db.automation_locks.update_one(
            {"_id": lock_id, "owner": owner},
            {"$set": {"lease_until": datetime.utcnow().isoformat()}},
        )


async def _delhivery_tracking_scheduler() -> None:
    """Background loop; runs only while this FastAPI process is alive."""
    while True:
        try:
            await _run_delhivery_tracking_cycle()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Delhivery automatic tracking cycle failed")
        await asyncio.sleep(DELHIVERY_AUTO_TRACKING_INTERVAL_SECONDS)


@api_router.get("/store/admin/delhivery/automation-status")
async def delhivery_automation_status(
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])
    return {
        "automatic_tracking_enabled": DELHIVERY_AUTO_TRACKING_ENABLED,
        "tracking_interval_seconds": DELHIVERY_AUTO_TRACKING_INTERVAL_SECONDS,
        "batch_size": DELHIVERY_AUTO_TRACKING_BATCH_SIZE,
        "token_configured": bool(DELHIVERY_API_TOKEN),
        "note": "Read-only tracking requests only; this does not create shipments or pickups.",
    }


# ==================== DELHIVERY API CONFIG CHECK ====================

@api_router.get("/store/admin/delhivery/config-check")
async def delhivery_config_check(
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])
  
    test_mode = DELHIVERY_TEST_MODE

    return {
        "provider": "Delhivery",
        "environment": DELHIVERY_ENV,
        "api_base_url": DELHIVERY_BASE_URL,
        "tracking_base_url": DELHIVERY_TRACKING_BASE_URL,
        "token_configured": bool(DELHIVERY_API_TOKEN),
        "automatic_tracking_enabled": DELHIVERY_AUTO_TRACKING_ENABLED,
        "tracking_interval_seconds": DELHIVERY_AUTO_TRACKING_INTERVAL_SECONDS,
        "test_mode": test_mode,
        "live_shipments_enabled": DELHIVERY_LIVE_SHIPMENTS_ENABLED,
        "seller_specific_pickup_locations": True,
        "shipment_created": False,
        "delhivery_contacted": False,
        "message": (
            "Configuration check only. No shipment, AWB, warehouse, or pickup request was created."
        ),
    }


app.include_router(api_router)
