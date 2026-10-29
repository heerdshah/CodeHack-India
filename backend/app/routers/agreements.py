from fastapi import APIRouter, Depends, HTTPException, status, Response
from typing import Dict, Any

from backend.app.repositories.agreement_repo import agreement_repo
from backend.app.repositories.booking_repo import booking_repo
from backend.app.repositories.resource_repo import resource_repo
from backend.app.repositories.user_repo import user_repo
from backend.app.services.agreement_service import agreement_service
from backend.app.core.deps import get_current_user

router = APIRouter(prefix="/agreements", tags=["Agreements"])

@router.get("/{booking_id}")
async def get_agreement(booking_id: str, current_user: dict = Depends(get_current_user)):
    agreement = await agreement_repo.get_by_booking_id(booking_id)
    if not agreement:
        # If booking exists and is approved, auto-generate
        booking = await booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        resource = await resource_repo.get_by_id(booking["resource_id"])
        user = await user_repo.get_by_id(booking["user_id"])
        agreement = await agreement_service.create_agreement_for_booking(booking, resource, user)

    return agreement

@router.get("/{booking_id}/pdf")
async def download_agreement_pdf(booking_id: str, current_user: dict = Depends(get_current_user)):
    booking = await booking_repo.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    resource = await resource_repo.get_by_id(booking["resource_id"])
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

