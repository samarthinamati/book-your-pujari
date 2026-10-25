from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from typing import Optional, List
from bson import ObjectId
import logging
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

DELHIVERY_API_TOKEN = os.getenv("DELHIVERY_API_TOKEN", "")

DELHIVERY_WAREHOUSE_URL = (
    "https://track.delhivery.com/api/backend/clientwarehouse/create/"
)
# Reuse the existing Delhivery pickup location.
# Never register dummy or admin test addresses.
DELHIVERY_EXISTING_PICKUP_NAME = "PUJARIGO B2C"

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
    pincode: str = Field(..., min_length=6, max_length=10)


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


class SellerPickupLocationUpdate(BaseModel):
    delhivery_pickup_name: str = Field(..., min_length=2, max_length=120)



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

    pickup_name = payload.delhivery_pickup_name.strip()

    if len(pickup_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Enter a valid Delhivery pickup-location name",
        )

        # Test mode: simulate registration without contacting Delhivery.
    DELHIVERY_TEST_MODE = (
        os.getenv("DELHIVERY_TEST_MODE", "false").strip().lower()
        == "true"
    )

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

        # SAFETY: Never register a new pickup location through this endpoint.
    # The existing PUJARIGO B2C location must be reused instead.
    raise HTTPException(
        status_code=403,
        detail=(
            "New Delhivery pickup registration is disabled. "
            "Use the existing PUJARIGO B2C pickup location."
        ),
    )
    # Live mode: prevent duplicate registrations.
    if application.get("delhivery_pickup_status") == "registered":
        raise HTTPException(
            status_code=409,
            detail=(
                "This seller already has a registered pickup location. "
                "Do not register it again."
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
                "delhivery_pickup_status": "registered",
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
            "Delhivery accepted the warehouse registration request. "
            "Verify the warehouse in Delhivery before creating shipments."
        ),
        "delhivery_pickup_name": pickup_name,
        "delhivery_pickup_status": "registered",
    }


@api_router.put(
    "/store/admin/seller-applications/{application_id}/use-existing-pickup"
)
async def use_existing_delhivery_pickup(
    application_id: str,
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])

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

    existing_pickup_name = DELHIVERY_EXISTING_PICKUP_NAME

    if not existing_pickup_name:
        raise HTTPException(
            status_code=503,
            detail="Existing Delhivery pickup name is not configured",
        )

    await db.seller_applications.update_one(
        {"_id": application_object_id},
        {
            "$set": {
                "delhivery_pickup_name": existing_pickup_name,
                "delhivery_pickup_status": "existing_location_selected",
                "delhivery_pickup_id": "",
                "updated_at": datetime.utcnow().isoformat(),
            },
            "$unset": {
                "delhivery_registration_response": "",
            },
        },
    )

    return {
        "message": (
            "Existing pickup location selected. "
            "No Delhivery registration request was sent."
        ),
        "delhivery_pickup_name": existing_pickup_name,
        "delhivery_pickup_status": "existing_location_selected",
        "registration_sent": False,
    }

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

@app.on_event("startup")
async def startup_event():
    await ensure_admin_account()



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
    is_available: bool = True



def serialize_store_product(product: dict) -> dict:
    return {
        "id": str(product["_id"]),
        "name": product.get("name", ""),
        "description": product.get("description", ""),
        "category": product.get("category", "Puja Samagri"),
        "price": product.get("price", 0),
        "image_url": product.get("image_url", ""),
        "stock": product.get("stock", 0),
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
    price: Optional[float] = Field(default=None, gt=0, le=100000)
    image_url: Optional[str] = Field(default=None, max_length=2000)
    stock: Optional[int] = Field(default=None, ge=0, le=100000)
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



def serialize_store_order(order: dict) -> dict:
    return {
        "id": str(order["_id"]),
        "items": order.get("items", []),
        "customer_name": order.get("customer_name", ""),
        "customer_phone": order.get("customer_phone", ""),
        "delivery_address": order.get("delivery_address", ""),
        "city": order.get("city", ""),
        "pincode": order.get("pincode", ""),
        "total_amount": order.get("total_amount", 0),
        "payment_status": order.get("payment_status", "pending"),
        "order_status": order.get("order_status", "Order Placed"),
        "courier": order.get("courier", ""),
        "tracking_number": order.get("tracking_number", ""),
        "tracking_url": order.get("tracking_url", ""),
        "created_at": order.get("created_at", ""),
    }


@api_router.post("/store/orders")
async def create_store_order(
    payload: StoreOrderCreate,
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["customer"])

    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order_items = []
    total_amount = 0
    payment_method = payload.payment_method.strip().lower()

    if payment_method not in {"online", "cod"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid payment method. Choose online or cod."
        )

    for item in payload.items:
        try:
            product_id = ObjectId(item.product_id)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid product ID"
            )

        product = await db.store_products.find_one({
            "_id": product_id,
            "is_available": True
        })

        if not product:
            raise HTTPException(
                status_code=404,
                detail="A product is unavailable"
            )

        if product.get("stock", 0) < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for {product['name']}"
            )

        unit_price = float(product["price"])
        line_total = round(unit_price * item.quantity, 2)
        total_amount += line_total

        order_items.append({
            "product_id": str(product["_id"]),
            "seller_id": product.get("seller_id", ""),
            "shop_name": product.get("shop_name", ""),
            "name": product["name"],
            "unit_price": unit_price,
            "quantity": item.quantity,
            "line_total": line_total,
            "image_url": product.get("image_url", "")
        })

    # Reserve/decrement stock atomically before creating the order. If any item
    # cannot be reserved, restore stock already reserved for this request.
    reserved = []
    try:
        for item in payload.items:
            product_id = ObjectId(item.product_id)
            reservation = await db.store_products.update_one(
                {
                    "_id": product_id,
                    "is_available": True,
                    "stock": {"$gte": item.quantity},
                },
                {"$inc": {"stock": -item.quantity}, "$set": {"updated_at": datetime.utcnow().isoformat()}},
            )
            if reservation.modified_count == 0:
                raise HTTPException(
                    status_code=409,
                    detail="Stock changed while placing the order. Please refresh your cart and try again."
                )
            reserved.append((product_id, item.quantity))
    except Exception:
        for reserved_id, reserved_quantity in reserved:
            await db.store_products.update_one(
                {"_id": reserved_id},
                {"$inc": {"stock": reserved_quantity}}
            )
        raise

    order = {
        "customer_id": user["id"],
        "items": order_items,
        "customer_name": payload.customer_name.strip(),
        "customer_phone": payload.customer_phone.strip(),
        "delivery_address": payload.delivery_address.strip(),
        "city": payload.city.strip(),
        "pincode": payload.pincode.strip(),
        "total_amount": round(total_amount, 2),
        "payment_method": payment_method,
        "payment_status": "pending",
        "order_status": (
            "Order Placed" if payment_method == "cod"
            else "Awaiting Payment"
        ),
        "courier": "",
        "tracking_number": "",
        "tracking_url": "",
        "return_status": "Not Requested",
        "created_at": datetime.utcnow().isoformat()
    }

    try:
        result = await db.store_orders.insert_one(order)
    except Exception:
        # Restore reserved stock if the order could not be saved.
        for reserved_id, reserved_quantity in reserved:
            await db.store_products.update_one(
                {"_id": reserved_id},
                {"$inc": {"stock": reserved_quantity}}
            )
        raise HTTPException(status_code=500, detail="Could not create the order. Please try again.")

    order["_id"] = result.inserted_id
    return serialize_store_order(order)

@api_router.get("/store/orders/my-orders")
async def get_my_store_orders(
    user: dict = Depends(get_current_user)
):
    await require_role(user, ["customer"])

    orders = await db.store_orders.find({
        "customer_id": user["id"]
    }).sort("created_at", -1).to_list(200)

    return [serialize_store_order(order) for order in orders]


class StorePaymentCreate(BaseModel):
    store_order_id: str


class StorePaymentVerify(BaseModel):
    store_order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str



# ==================== ADMIN STORE ORDER TRACKING ====================

class StoreOrderTrackingUpdate(BaseModel):
    order_status: str
    courier: Optional[str] = "DTDC"
    tracking_number: Optional[str] = ""
    tracking_url: Optional[str] = ""


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
        seller_order["items"] = seller_items
        seller_order["seller_total"] = round(
            sum(float(item.get("line_total", 0)) for item in seller_items),
            2,
        )
        seller_orders.append(seller_order)

    return seller_orders

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

    orders = await db.store_orders.find().sort(
        "created_at", -1
    ).to_list(500)

    return [serialize_store_order(order) for order in orders]


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
        "customer_id": user["id"]
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
                "updated_at": datetime.utcnow().isoformat()
            }
        }
    )

    if result.modified_count == 0:
        latest_order = await db.store_orders.find_one({"_id": store_order_object_id})
        if latest_order and latest_order.get("payment_status") == "paid":
            return {"message": "Payment already verified", "payment_status": "paid"}
        raise HTTPException(status_code=409, detail="Could not update payment status")

    return {
        "message": "Store payment verified successfully",
        "payment_status": "paid",
        "store_order_id": payload.store_order_id
    }

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
# ==================== DELHIVERY API CONFIG CHECK ====================

@api_router.get("/store/admin/delhivery/config-check")
async def delhivery_config_check(
    user: dict = Depends(get_current_user),
):
    await require_role(user, ["admin"])

    test_mode = (
        os.getenv("DELHIVERY_TEST_MODE", "false").strip().lower()
        == "true"
    )

    return {
        "token_configured": bool(DELHIVERY_API_TOKEN),
        "test_mode": test_mode,
        "pickup_location": DELHIVERY_EXISTING_PICKUP_NAME,
        "shipment_created": False,
        "delhivery_contacted": False,
        "message": (
            "Configuration check only. No request was sent to Delhivery."
        ),
    }


app.include_router(api_router)
