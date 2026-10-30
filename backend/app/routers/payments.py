from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel
from backend.app.core.deps import get_current_user
from backend.app.repositories.payment_repo import payment_repo

router = APIRouter(prefix="/payments", tags=["Payments"])

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None

@router.get("/{booking_id}")
async def get_payment_status(booking_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    payment = await payment_repo.get_by_booking(booking_id)
    if not payment:
        payment = await payment_repo.create_or_get_order(booking_id)
    return payment

@router.post("/{booking_id}/order")
async def create_order(booking_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    return await payment_repo.create_or_get_order(booking_id)

@router.post("/{booking_id}/verify")
async def verify_payment(booking_id: str, body: VerifyPaymentRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    pid = body.razorpay_payment_id or "pay_demo_test"
    return await payment_repo.verify_payment(booking_id, pid)

