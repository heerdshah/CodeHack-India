import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple

from app.repositories.booking_repo import booking_repo
from app.repositories.agreement_repo import agreement_repo
from app.repositories.resource_repo import resource_repo
from app.repositories.user_repo import user_repo
from app.repositories.notification_repo import notification_repo
from app.repositories.audit_repo import audit_repo
from app.services.agreement_service import agreement_service

# Strict state transitions table
ALLOWED_TRANSITIONS = {
    "pending": ["approved", "rejected", "waitlisted", "cancelled"],
    "waitlisted": ["pending", "cancelled", "approved"],
    "approved": ["signed", "cancelled", "rejected"],
    "signed": ["active", "cancelled"],
    "active": ["returned", "overdue"],
    "overdue": ["returned", "completed"],
    "returned": ["completed"],
    "rejected": [],
    "cancelled": [],
    "completed": []
}

class BookingService:
    def validate_transition(self, current_status: str, target_status: str) -> bool:
        allowed = ALLOWED_TRANSITIONS.get(current_status, [])
        return target_status in allowed

    async def check_fair_allocation(
        self,
        user_id: str,
        resource_id: str,
        start_dt: datetime,
        end_dt: datetime
    ) -> Tuple[bool, Optional[str]]:
        resource = await resource_repo.get_by_id(resource_id)
        if not resource:
            return False, "Resource not found."

        user_bookings = await booking_repo.list_by_user(user_id)
        active_or_upcoming = [
            b for b in user_bookings 
            if b.get("status") in ["pending", "approved", "signed", "active"]
        ]

        # 1. Max active bookings limit
        max_active = resource.get("max_active_bookings_per_user", 2)
        if len(active_or_upcoming) >= max_active:
            return False, f"Fair allocation limit reached: You already have {len(active_or_upcoming)} active/pending bookings (Maximum allowed: {max_active})."

        # 2. Max hours per week limit
        new_duration_hours = (end_dt - start_dt).total_seconds() / 3600.0
        week_start = start_dt - timedelta(days=start_dt.weekday())
        week_end = week_start + timedelta(days=7)
        
        hours_this_week = 0.0
        for b in active_or_upcoming:
            b_start = datetime.fromisoformat(b["start_date"].replace("Z", "+00:00"))
            b_end = datetime.fromisoformat(b["end_date"].replace("Z", "+00:00"))
            if b_start >= week_start and b_start < week_end:
                hours_this_week += (b_end - b_start).total_seconds() / 3600.0

        max_hours = resource.get("max_hours_per_week_per_user", 20)
        if (hours_this_week + new_duration_hours) > max_hours:
            return False, f"Fair allocation limit exceeded: Booking would bring weekly usage to {hours_this_week + new_duration_hours:.1f} hours (Weekly limit: {max_hours} hours)."

        # 3. Cooldown check
        cooldown_hours = resource.get("cooldown_hours_after_booking", 4)
        for b in user_bookings:
            if b.get("resource_id") == resource_id and b.get("status") in ["returned", "completed"]:
                b_end = datetime.fromisoformat(b["end_date"].replace("Z", "+00:00"))
                if start_dt < (b_end + timedelta(hours=cooldown_hours)) and start_dt >= b_end:
                    remaining_min = int(((b_end + timedelta(hours=cooldown_hours)) - start_dt).total_seconds() / 60)
                    return False, f"Mandatory cooldown active: Must wait {cooldown_hours} hours between bookings for this equipment ({remaining_min} minutes remaining)."

        return True, None

    async def create_booking_request(
        self,
        user_id: str,
        resource_id: str,
        start_iso: str,
        end_iso: str,
        purpose: str,
        proof_files: List[str]
    ) -> Dict[str, Any]:
        start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))

        if end_dt <= start_dt:
            raise ValueError("Booking end date must be strictly after the start date.")

        # Fair allocation check
        is_fair, block_reason = await self.check_fair_allocation(user_id, resource_id, start_dt, end_dt)
        if not is_fair:
            raise ValueError(block_reason)

        # Overlap check
        has_overlap = await booking_repo.check_overlap(resource_id, start_dt, end_dt)
        resource = await resource_repo.get_by_id(resource_id)

        if has_overlap:
            # Add to waitlist
            waitlist_entry = await booking_repo.add_to_waitlist({
                "resource_id": resource_id,
                "user_id": user_id,
                "requested_start_date": start_iso,
                "requested_end_date": end_iso,
                "purpose": purpose
            })
            
            # Send notification safely
            try:
                await notification_repo.create({
                    "user_id": user_id,
                    "type": "waitlist_promoted",
                    "title": "Placed on Waitlist",
                    "message": f"Slot conflict for {resource.get('name', 'Resource') if resource else 'Resource'}. You are at position #{waitlist_entry['position']} in the waitlist.",
                    "data": {"resource_id": resource_id, "position": waitlist_entry["position"]}
                })
            except Exception:
                pass
            
            return {
                "id": f"wl-{waitlist_entry['id']}",
                "resource_id": resource_id,
                "user_id": user_id,
                "status": "waitlisted",
                "waitlist_position": waitlist_entry["position"],
                "message": f"Resource is booked during this time. You were added to the waitlist at position #{waitlist_entry['position']}."
            }

        # Create pending booking
        booking_data = {
            "resource_id": resource_id,
            "user_id": user_id,
            "start_date": start_iso,
            "end_date": end_iso,
            "purpose": purpose,
            "status": "pending",
            "proof_files": proof_files
        }
        created = await booking_repo.create(booking_data)

        await notification_repo.create({
            "user_id": user_id,
            "type": "booking_submitted",
            "title": "Booking Request Submitted",
            "message": f"Your request for {resource.get('name', 'the resource') if resource else 'the resource'} was submitted for owner review.",
            "data": {"booking_id": created["id"]},
        })

        # Notify resource owner safely
        if resource and resource.get("owner_id"):
            try:
                await notification_repo.create({
                    "user_id": resource["owner_id"],
                    "type": "booking_request",
                    "title": "New Booking Application",
                    "message": f"New booking application received for {resource.get('name')}.",
                    "data": {"booking_id": created["id"]}
                })
            except Exception:
                pass

        return created

    async def update_booking_status(
        self,
        booking_id: str,
        new_status: str,
        actor_id: str,
        actor_role: str,
        rejection_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        booking = await booking_repo.get_by_id(booking_id)
        if not booking:
            raise ValueError(f"Booking {booking_id} not found.")

        current_status = booking.get("status", "pending")
        if not self.validate_transition(current_status, new_status):
            raise ValueError(f"Invalid booking transition from '{current_status}' to '{new_status}'.")

        updates: Dict[str, Any] = {"status": new_status}
        if rejection_reason:
            rejection_reason = rejection_reason.strip()
            updates["rejection_reason"] = rejection_reason

        # If approved, generate institutional agreement
        if new_status == "approved":
            try:
                resource = await resource_repo.get_by_id(booking["resource_id"])
                user = await user_repo.get_by_id(booking["user_id"])
                if resource and user:
                    await agreement_service.create_agreement_for_booking(booking, resource, user)
            except Exception as e:
                # Log error without failing booking approval
                pass

            try:
                resource_name = resource.get('name', 'equipment') if resource else 'equipment'
                await notification_repo.create({
                    "user_id": booking["user_id"],
                    "type": "booking_approved",
                    "title": "Booking Approved!",
                    "message": f"Your booking for {resource_name} was approved. Please review and sign the agreement.",
                    "data": {"booking_id": booking["id"]}
                })
            except Exception:
                pass

        # If booking is freed (cancelled, rejected, completed, returned), promote next from waitlist
        if new_status in ["cancelled", "rejected", "returned", "completed"]:
            try:
                await self.auto_promote_waitlist(booking["resource_id"])
            except Exception:
                pass

        updated = await booking_repo.update(booking_id, updates)

        if new_status == "rejected":
            resource = await resource_repo.get_by_id(booking["resource_id"])
            resource_name = resource.get("name", "resource") if resource else "resource"
            await notification_repo.create({
                "user_id": booking["user_id"],
                "type": "booking_rejected",
                "title": "Booking Request Declined",
                "message": f"Your booking request for {resource_name} was declined. Reason: {rejection_reason}",
                "data": {"booking_id": booking["id"]},
            })

        # Audit log
        try:
            await audit_repo.log(
                actor_id=actor_id,
                actor_role=actor_role,
                action=f"booking.{new_status}",
                entity_type="booking",
                entity_id=booking_id,
                before_state={"status": current_status},
                after_state={"status": new_status, "rejection_reason": rejection_reason}
            )
        except Exception:
            pass

        return updated

    async def auto_promote_waitlist(self, resource_id: str) -> Optional[Dict[str, Any]]:
        waitlist_entries = await booking_repo.get_waitlist_by_resource(resource_id)
        if not waitlist_entries:
            return None

        # Next FIFO candidate
        candidate = waitlist_entries[0]
        # Promote candidate: set status to 'promoted_holding' with 24h hold window
        hold_until = datetime.now(timezone.utc) + timedelta(hours=24)
        await booking_repo.update_waitlist_entry(candidate["id"], {
            "status": "promoted_holding",
            "hold_until": hold_until.isoformat()
        })

        # Create approved booking for candidate
        new_booking = await booking_repo.create({
            "resource_id": resource_id,
            "user_id": candidate["user_id"],
            "start_date": candidate["requested_start_date"],
            "end_date": candidate["requested_end_date"],
            "purpose": candidate["purpose"],
            "status": "approved"
        })

        # Notify promoted user safely
        resource = await resource_repo.get_by_id(resource_id)
        try:
            resource_name = resource.get('name', 'Resource') if resource else 'Resource'
            await notification_repo.create({
                "user_id": candidate["user_id"],
                "type": "waitlist_promoted",
                "title": "Waitlist Promotion: Slot Reserved!",
                "message": f"A slot has freed up for {resource_name}! Your reservation is held for 24 hours. Sign the agreement to confirm.",
                "data": {"booking_id": new_booking["id"], "hold_until": hold_until.isoformat()}
            })
        except Exception:
            pass

        return new_booking

    async def generate_checkin_otp(self, booking_id: str) -> str:
        booking = await booking_repo.get_by_id(booking_id)
        if not booking or booking.get("status") != "signed":
            raise ValueError("An access pass can only be issued after the booking agreement is fully signed.")
        agreement = await agreement_repo.get_by_booking_id(booking_id)
        if not agreement or not agreement.get("is_fully_signed"):
            raise ValueError("Both the borrower and resource owner must sign before an access pass is issued.")

        otp = f"{secrets.randbelow(900000) + 100000}"
        expiry = datetime.now(timezone.utc) + timedelta(minutes=30)
        await booking_repo.update(booking_id, {
            "checkin_otp": otp,
            "otp_expires_at": expiry.isoformat()
        })
        return otp

    async def verify_checkin_otp(self, booking_id: str, submitted_otp: str) -> bool:
        booking = await booking_repo.get_by_id(booking_id)
        if not booking:
            raise ValueError("Booking not found.")
        if booking.get("status") != "signed":
            raise ValueError("Check-in is only available after both parties sign the agreement.")
        agreement = await agreement_repo.get_by_booking_id(booking_id)
        if not agreement or not agreement.get("is_fully_signed"):
            raise ValueError("Both agreement signatures are required before check-in.")

        stored_otp = booking.get("checkin_otp")
        expiry_str = booking.get("otp_expires_at")
        if not stored_otp or stored_otp != submitted_otp:
            return False

        if expiry_str:
            expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expiry:
                return False

        # Transition to active
        await booking_repo.update(booking_id, {
            "status": "active",
            "checked_in_at": datetime.now(timezone.utc).isoformat(),
            "checkin_otp": None # Single-use: cleared once verified
        })
        return True

booking_service = BookingService()
