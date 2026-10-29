from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional, Dict, Any

from backend.app.schemas.booking import (
    BookingCreateRequest,
    BookingStatusUpdateRequest,
    BookingCheckinRequest,
    BookingSignRequest
)
from backend.app.repositories.booking_repo import booking_repo
from backend.app.repositories.resource_repo import resource_repo
from backend.app.repositories.user_repo import user_repo
from backend.app.repositories.agreement_repo import agreement_repo
from backend.app.repositories.inspection_repo import inspection_repo
from backend.app.services.booking_service import booking_service
from backend.app.services.agreement_service import agreement_service
from backend.app.core.deps import get_current_user

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.get("")
async def list_bookings(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    is_owner = current_user.get("system_role") in ["owner", "admin", "manager"]

    raw_bookings = await booking_repo.list_all(status=status)
    results = []

    for b in raw_bookings:
        res = await resource_repo.get_by_id(b["resource_id"])
        is_my_booking = b.get("user_id") == user_id
        is_my_resource = res and res.get("owner_id") == user_id

        # Users only see their own bookings; owners see their resources + their own
        if not is_my_booking and not is_my_resource and current_user.get("system_role") != "admin":
            continue

        applicant_user = await user_repo.get_by_id(b["user_id"])
        agreement = await agreement_repo.get_by_booking_id(b["id"])
        pre_insp = await inspection_repo.get_by_booking_and_phase(b["id"], "pre")
        post_insp = await inspection_repo.get_by_booking_and_phase(b["id"], "post")

        results.append({
            "id": b["id"],
            "resourceId": b["resource_id"],
            "resource_name": res.get("name") if res else "Equipment",
            "applicant": {
                "name": applicant_user.get("full_name", "Applicant") if applicant_user else "Applicant",
                "role": applicant_user.get("academic_role", "Student") if applicant_user else "Student",
                "department": applicant_user.get("department", "") if applicant_user else "",
                "email": applicant_user.get("email", "") if applicant_user else ""
            },
            "isMine": is_my_booking,
            "startDate": b["start_date"][:10],
            "endDate": b["end_date"][:10],
            "purpose": b["purpose"],
            "status": b["status"],
            "proofFiles": b.get("proof_files", []),
            "rejectionReason": b.get("rejection_reason"),
            "userSignature": "signed" if (agreement and agreement.get("user_signed_at")) else None,
            "ownerSignature": "signed" if (agreement and agreement.get("owner_signed_at")) else None,
            "otp": b.get("checkin_otp"),
            "ownerVerified": b.get("owner_verified", False),
            "pre": pre_insp,
            "post": post_insp
        })

    return results

@router.post("")
async def create_booking(req: BookingCreateRequest, current_user: dict = Depends(get_current_user)):
    try:
        created = await booking_service.create_booking_request(
            user_id=current_user["id"],
            resource_id=req.resource_id,
            start_iso=req.start_date,
            end_iso=req.end_date,
            purpose=req.purpose,
            proof_files=req.proof_files
        )
        return created
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.patch("/{booking_id}/status")
async def update_status(
    booking_id: str,
    req: BookingStatusUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    booking = await booking_repo.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    resource = await resource_repo.get_by_id(booking["resource_id"])
    user_role = current_user.get("system_role", "user")
    is_owner_or_manager = (
        (resource and resource.get("owner_id") == current_user["id"]) or
        user_role in ["manager", "admin"]
    )
    is_borrower = (booking.get("user_id") == current_user["id"])

    # Security check:
    # 'approved' or 'rejected' can ONLY be performed by the resource owner, a manager, or admin.
    if req.status in ["approved", "rejected"]:
        if not is_owner_or_manager:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the resource owner, lab manager, or admin can approve or reject bookings."
            )
    elif req.status == "cancelled":
        if not is_borrower and not is_owner_or_manager:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to cancel this booking."
            )

    try:
        updated = await booking_service.update_booking_status(
            booking_id=booking_id,
            new_status=req.status,
            actor_id=current_user["id"],
            actor_role=user_role,
            rejection_reason=req.rejection_reason
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{booking_id}/otp")
async def request_otp(booking_id: str, current_user: dict = Depends(get_current_user)):
    booking = await booking_repo.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    otp = await booking_service.generate_checkin_otp(booking_id)
    return {"otp": otp, "expires_in_minutes": 30}

@router.post("/{booking_id}/checkin")
async def checkin(booking_id: str, req: BookingCheckinRequest, current_user: dict = Depends(get_current_user)):
    try:
        valid = await booking_service.verify_checkin_otp(booking_id, req.otp)
        if not valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired check-in OTP.")
        return {"status": "active", "message": "Check-in verified successfully. Session is now active."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{booking_id}/sign")
async def sign_booking_agreement(
    booking_id: str,
    req: BookingSignRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    booking = await booking_repo.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    resource = await resource_repo.get_by_id(booking["resource_id"])

    # Determine signer role strictly from authenticated session:
    is_borrower = (booking["user_id"] == current_user["id"])
    is_owner = (resource and resource.get("owner_id") == current_user["id"]) or current_user.get("system_role") == "admin"

    # If caller explicitly sent a role in the request body that contradicts identity, reject:
    if req.signer_role:
        if req.signer_role == "user" and not is_borrower:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the borrower can submit the borrower signature.")
        if req.signer_role == "owner" and not is_owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the resource owner can submit the owner signature.")

    if is_borrower:
        actual_role = "user"
    elif is_owner:
        actual_role = "owner"
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are neither the borrower nor the owner of this booking.")

    client_ip = request.client.host if request.client else "127.0.0.1"

    try:
        updated_agreement = await agreement_service.sign_agreement(
            booking_id=booking_id,
            signer_role=actual_role,
            signer_id=current_user["id"],
            signature_data=req.signature_data,
            expected_hash=req.document_hash,
            client_ip=client_ip
        )

        # If both have signed, advance booking status to 'signed'
        if updated_agreement.get("is_fully_signed"):
            await booking_repo.update(booking_id, {"status": "signed"})

        return {"status": "success", "agreement": updated_agreement}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

