from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
from app.repositories.base import BaseRepository

class PaymentRepository(BaseRepository):
    def __init__(self):
        super().__init__("payments")
        self._memory_payments: Dict[str, Dict[str, Any]] = {
            "book-1": {
                "id": "pay-demo-1",
                "booking_id": "book-1",
                "usage_fee": 1500.0,
                "deposit_amount": 2000.0,
                "total_paid": 3500.0,
                "status": "HELD", # CREATED, CAPTURED, HELD, RELEASED_USER, RELEASED_OWNER, FROZEN
                "released_amount_user": 0.0,
                "released_amount_owner": 0.0,
                "currency": "INR",
                "razorpay_order_id": "order_demo_12345",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "release_eligible_at": datetime.now(timezone.utc).isoformat(),
            }
        }

    async def get_by_booking(self, booking_id: str) -> Optional[Dict[str, Any]]:
        client = self.get_client()
        if client:
            try:
                res = client.table("payments").select("*").eq("booking_id", booking_id).limit(1).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception:
                pass
        return self._memory_payments.get(str(booking_id))

    async def create_or_get_order(self, booking_id: str, usage_fee: float = 1200.0, deposit: float = 2000.0) -> Dict[str, Any]:
        existing = await self.get_by_booking(booking_id)
        if existing:
            return existing

        record = {
            "id": f"pay-{str(uuid.uuid4())[:8]}",
            "booking_id": booking_id,
            "usage_fee": usage_fee,
            "deposit_amount": deposit,
            "total_paid": 0.0,
            "status": "CREATED",
            "released_amount_user": 0.0,
            "released_amount_owner": 0.0,
            "currency": "INR",
            "razorpay_order_id": f"order_demo_{str(uuid.uuid4())[:8]}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "release_eligible_at": None,
        }
        self._memory_payments[str(booking_id)] = record
        return record

    async def verify_payment(self, booking_id: str, payment_id: str) -> Dict[str, Any]:
        record = await self.create_or_get_order(booking_id)
        record["status"] = "HELD"
        record["total_paid"] = record["usage_fee"] + record["deposit_amount"]
        record["razorpay_payment_id"] = payment_id
        record["release_eligible_at"] = datetime.now(timezone.utc).isoformat()
        self._memory_payments[str(booking_id)] = record
        return record

payment_repo = PaymentRepository()

