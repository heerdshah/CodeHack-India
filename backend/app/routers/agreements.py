from fastapi import APIRouter, Depends, HTTPException, status, Response

from app.repositories.agreement_repo import agreement_repo
from app.repositories.booking_repo import booking_repo
from app.repositories.resource_repo import resource_repo
from app.repositories.user_repo import user_repo
from app.services.agreement_service import agreement_service
from app.core.deps import get_current_user

router = APIRouter(prefix="/agreements", tags=["Agreements"])

async def require_agreement_access(booking_id: str, current_user: dict):
    booking = await booking_repo.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    resource = await resource_repo.get_by_id(booking["resource_id"])
    role = current_user.get("system_role", "user")
    can_view = (
        booking.get("user_id") == current_user["id"]
        or (resource and resource.get("owner_id") == current_user["id"])
        or role in {"manager", "admin"}
    )
    if not can_view:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot view this booking agreement.")
    if booking.get("status") not in {"approved", "signed", "active", "returned", "completed"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The agreement is available after the booking is approved.")
    return booking, resource

@router.get("/{booking_id}")
async def get_agreement(booking_id: str, current_user: dict = Depends(get_current_user)):
    booking, resource = await require_agreement_access(booking_id, current_user)
    agreement = await agreement_repo.get_by_booking_id(booking_id)
    if not agreement:
        user = await user_repo.get_by_id(booking["user_id"])
        agreement = await agreement_service.create_agreement_for_booking(booking, resource, user)

    response = dict(agreement)
    try:
        response["user_signature"] = await agreement_service.get_signature_data(
            booking_id,
            "user",
            agreement.get("user_signature_path"),
        )
        response["owner_signature"] = await agreement_service.get_signature_data(
            booking_id,
            "owner",
            agreement.get("owner_signature_path"),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return response

@router.get("/{booking_id}/pdf")
async def download_agreement_pdf(booking_id: str, current_user: dict = Depends(get_current_user)):
    booking, resource = await require_agreement_access(booking_id, current_user)
    user = await user_repo.get_by_id(booking["user_id"])
    agreement = await agreement_repo.get_by_booking_id(booking_id)

    tailored = agreement.get("content_clauses", {}).get("tailored", []) if agreement else []
    pdf_bytes = agreement_service.generate_pdf_bytes(
        booking,
        resource,
        user,
        tailored,
        user_signature=agreement.get("user_signed_at") if agreement else None,
        owner_signature=agreement.get("owner_signed_at") if agreement else None
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=agreement_{booking_id}.pdf"}
    )
