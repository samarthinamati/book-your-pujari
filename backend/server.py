from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from .auth import get_current_user
class UserLogin(BaseModel):
    phone: str
    password: str
api_router = APIRouter()
@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"phone": credentials.phone})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    
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
    
    if pooja:
        filtered_saints = []
        for saint in saints:
            for pooja_service in saint.get("poojas", []):
                if pooja.lower() in pooja_service["name"].lower():
                    filtered_saints.append(saint)
                    break
        saints = filtered_saints
    
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
    
    if not saint.get("is_approved") or not saint.get("is_active"):
        raise HTTPException(status_code=400, detail="Saint is not available")
    
    pooja_price = None
    for pooja in saint.get("poojas", []):
        if pooja["name"] == booking.pooja_name:
            pooja_price = pooja["price"]
            break
    
    if pooja_price is None:
        raise HTTPException(status_code=404, detail="Pooja not found")
    
    # Calculate prices (10% commission, rounded to nearest rupee)
    base_price = pooja_price
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
    if user["role"] == "customer":
        bookings = await db.bookings.find({"customer_id": user["id"]}).to_list(1000)
    elif user["role"] == "saint":
        profile = await db.saint_profiles.find_one({"user_id": user["id"]})
        if not profile:
            return []
        saint_id = str(profile["_id"])
        bookings = await db.bookings.find({"saint_id": saint_id}).to_list(1000)
    else:
        bookings = await db.bookings.find().to_list(1000)
    
    for booking in bookings:
        booking["id"] = str(booking.pop("_id"))
    
    return bookings

@api_router.get("/bookings/{booking_id}")
async def get_booking_details(booking_id: str, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if user["role"] == "customer" and booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif user["role"] == "saint":
        profile = await db.saint_profiles.find_one({"user_id": user["id"]})
        if not profile or str(profile["_id"]) != booking["saint_id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    booking["id"] = str(booking.pop("_id"))
    return booking

@api_router.put("/bookings/{booking_id}/saint-action")
async def saint_action_on_booking(
    booking_id: str,
    action_data: SaintActionRequest,
    user: dict = Depends(get_current_user)
):
    """Saint can accept or reject a booking. Auto-refund on reject."""
    await require_role(user, ["saint"])
    
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    profile = await db.saint_profiles.find_one({"user_id": user["id"]})
    if not profile or str(profile["_id"]) != booking["saint_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    current_action = booking.get("saint_action", "pending")
    if current_action != "pending":
        raise HTTPException(status_code=400, detail=f"Booking already {current_action}")
    
    if action_data.action not in ["accept", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    if action_data.action == "accept":
        await db.bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {"$set": {
                "saint_action": "accepted",
                "saint_action_reason": action_data.reason,
                "saint_action_at": datetime.utcnow().isoformat(),
                "booking_status": "confirmed" if booking.get("payment_status") == "paid" else "awaiting_payment"
            }}
        )
        return {
            "message": "Booking accepted successfully",
            "saint_action": "accepted",
            "booking_status": "confirmed" if booking.get("payment_status") == "paid" else "awaiting_payment"
        }
    
    # === REJECT FLOW - Trigger Razorpay refund only if paid ===
    refund_status = "not_applicable"
    refund_id = None
    refund_error = None
    
    if booking.get("payment_status") == "paid":
        razorpay_payment_id = booking.get("razorpay_payment_id")
        if razorpay_payment_id and razorpay_client:
            try:
                refund_amount = int(booking["total_price"] * 100)
                refund_response = razorpay_client.payment.refund(
                    razorpay_payment_id,
                    {
                        "amount": refund_amount,
                        "speed": "normal",
                        "notes": {"reason": "Saint rejected the booking", "booking_id": booking_id}
                    }
                )
                refund_id = refund_response.get("id")
                refund_status = refund_response.get("status", "processed")
            except Exception as e:
                logger.error(f"Refund failed: {e}")
                refund_error = str(e)
                refund_status = "failed"
    
    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "saint_action": "rejected",
            "saint_action_reason": action_data.reason,
            "saint_action_at": datetime.utcnow().isoformat(),
            "booking_status": "rejected",
            "refund_status": refund_status,
            "refund_id": refund_id,
            "refund_error": refund_error,
            "refund_initiated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {
        "message": "Booking rejected. Refund initiated.",
        "saint_action": "rejected",
        "booking_status": "rejected",
        "refund_status": refund_status,
        "refund_id": refund_id
    }

@api_router.get("/saints/similar/{booking_id}")
async def get_similar_saints(booking_id: str, user: dict = Depends(get_current_user)):
    """Get other saints in the same region who offer the same pooja"""
    await require_role(user, ["customer"])
    
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    original_saint = await db.saint_profiles.find_one({"_id": ObjectId(booking["saint_id"])})
    if not original_saint:
        return []
    
    original_location = original_saint.get("location", "")
    original_areas = original_saint.get("operating_areas", [])
    pooja_name = booking["pooja_name"]
    
    query = {
        "is_approved": True,
        "is_active": True,
        "_id": {"$ne": ObjectId(booking["saint_id"])},
        "$or": [
            {"location": original_location},
            {"operating_areas": {"$in": original_areas}}
        ]
    }
    
    saints = await db.saint_profiles.find(query).to_list(100)
    
    matching_saints = []
    for saint in saints:
        for pooja in saint.get("poojas", []):
            if pooja["name"].lower() == pooja_name.lower():
                saint["id"] = str(saint.pop("_id"))
                matching_saints.append(saint)
                break
    
    return matching_saints


@api_router.post("/payment/create-order", response_model=PaymentOrderResponse)
async def create_payment_order(order_data: PaymentOrderCreate, user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    
    booking = await db.bookings.find_one({"_id": ObjectId(order_data.booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking["payment_status"] != "pending":
        raise HTTPException(status_code=400, detail="Booking already paid")
    
    amount_in_paise = int(booking["total_price"] * 100)
    
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")
    
    try:
        razorpay_order = razorpay_client.order.create(data={
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": f"booking_{order_data.booking_id}",
            "payment_capture": 1,
            "notes": {
                "booking_id": order_data.booking_id,
                "customer_id": user["id"]
            }
        })
        
        await db.payment_orders.insert_one({
            "order_id": razorpay_order["id"],
            "booking_id": order_data.booking_id,
            "customer_id": user["id"],
            "amount": amount_in_paise,
            "currency": "INR",
            "status": "created",
            "created_at": datetime.utcnow().isoformat()
        })
        
        return PaymentOrderResponse(
            order_id=razorpay_order["id"],
            amount=amount_in_paise,
            currency="INR",
            booking_id=order_data.booking_id,
            key_id=RAZORPAY_KEY_ID
        )
    except Exception as e:
        logging.error(f"Error creating Razorpay order: {e}")
        error_msg = str(e)
        if "Authentication failed" in error_msg:
            raise HTTPException(
                status_code=500,
                detail="Payment gateway authentication failed. Please contact support to update Razorpay credentials."
            )
        raise HTTPException(status_code=500, detail=f"Failed to create payment order: {error_msg}")

@api_router.post("/payment/verify")
async def verify_payment(payment_data: PaymentVerify, user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    
    try:
        params_dict = {
            "razorpay_order_id": payment_data.razorpay_order_id,
            "razorpay_payment_id": payment_data.razorpay_payment_id,
            "razorpay_signature": payment_data.razorpay_signature
        }
        
        if razorpay_client:
            razorpay_client.utility.verify_payment_signature(params_dict)
        
        await db.bookings.update_one(
            {"_id": ObjectId(payment_data.booking_id)},
            {"$set": {
                "payment_status": "paid",
                "booking_status": "awaiting_saint_confirmation",
                "razorpay_payment_id": payment_data.razorpay_payment_id,
                "razorpay_order_id": payment_data.razorpay_order_id,
                "paid_at": datetime.utcnow().isoformat()
            }}
        )
        
        await db.payment_orders.update_one(
            {"order_id": payment_data.razorpay_order_id},
            {"$set": {
                "payment_id": payment_data.razorpay_payment_id,
                "status": "paid"
            }}
        )
        
        booking = await db.bookings.find_one({"_id": ObjectId(payment_data.booking_id)})
        await db.saint_profiles.update_one(
            {"_id": ObjectId(booking["saint_id"])},
            {"$inc": {"total_bookings": 1}}
        )
        
        return {"status": "success", "message": "Payment verified successfully"}
    
    except Exception as e:
        logging.error(f"Payment verification failed: {e}")
        raise HTTPException(status_code=400, detail="Payment verification failed")

# ==================== REVIEW ROUTES ====================

@api_router.post("/reviews")
async def create_review(review: ReviewCreate, user: dict = Depends(get_current_user)):
    await require_role(user, ["customer"])
    
    booking = await db.bookings.find_one({"_id": ObjectId(review.booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking["payment_status"] != "paid":
        raise HTTPException(status_code=400, detail="Cannot review unpaid booking")
    
    existing_review = await db.reviews.find_one({"booking_id": review.booking_id})
    if existing_review:
        raise HTTPException(status_code=400, detail="Booking already reviewed")
    
    review_dict = {
        "booking_id": review.booking_id,
        "customer_id": user["id"],
        "saint_id": review.saint_id,
        "rating": max(1, min(5, review.rating)),
        "comment": review.comment,
        "created_at": datetime.utcnow().isoformat()
    }
    
    result = await db.reviews.insert_one(review_dict)
    
    saint_reviews = await db.reviews.find({"saint_id": review.saint_id}).to_list(1000)
    avg_rating = sum(r["rating"] for r in saint_reviews) / len(saint_reviews)
    
    await db.saint_profiles.update_one(
        {"_id": ObjectId(review.saint_id)},
        {"$set": {"rating": round(avg_rating, 1)}}
    )
    
    review_dict["id"] = str(result.inserted_id)
    review_dict.pop("_id", None)
    return review_dict

@api_router.get("/reviews/saint/{saint_id}")
async def get_saint_reviews(saint_id: str):
    reviews = await db.reviews.find({"saint_id": saint_id}).to_list(1000)
    
    for review in reviews:
        review["id"] = str(review.pop("_id"))
        customer = await db.users.find_one({"_id": ObjectId(review["customer_id"])})
        review["customer_name"] = customer["name"] if customer else "Anonymous"
    
    return reviews

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/saints/pending")
async def get_pending_saints(user: dict = Depends(get_current_user)):
    await require_role(user, ["admin"])
    
    saints = await db.saint_profiles.find({"is_approved": False}).to_list(1000)
    
    for saint in saints:
        saint["id"] = str(saint.pop("_id"))
    
    return saints

@api_router.post("/admin/saints/approve")
async def approve_saint(approval: AdminApprovalRequest, user: dict = Depends(get_current_user)):
    await require_role(user, ["admin"])
    
    result = await db.saint_profiles.update_one(
        {"_id": ObjectId(approval.saint_id)},
        {"$set": {"is_approved": approval.approved}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Saint not found")
    
    return {"message": "Saint approval status updated"}

@api_router.get("/admin/bookings")
async def get_all_bookings(user: dict = Depends(get_current_user)):
    await require_role(user, ["admin"])
    
    # Auto-delete bookings older than 90 days
    cutoff_date = (datetime.utcnow() - timedelta(days=90)).isoformat()
    delete_result = await db.bookings.delete_many({"created_at": {"$lt": cutoff_date}})
    if delete_result.deleted_count > 0:
        logger.info(f"Auto-deleted {delete_result.deleted_count} bookings older than 90 days")
    
    # Sort by newest first
    bookings = await db.bookings.find().sort("created_at", -1).to_list(1000)
    
    for booking in bookings:
        booking["id"] = str(booking.pop("_id"))
        try:
            saint = await db.saint_profiles.find_one({"_id": ObjectId(booking["saint_id"])})
            if saint:
                booking["saint_name"] = saint.get("name", "Unknown")
                saint_user = await db.users.find_one({"_id": ObjectId(saint["user_id"])})
                booking["saint_phone"] = saint_user.get("phone", "") if saint_user else ""
                booking["saint_location"] = saint.get("location", "")
            else:
                booking["saint_name"] = "Deleted Saint"
                booking["saint_phone"] = ""
                booking["saint_location"] = ""
        except Exception:
            booking["saint_name"] = "Unknown"
            booking["saint_phone"] = ""
            booking["saint_location"] = ""
    
    return bookings

@api_router.get("/admin/analytics")
async def get_analytics(user: dict = Depends(get_current_user)):
    await require_role(user, ["admin"])
    
    # Auto-delete bookings older than 90 days
    cutoff_date = (datetime.utcnow() - timedelta(days=90)).isoformat()
    await db.bookings.delete_many({"created_at": {"$lt": cutoff_date}})
    
    total_bookings = await db.bookings.count_documents({})
    paid_bookings = await db.bookings.count_documents({"payment_status": "paid"})
    total_saints = await db.saint_profiles.count_documents({"is_approved": True})
    pending_saints = await db.saint_profiles.count_documents({"is_approved": False})
    
    paid_bookings_list = await db.bookings.find({"payment_status": "paid"}).to_list(10000)
    total_revenue = sum(booking.get("platform_commission", 0) for booking in paid_bookings_list)
    
    return {
        "total_bookings": total_bookings,
        "paid_bookings": paid_bookings,
        "total_saints": total_saints,
        "pending_saints": pending_saints,
        "total_revenue": round(total_revenue, 2)
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
