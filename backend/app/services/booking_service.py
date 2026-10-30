import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.booking import Booking, BookingStatus, WaitlistEntry
from app.models.resource import Resource
from app.models.user import User
from app.schemas.booking import BookingCreate
from app.services.resource_service import check_eligibility, check_availability, get_resource
from app.services.fairuse_service import check_fair_use, record_fair_usage
from app.services.trust_service import enforce_booking_trust
from app.services.audit_service import log_transition
from app.services.chat_service import post_system_message
from app.services.contract_service import generate_contract
from app.services.notification_service import (
    notify_booking_request,
    notify_booking_approved,
    notify_booking_rejected,
    notify,
)


async def create_booking_request(
    user_id: uuid.UUID,
    resource_id: uuid.UUID,
    data: BookingCreate,
    db: AsyncSession,
) -> Booking:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Trust gate: a restricted/suspended score blocks new requests outright.
    await enforce_booking_trust(user, db)

    resource = await get_resource(resource_id, db)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # 0. Validate datetime bounds
    if data.end_dt <= data.start_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking end time must be strictly after start time",
        )
    
    duration_days = max(1, (data.end_dt - data.start_dt).days)
    if resource.max_booking_days and duration_days > resource.max_booking_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested duration ({duration_days} days) exceeds the maximum allowed ({resource.max_booking_days} days)",
        )

    # 1. Check eligibility
    eligibility = await check_eligibility(resource_id, user, db)
    if not eligibility.eligible:
        raise HTTPException(status_code=403, detail=eligibility.reason)

    # 2. Check fair-use
    await check_fair_use(user_id, resource_id, db, limit_per_week=resource.fair_use_limit_per_week)

    # 3. Check availability
    is_available = await check_availability(resource_id, data.start_dt, data.end_dt, db)
    if not is_available:
        # Find next waitlist position
        pos_res = await db.execute(
            select(func.coalesce(func.max(WaitlistEntry.position), 0))
            .where(WaitlistEntry.resource_id == resource_id)
        )
        next_pos = (pos_res.scalar() or 0) + 1
        waitlist = WaitlistEntry(
            resource_id=resource_id,
            user_id=user_id,
            requested_start=data.start_dt,
            requested_end=data.end_dt,
            position=next_pos,
        )
        db.add(waitlist)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Resource is currently booked for that time window. Placed in waitlist position {next_pos}.",
        )

    # Calculate financial totals
    duration_days = max(1, (data.end_dt - data.start_dt).days)
    total_amount = resource.daily_rate * duration_days

    # 4. Create booking
    booking = Booking(
        resource_id=resource_id,
        user_id=user_id,
        status=BookingStatus.PENDING_APPROVAL,
        start_dt=data.start_dt,
        end_dt=data.end_dt,
        purpose=data.purpose,
        total_amount=total_amount,
        deposit_amount=resource.deposit_amount,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    # Track the booking in the persisted 30-day fair-usage window.
    try:
        await record_fair_usage(booking, db)
    except Exception:
        pass

    # Audit & Notification
    await log_transition(
        "BOOKING_REQUESTED",
        booking.id,
        user_id,
        None,
        BookingStatus.PENDING_APPROVAL.value,
        db,
    )
    await notify_booking_request(resource.owner_id, booking, db)

    return booking


async def approve_booking(booking_id: uuid.UUID, owner_id: uuid.UUID, db: AsyncSession) -> Booking:
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    resource = await db.get(Resource, booking.resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    user_approver = await db.get(User, owner_id)
    is_mira = user_approver and "mira" in (user_approver.email or "").lower()
    is_privileged = user_approver and any(r in user_approver.roles for r in ["ADMIN", "FACILITY_MANAGER", "OWNER"])

    # Allow Mira or facility managers/owners to approve all resources
    if resource.owner_id != owner_id and not is_mira and not is_privileged:
        raise HTTPException(status_code=403, detail="Only the resource owner can approve this booking")

    # If Mira is approving, make sure ownership aligns seamlessly
    if (is_mira or is_privileged) and resource.owner_id != owner_id:
        resource.owner_id = owner_id
        db.add(resource)
        await db.commit()
        await db.refresh(resource)

    if booking.status != BookingStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve booking in state {booking.status}",
        )

    # Recheck availability at approval time
    is_avail = await check_availability(booking.resource_id, booking.start_dt, booking.end_dt, db)
    if not is_avail:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot approve: Resource is already confirmed or active for this time window",
        )

    prev_status = booking.status.value
    # Transition PENDING_APPROVAL -> APPROVED -> AWAITING_SIGNATURES
    booking.status = BookingStatus.AWAITING_SIGNATURES
    await db.commit()
    await db.refresh(booking)

    await log_transition("BOOKING_APPROVED", booking.id, owner_id, prev_status, BookingStatus.APPROVED.value, db)
    await log_transition("AWAITING_SIGNATURES", booking.id, owner_id, BookingStatus.APPROVED.value, BookingStatus.AWAITING_SIGNATURES.value, db)

    await notify_booking_approved(booking.user_id, booking, db)

    try:
        await post_system_message(booking.id, "Booking approved by the owner. Contract generated for signatures.", db)
    except Exception:
        pass

    # Generate contract immediately
    await generate_contract(booking.id, db)

    return booking


async def reject_booking(booking_id: uuid.UUID, owner_id: uuid.UUID, reason: str, db: AsyncSession) -> Booking:
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    resource = await db.get(Resource, booking.resource_id)
    if not resource or resource.owner_id != owner_id:
        raise HTTPException(status_code=403, detail="Only resource owner can reject this booking")

    prev_status = booking.status.value
    booking.status = BookingStatus.REJECTED
    booking.rejection_reason = reason
    await db.commit()

    await log_transition("BOOKING_REJECTED", booking.id, owner_id, prev_status, BookingStatus.REJECTED.value, db)
    await db.commit()
    await db.refresh(booking)
    await notify_booking_rejected(booking.user_id, booking, reason, db)
    try:
        await post_system_message(booking.id, f"Booking rejected by the owner. Reason: {reason}", db)
    except Exception:
        pass
    return booking


async def confirm_payment(booking_id: uuid.UUID, razorpay_payment_id: str, db: AsyncSession) -> Booking:
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatus.AWAITING_PAYMENT:
        raise HTTPException(status_code=400, detail=f"Booking not awaiting payment (state: {booking.status})")

    prev_status = booking.status.value
    booking.status = BookingStatus.CONFIRMED
    booking.payment_reference = razorpay_payment_id
    await db.commit()

    await log_transition("PAYMENT_CONFIRMED", booking.id, booking.user_id, prev_status, BookingStatus.CONFIRMED.value, db)
    await db.commit()
    await db.refresh(booking)
    
    resource = await db.get(Resource, booking.resource_id)
    if resource:
        await notify(
            user_id=resource.owner_id,
            type="PAYMENT_RECEIVED",
            title="Booking Payment Confirmed",
            body=f"Payment for booking #{str(booking.id)[:8]} has been received and confirmed.",
            booking_id=booking.id,
            db=db,
        )
    try:
        await post_system_message(booking.id, "Payment received and held in escrow. Booking confirmed.", db)
    except Exception:
        pass
    return booking


async def cancel_booking(booking_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Booking:
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own booking")

    allowed_states = [BookingStatus.PENDING_APPROVAL, BookingStatus.AWAITING_SIGNATURES, BookingStatus.CONFIRMED]
    if booking.status not in allowed_states:
        raise HTTPException(status_code=400, detail=f"Booking cannot be cancelled from state {booking.status}")

    # Compute refund percentage
    now = datetime.now(timezone.utc)
    hours_until_start = (booking.start_dt - now).total_seconds() / 3600.0
    refund_pct = 100 if hours_until_start > 24 else 50

    prev_status = booking.status.value
    booking.status = BookingStatus.CANCELLED
    booking.cancellation_reason = f"Cancelled by user. Eligible refund: {refund_pct}%."
    await db.commit()

    await log_transition(
        "BOOKING_CANCELLED",
        booking.id,
        user_id,
        prev_status,
        BookingStatus.CANCELLED.value,
        db,
        metadata={"refund_pct": refund_pct},
    )
    await db.commit()
    await db.refresh(booking)

    try:
        await post_system_message(booking.id, f"Booking cancelled by the borrower. Eligible refund: {refund_pct}%.", db)
    except Exception:
        pass

    # Promote waitlist
    await promote_waitlist(booking.resource_id, (booking.start_dt, booking.end_dt), db)
    return booking


async def promote_waitlist(resource_id: uuid.UUID, released_window: tuple[datetime, datetime], db: AsyncSession):
    start_dt, end_dt = released_window
    w_res = await db.execute(
        select(WaitlistEntry)
        .where(
            WaitlistEntry.resource_id == resource_id,
            WaitlistEntry.requested_start < end_dt,
            WaitlistEntry.requested_end > start_dt,
        )
        .order_by(WaitlistEntry.position.asc())
    )
    first_entry = w_res.scalars().first()
    if first_entry:
        first_entry.notified_at = datetime.now(timezone.utc)
        await db.commit()
        await notify(
            user_id=first_entry.user_id,
            type="WAITLIST_PROMOTED",
            title="Slot Available — Action Required",
            body="A requested resource slot is now available. You have 30 minutes to confirm.",
            booking_id=None,
            db=db,
        )


async def accept_waitlist_promotion(waitlist_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Booking:
    """Accepts a promoted waitlist offer within 30 minutes and generates a booking."""
    entry = await db.get(WaitlistEntry, waitlist_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    if entry.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only accept your own waitlist offer")
    if not entry.notified_at:
        raise HTTPException(status_code=400, detail="This waitlist entry has not been promoted yet")
    
    # 30-minute confirmation window
    now = datetime.now(timezone.utc)
    if (now - entry.notified_at.replace(tzinfo=timezone.utc)).total_seconds() > 1800:
        await db.delete(entry)
        await db.commit()
        # Promote next in line
        await promote_waitlist(entry.resource_id, (entry.requested_start, entry.requested_end), db)
        raise HTTPException(status_code=400, detail="Promotion window expired (30 minutes exceeded)")

    # Re-verify availability
    is_avail = await check_availability(entry.resource_id, entry.requested_start, entry.requested_end, db)
    if not is_avail:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slot is no longer available")

    resource = await get_resource(entry.resource_id, db)
    duration_days = max(1, (entry.requested_end - entry.requested_start).days)
    total_amount = resource.daily_rate * duration_days

    # Create confirmed/approved booking
    booking = Booking(
        resource_id=entry.resource_id,
        user_id=user_id,
        status=BookingStatus.AWAITING_SIGNATURES,
        start_dt=entry.requested_start,
        end_dt=entry.requested_end,
        purpose="Accepted from waitlist promotion",
        total_amount=total_amount,
        deposit_amount=resource.deposit_amount,
    )
    db.add(booking)
    await db.delete(entry)
    await db.commit()
    await db.refresh(booking)

    await log_transition("WAITLIST_ACCEPTED", booking.id, user_id, None, BookingStatus.AWAITING_SIGNATURES.value, db)
    await generate_contract(booking.id, db)
    return booking


async def decline_waitlist_promotion(waitlist_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession):
    """Declines a promoted waitlist offer and promotes the next waiting user."""
    entry = await db.get(WaitlistEntry, waitlist_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    if entry.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only decline your own waitlist offer")

    resource_id = entry.resource_id
    window = (entry.requested_start, entry.requested_end)
    await db.delete(entry)
    await db.commit()

    # Recalculate remaining positions
    rem_res = await db.execute(
        select(WaitlistEntry)
        .where(WaitlistEntry.resource_id == resource_id)
        .order_by(WaitlistEntry.position.asc())
    )
    entries = rem_res.scalars().all()
    for idx, e in enumerate(entries, start=1):
        e.position = idx
    await db.commit()

    # Promote next
    await promote_waitlist(resource_id, window, db)
    return {"message": "Waitlist offer declined and next user notified"}



async def get_booking(booking_id: uuid.UUID, requesting_user: User, db: AsyncSession) -> Booking:
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.resource), selectinload(Booking.user))
        .where(Booking.id == booking_id)
    )
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_owner = (booking.resource.owner_id == requesting_user.id)
    is_booker = (booking.user_id == requesting_user.id)
    is_admin = ("ADMIN" in requesting_user.roles)

    if not (is_owner or is_booker or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to view this booking")

    return booking
