import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.responses import FileResponse, Response

from app.schemas.booking import (
    BookingCreateRequest,
    BookingStatusUpdateRequest,
    BookingCheckinRequest,
    BookingSignRequest
)
from app.repositories.booking_repo import booking_repo
from app.repositories.resource_repo import resource_repo
from app.repositories.user_repo import user_repo
from app.repositories.agreement_repo import agreement_repo
from app.repositories.inspection_repo import inspection_repo
from app.repositories.notification_repo import notification_repo
from app.services.booking_service import booking_service
from app.services.agreement_service import agreement_service
from app.core.deps import get_current_user
from app.core.supabase import check_supabase_configured, get_supabase_admin

router = APIRouter(prefix="/bookings", tags=["Bookings"])
logger = logging.getLogger("resourcx.bookings")

PROOF_BUCKET = "booking-proofs"
MAX_PROOF_SIZE = 10 * 1024 * 1024
INSPECTION_ANGLES = ("Front", "Back", "Left", "Right", "Top", "Bottom")


def inspection_summary(booking_id: str, phase: str, inspection: Optional[Dict[str, Any]]):
    if not inspection:
        return None
    return {
        "id": inspection.get("id"),
        "phase": phase,
        "findings": inspection.get("findings", []),
        "flagged": inspection.get("flagged", False),
        "completedAt": inspection.get("completed_at"),
        "aiAnalysis": inspection.get("ai_analysis") or {},
        "ownerDecision": inspection.get("owner_decision"),
        "photos": {
            photo["angle"]: f"/inspections/{booking_id}/{phase}/photos/{photo['angle']}"
            for photo in inspection.get("inspection_photos", [])
            if photo.get("angle") in INSPECTION_ANGLES
        },
    }


async def store_booking_proof(file: UploadFile, user_id: str) -> str:
    filename = file.filename or ""
    if Path(filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking proof must be a PDF.")

    content = await file.read(MAX_PROOF_SIZE + 1)
    if len(content) > MAX_PROOF_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds 10MB limit.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is not a valid PDF.")

    path = f"{user_id}/{uuid.uuid4().hex}.pdf"
    if os.environ.get("TESTING") == "1" or not check_supabase_configured():
        destination = Path.cwd() / "uploads" / PROOF_BUCKET / Path(*path.split("/"))
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        storage_path = f"local:{path}"
    else:
        client = get_supabase_admin()
        if client is None:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Document storage is unavailable.")
        try:
            client.storage.from_(PROOF_BUCKET).upload(
                path=path,
                file=content,
                file_options={"content-type": "application/pdf", "upsert": "true"},
            )
        except Exception as exc:
            logger.exception("Unable to store booking proof for user %s", user_id)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to store the uploaded PDF.") from exc
        storage_path = f"supabase:{path}"

    return storage_path


@router.post("/proofs", status_code=status.HTTP_201_CREATED)
async def upload_booking_proof(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    storage_path = await store_booking_proof(file, current_user["id"])
    return {"path": storage_path}


@router.post("/{booking_id}/proofs", status_code=status.HTTP_201_CREATED)
async def attach_booking_proof(
    booking_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    booking = await booking_repo.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
    if booking.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the applicant can attach proof to this request.")
    if booking.get("status") != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Proof can only be attached while the request is pending.")

    proof_path = await store_booking_proof(file, current_user["id"])
    existing_proofs = [
        ref
        for ref in booking.get("proof_files", [])
        if isinstance(ref, str)
        and ref.partition(":")[0] in {"local", "supabase"}
        and ref.partition(":")[2].startswith(f"{current_user['id']}/")
        and all(part not in {"", ".", ".."} for part in ref.partition(":")[2].split("/"))
    ]
    updated = await booking_repo.update(
        booking_id,
        {"proof_files": [*existing_proofs, proof_path]},
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to attach the uploaded PDF.")
    return {"path": proof_path}


@router.get("/{booking_id}/proofs/{proof_index}")
async def view_booking_proof(
    booking_id: str,
    proof_index: int,
    current_user: dict = Depends(get_current_user),
):
    booking = await booking_repo.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    resource = await resource_repo.get_by_id(booking["resource_id"])
    role = current_user.get("system_role", "user")
    is_borrower = booking.get("user_id") == current_user["id"]
    is_owner = resource and resource.get("owner_id") == current_user["id"]
    if not (is_borrower or is_owner or role in ["manager", "admin"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot view this booking's proof.")

    proof_files = booking.get("proof_files", [])
    if proof_index < 0 or proof_index >= len(proof_files):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking proof not found.")

    storage_ref = proof_files[proof_index]
    if not isinstance(storage_ref, str) or ":" not in storage_ref:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This request was submitted before PDF files were stored. Ask the applicant to attach the PDF from their account.",
        )

    storage_type, path = storage_ref.split(":", 1)
    if (
        not path.startswith(f"{booking['user_id']}/")
        or any(part in {"", ".", ".."} for part in path.split("/"))
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking proof is unavailable.")
    path_parts = Path(*path.split("/"))
    if storage_type == "local":
        storage_root = (Path.cwd() / "uploads" / PROOF_BUCKET).resolve()
        file_path = (storage_root / path_parts).resolve()
        if storage_root not in file_path.parents or not file_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking proof file not found.")
        return FileResponse(
            file_path,
            media_type="application/pdf",
            filename=file_path.name,
            content_disposition_type="inline",
        )

    if storage_type != "supabase":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking proof is unavailable.")

    client = get_supabase_admin()
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Document storage is unavailable.")
    try:
        pdf_bytes = client.storage.from_(PROOF_BUCKET).download(path)
    except Exception as exc:
        logger.exception("Unable to download booking proof %s", booking_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to retrieve the uploaded PDF.") from exc
    if not isinstance(pdf_bytes, (bytes, bytearray)) or not pdf_bytes.startswith(b"%PDF-"):
        logger.error("Storage returned invalid PDF content for booking proof %s", booking_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The stored booking proof is not a valid PDF.")
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{Path(path).name}"'},
    )

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
            "otp": (
                b.get("checkin_otp")
                if is_my_booking
                and b.get("status") == "signed"
                and agreement
                and agreement.get("is_fully_signed")
                else None
            ),
            "ownerVerified": b.get("owner_verified", False),
            "pre": inspection_summary(b["id"], "pre", pre_insp),
            "post": inspection_summary(b["id"], "post", post_insp)
        })

    return results

@router.post("")
async def create_booking(req: BookingCreateRequest, current_user: dict = Depends(get_current_user)):
    for proof_ref in req.proof_files:
        storage_type, separator, path = proof_ref.partition(":")
        if (
            not separator
            or storage_type not in {"local", "supabase"}
            or not path.startswith(f"{current_user['id']}/")
            or any(part in {"", ".", ".."} for part in path.split("/"))
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking proof must be uploaded through the booking form.",
            )

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

    if req.status in {"signed", "active"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signed and active booking states are set only by the agreement and check-in flows.",
        )

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
    if booking.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the borrower can receive the digital access pass.")

    try:
        otp = await booking_service.generate_checkin_otp(booking_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"otp": otp, "expires_in_minutes": 30}

@router.post("/{booking_id}/checkin")
async def checkin(booking_id: str, req: BookingCheckinRequest, current_user: dict = Depends(get_current_user)):
    try:
        booking = await booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
        if booking.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the borrower can check in with this access pass.")
        pre_inspection = await inspection_repo.get_by_booking_and_phase(booking_id, "pre")
        if not pre_inspection or {
            photo.get("angle") for photo in pre_inspection.get("inspection_photos", [])
        } != set(INSPECTION_ANGLES):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Complete the six-photo pre-use inspection before checking in.",
            )
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
    is_owner = bool(resource and resource.get("owner_id") == current_user["id"])

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

    if booking.get("status") != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The agreement can only be signed after the booking is approved and before it is fully signed.",
        )

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

        recipient_id = (
            booking["user_id"]
            if actual_role == "owner"
            else resource.get("owner_id") if resource else None
        )
        if recipient_id and recipient_id != current_user["id"]:
            signer_label = "The resource owner" if actual_role == "owner" else "The borrower"
            recipient_role = "user" if actual_role == "owner" else "owner"
            try:
                await notification_repo.create({
                    "user_id": recipient_id,
                    "type": "booking_signature",
                    "title": "Booking agreement signed",
                    "message": f"{signer_label} signed the agreement for {resource.get('name', 'your booking') if resource else 'your booking'}.",
                    "data": {
                        "booking_id": booking_id,
                        "recipient_role": recipient_role,
                    },
                })
            except Exception:
                logger.exception("Unable to notify booking party about signature for %s", booking_id)

        # If both have signed, advance booking status to 'signed'
        if updated_agreement.get("is_fully_signed"):
            await booking_repo.update(booking_id, {"status": "signed"})
            await booking_service.generate_checkin_otp(booking_id)

        return {"status": "success", "agreement": updated_agreement}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
