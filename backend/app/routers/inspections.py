import base64
import binascii
import hashlib
import logging
import os
from pathlib import Path
from typing import Dict, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.core.supabase import check_supabase_configured, get_supabase_admin
from app.repositories.booking_repo import booking_repo
from app.repositories.incident_repo import incident_repo
from app.repositories.inspection_repo import inspection_repo
from app.repositories.notification_repo import notification_repo
from app.repositories.resource_repo import resource_repo
from app.schemas.inspection import InspectionSubmitRequest
from app.services.ai import ai_service
from app.services.booking_service import booking_service

router = APIRouter(prefix="/inspections", tags=["Inspections"])
logger = logging.getLogger("resourcx.inspections")

ANGLES = ["Front", "Back", "Left", "Right", "Top", "Bottom"]
PHOTO_BUCKET = "inspection-photos"
MAX_PHOTO_SIZE = 6 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class InspectionReviewRequest(BaseModel):
    decision: Literal["damage", "no_damage"]
    notes: str = Field(default="", max_length=2000)


def decode_photo(photo_data: str, angle: str) -> tuple[bytes, str]:
    try:
        header, encoded = photo_data.split(",", 1)
        mime_type = header.removeprefix("data:").removesuffix(";base64")
        if not header.startswith("data:") or mime_type not in ALLOWED_IMAGE_TYPES:
            raise ValueError("Unsupported image format.")
        image_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{angle} must be a valid JPEG, PNG, or WebP image.",
        ) from exc

    if not image_bytes or len(image_bytes) > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{angle} image must be smaller than 6 MB.",
        )
    valid_image = (
        mime_type == "image/jpeg" and image_bytes.startswith(b"\xff\xd8\xff")
    ) or (
        mime_type == "image/png" and image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    ) or (
        mime_type == "image/webp"
        and image_bytes.startswith(b"RIFF")
        and image_bytes[8:12] == b"WEBP"
    )
    if not valid_image:
        raise HTTPException(status_code=400, detail=f"{angle} is not a valid {mime_type} image.")
    return image_bytes, mime_type


def store_photo(path: str, image_bytes: bytes, mime_type: str) -> str:
    if os.environ.get("TESTING") == "1" or not check_supabase_configured():
        destination = Path.cwd() / "uploads" / PHOTO_BUCKET / Path(*path.split("/"))
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(image_bytes)
        return f"local:{path}"

    client = get_supabase_admin()
    if client is None:
        raise HTTPException(status_code=503, detail="Inspection photo storage is unavailable.")
    try:
        client.storage.from_(PHOTO_BUCKET).upload(
            path=path,
            file=image_bytes,
            file_options={"content-type": mime_type, "upsert": "true"},
        )
    except Exception as exc:
        logger.exception("Could not store inspection photo %s", path)
        raise HTTPException(status_code=502, detail="Could not store an inspection photo.") from exc
    return f"supabase:{path}"


def load_photo(photo_path: str) -> tuple[bytes, str]:
    storage_type, separator, path = photo_path.partition(":")
    if (
        not separator
        or storage_type not in {"local", "supabase"}
        or not path
        or "\\" in path
        or ":" in path
        or any(part in {"", ".", ".."} for part in path.split("/"))
    ):
        raise HTTPException(status_code=404, detail="Inspection photo not found.")

    if storage_type == "local":
        photo_file = Path.cwd() / "uploads" / PHOTO_BUCKET / Path(*path.split("/"))
        try:
            image_bytes = photo_file.read_bytes()
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Inspection photo not found.") from exc
    else:
        client = get_supabase_admin()
        if client is None:
            raise HTTPException(status_code=503, detail="Inspection photo storage is unavailable.")
        try:
            image_bytes = client.storage.from_(PHOTO_BUCKET).download(path)
        except Exception as exc:
            logger.exception("Could not retrieve inspection photo %s", path)
            raise HTTPException(status_code=502, detail="Could not retrieve the inspection photo.") from exc

    mime_type = {
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(Path(path).suffix.lower())
    if not mime_type or not isinstance(image_bytes, (bytes, bytearray)):
        raise HTTPException(status_code=502, detail="Stored inspection photo is invalid.")
    return bytes(image_bytes), mime_type


async def require_booking_party(booking_id: str, current_user: dict):
    booking = await booking_repo.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    resource = await resource_repo.get_by_id(booking["resource_id"])
    if booking.get("user_id") != current_user["id"] and (
        not resource or resource.get("owner_id") != current_user["id"]
    ):
        raise HTTPException(status_code=403, detail="You are not a party to this booking.")
    return booking, resource


@router.post("/submit")
async def submit_inspection(
    req: InspectionSubmitRequest,
    current_user: dict = Depends(get_current_user),
):
    if req.phase not in {"pre", "post"}:
        raise HTTPException(status_code=400, detail="Inspection phase must be pre or post.")
    if set(req.photos) != set(ANGLES):
        raise HTTPException(
            status_code=400,
            detail="Exactly one photo for each of the six angles is required.",
        )

    booking = await booking_repo.get_by_id(req.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the borrower can submit an inspection.")

    allowed_statuses = {"signed"} if req.phase == "pre" else {"active", "overdue"}
    if booking.get("status") not in allowed_statuses:
        raise HTTPException(
            status_code=409,
            detail=f"A {req.phase}-use inspection is not allowed for a booking with status '{booking.get('status')}'.",
        )
    if await inspection_repo.get_by_booking_and_phase(req.booking_id, req.phase):
        raise HTTPException(status_code=409, detail=f"The {req.phase}-use inspection was already submitted.")
    pre_insp = await inspection_repo.get_by_booking_and_phase(req.booking_id, "pre")
    if req.phase == "post" and not pre_insp:
        raise HTTPException(
            status_code=409,
            detail="Complete the pre-use inspection before returning the resource.",
        )

    resource = await resource_repo.get_by_id(booking["resource_id"])
    resource_name = resource.get("name", "Equipment") if resource else "Equipment"
    photo_bytes: Dict[str, bytes] = {}
    mime_types: Dict[str, str] = {}
    for angle in ANGLES:
        photo_bytes[angle], mime_types[angle] = decode_photo(req.photos[angle], angle)

    findings = []
    flagged = False
    ai_angle_results = {}
    quality_results = {}

    if req.phase == "pre":
        for angle in ANGLES:
            quality = await ai_service.assess_photo_quality(photo_bytes[angle], angle, resource_name)
            quality_results[angle] = quality.model_dump()
            if not quality.quality_ok and quality.notes:
                findings.append(f"{angle}: {quality.notes}")
        findings.append("Baseline condition successfully recorded across all 6 angles.")
    else:
        for angle in ANGLES:
            baseline_photo = next(
                (
                    photo
                    for photo in pre_insp.get("inspection_photos", [])
                    if photo.get("angle") == angle
                ),
                None,
            )
            if not baseline_photo:
                raise HTTPException(status_code=409, detail=f"Baseline photo for {angle} is missing.")
            baseline_bytes, _ = load_photo(baseline_photo["photo_path"])
            comparison = await ai_service.compare_angle_damage(
                angle,
                resource_name,
                baseline_bytes,
                photo_bytes[angle],
            )
            ai_angle_results[angle] = comparison.model_dump()
            if (
                comparison.changed
                and comparison.severity in {"low", "medium", "high", "critical"}
                and comparison.confidence >= 0.5
            ):
                flagged = True
                findings.append(
                    f"{angle} view ({int(comparison.confidence * 100)}% conf): {comparison.description}"
                )
        if not findings:
            findings.append(
                "AI comparison complete. The owner must review the return photos before closing the inspection."
            )

    inspection = await inspection_repo.create_inspection({
        "booking_id": req.booking_id,
        "phase": req.phase,
        "completed_by": current_user["id"],
        "findings": findings,
        "flagged": flagged,
        "ai_analysis": ai_angle_results if req.phase == "post" else quality_results,
    })

    for angle in ANGLES:
        extension = ALLOWED_IMAGE_TYPES[mime_types[angle]]
        booking_key = hashlib.sha256(req.booking_id.encode("utf-8")).hexdigest()
        storage_path = f"{booking_key}/{req.phase}/{angle.lower()}.{extension}"
        photo_ref = store_photo(storage_path, photo_bytes[angle], mime_types[angle])
        await inspection_repo.add_photo({
            "inspection_id": inspection["id"],
            "angle": angle,
            "photo_path": photo_ref,
            "ai_quality_ok": quality_results.get(angle, {}).get("quality_ok", True),
            "ai_quality_notes": quality_results.get(angle, {}).get("notes"),
        })

    if req.phase == "post":
        severity_order = {"none": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
        severity = max(
            (result.get("severity", "none") for result in ai_angle_results.values()),
            key=lambda value: severity_order.get(value, 0),
            default="none",
        )
        description = "; ".join(findings)
        if not flagged:
            description = "AI did not flag high-confidence visible damage. Owner review is still required."
        incident = await incident_repo.create({
            "booking_id": req.booking_id,
            "resource_id": booking["resource_id"],
            "reported_by": current_user["id"],
            "status": "under_review",
            "severity": severity if severity != "none" else "low",
            "title": f"Return inspection review: {resource_name}",
            "description": description,
            "ai_summary": (
                "AI results are advisory only. The resource owner must review the six before-and-after photo pairs."
            ),
            "photos": [],
        })

        if resource and resource.get("owner_id"):
            notification = await notification_repo.create({
                "user_id": resource["owner_id"],
                "type": "inspection_return_review",
                "title": "Return inspection ready for review",
                "message": f"Review the six return photo pairs for {resource_name} and decide whether to report damage.",
                "data": {"incident_id": incident["id"], "booking_id": req.booking_id},
            })
            if notification is None:
                logger.error("Could not notify resource owner about return inspection %s", req.booking_id)

    return {
        "status": "success",
        "phase": req.phase,
        "findings": findings,
        "flagged": flagged,
        "completedAt": inspection.get("completed_at", "")[:10],
    }


@router.get("/{booking_id}/{phase}/photos/{angle}")
async def get_inspection_photo(
    booking_id: str,
    phase: str,
    angle: str,
    current_user: dict = Depends(get_current_user),
):
    if phase not in {"pre", "post"} or angle not in ANGLES:
        raise HTTPException(status_code=404, detail="Inspection photo not found.")
    await require_booking_party(booking_id, current_user)
    inspection = await inspection_repo.get_by_booking_and_phase(booking_id, phase)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found.")
    photo = next(
        (item for item in inspection.get("inspection_photos", []) if item.get("angle") == angle),
        None,
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Inspection photo not found.")
    image_bytes, mime_type = load_photo(photo["photo_path"])
    return Response(
        content=image_bytes,
        media_type=mime_type,
        headers={"Cache-Control": "private, no-store"},
    )


@router.post("/{booking_id}/review")
async def review_return_inspection(
    booking_id: str,
    req: InspectionReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    booking, resource = await require_booking_party(booking_id, current_user)
    if not resource or resource.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the resource owner can review a return inspection.")

    inspection = await inspection_repo.get_by_booking_and_phase(booking_id, "post")
    if not inspection:
        raise HTTPException(status_code=404, detail="No return inspection is awaiting review.")
    if inspection.get("owner_decision"):
        raise HTTPException(status_code=409, detail="This return inspection has already been reviewed.")
    pre_inspection = await inspection_repo.get_by_booking_and_phase(booking_id, "pre")
    if not pre_inspection or {
        photo.get("angle") for photo in pre_inspection.get("inspection_photos", [])
    } != set(ANGLES) or {
        photo.get("angle") for photo in inspection.get("inspection_photos", [])
    } != set(ANGLES):
        raise HTTPException(status_code=409, detail="All twelve inspection photos must be available before review.")
    incident = await incident_repo.get_by_booking_id(booking_id)
    if not incident or incident.get("status") != "under_review":
        raise HTTPException(status_code=409, detail="The return inspection is no longer awaiting review.")

    incident_status = "confirmed" if req.decision == "damage" else "dismissed"
    review_notes = req.notes.strip() or (
        "Owner reported visible damage."
        if req.decision == "damage"
        else "Owner found no reportable damage."
    )
    updated_incident = await incident_repo.update(incident["id"], {
        "status": incident_status,
        "review_notes": review_notes,
        "reviewed_by": current_user["id"],
    })
    if not updated_incident:
        raise HTTPException(status_code=500, detail="Could not save the incident review.")
    updated = await inspection_repo.update(inspection["id"], {
        "owner_decision": req.decision,
        "reviewed_by": current_user["id"],
        "review_notes": review_notes,
    })
    if not updated:
        raise HTTPException(status_code=500, detail="Could not save the owner review decision.")
    try:
        returned_booking = await booking_service.update_booking_status(
            booking_id,
            "returned",
            actor_id=current_user["id"],
            actor_role=current_user.get("system_role", "owner"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not returned_booking:
        raise HTTPException(status_code=500, detail="Could not complete the booking return.")

    if booking.get("user_id") != current_user["id"]:
        is_damage = req.decision == "damage"
        notification = await notification_repo.create({
            "user_id": booking["user_id"],
            "type": "damage_reported" if is_damage else "inspection_no_damage",
            "title": "Damage reported by resource owner" if is_damage else "Return inspection complete",
            "message": (
                f"The owner reported damage after reviewing the return inspection for {resource.get('name', 'your booking')}."
                if is_damage
                else f"The owner reviewed the return inspection for {resource.get('name', 'your booking')} and reported no damage."
            ),
            "data": {"booking_id": booking_id, "decision": req.decision},
        })
        if notification is None:
            logger.error("Could not notify borrower about inspection review for booking %s", booking_id)

    return {"status": "success", "decision": req.decision}
