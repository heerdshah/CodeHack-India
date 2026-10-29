from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, List, Any
import base64

from backend.app.schemas.inspection import InspectionSubmitRequest
from backend.app.repositories.inspection_repo import inspection_repo
from backend.app.repositories.booking_repo import booking_repo
from backend.app.repositories.resource_repo import resource_repo
from backend.app.repositories.incident_repo import incident_repo
from backend.app.repositories.notification_repo import notification_repo
from backend.app.services.ai import ai_service
from backend.app.core.deps import get_current_user

router = APIRouter(prefix="/inspections", tags=["Inspections"])

ANGLES = ["Front", "Back", "Left", "Right", "Top", "Bottom"]

@router.post("/submit")
async def submit_inspection(req: InspectionSubmitRequest, current_user: dict = Depends(get_current_user)):
    booking = await booking_repo.get_by_id(req.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    resource = await resource_repo.get_by_id(booking["resource_id"])
    resource_name = resource.get("name", "Equipment") if resource else "Equipment"

    findings = []
    flagged = False
    ai_angle_results = {}

    # Check that all 6 angles are provided
    for angle in ANGLES:
        if angle not in req.photos:
            raise HTTPException(status_code=400, detail=f"Missing photo for angle: {angle}")

    # Process inspection
    if req.phase == "pre":
        # Pre-check: assess photo quality per angle
        for angle, photo_str in req.photos.items():
            # Mock or decode bytes
            photo_bytes = base64.b64decode(photo_str.split(",")[-1]) if "," in photo_str else photo_str.encode()
            quality = await ai_service.assess_photo_quality(photo_bytes, angle, resource_name)
            if not quality.quality_ok and quality.notes:
                findings.append(f"{angle}: {quality.notes}")
        
        findings.append("Baseline condition successfully recorded across all 6 angles.")
    else:
        # Post-return: 1 AI comparison call per angle (baseline + return)
        pre_insp = await inspection_repo.get_by_booking_and_phase(req.booking_id, "pre")
        pre_photos = pre_insp.get("photos", {}) if pre_insp else {}

        for angle in ANGLES:
            return_photo = req.photos.get(angle, "")
            base_photo = pre_photos.get(angle, return_photo)

            base_bytes = base64.b64decode(base_photo.split(",")[-1]) if "," in base_photo else base_photo.encode()
            ret_bytes = base64.b64decode(return_photo.split(",")[-1]) if "," in return_photo else return_photo.encode()

            comp = await ai_service.compare_angle_damage(angle, resource_name, base_bytes, ret_bytes)
            ai_angle_results[angle] = comp.model_dump()

            if comp.changed and comp.severity in ["low", "medium", "high", "critical"] and comp.confidence >= 0.5:
                flagged = True
                findings.append(f"{angle} view ({int(comp.confidence * 100)}% conf): {comp.description}")

        if not findings:
            findings.append("Return inspection complete. No new surface anomalies observed.")

    # Save inspection record
    insp_record = await inspection_repo.create_inspection({
        "booking_id": req.booking_id,
        "phase": req.phase,
        "completed_by": current_user["id"],
        "findings": findings,
        "flagged": flagged,
        "ai_analysis": ai_angle_results
    })

    # Save photos
    for angle, photo_str in req.photos.items():
        await inspection_repo.add_photo({
            "inspection_id": insp_record["id"],
            "angle": angle,
            "photo_path": photo_str[:100] # Store path or truncated preview
        })

    # If post-check was flagged, create an incident for owner review (NO automatic penalty)
    if req.phase == "post" and flagged:
        incident = await incident_repo.create({
            "booking_id": req.booking_id,
            "resource_id": booking["resource_id"],
            "reported_by": current_user["id"],
            "status": "under_review",
            "severity": "medium",
            "title": f"Flagged Return Condition: {resource_name}",
            "description": "; ".join(findings),
            "ai_summary": f"Automated inspection flagged potential return variance on {resource_name}. Human review required.",
            "photos": [req.photos.get("Front", ""), req.photos.get("Top", "")]
        })

        # Notify owner safely
        if resource and resource.get("owner_id"):
            try:
                await notification_repo.create({
                    "user_id": resource["owner_id"],
                    "type": "inspection_flagged",
                    "title": "Return Inspection Flagged",
                    "message": f"Return inspection for {resource_name} showed potential wear/damage. Review task created.",
                    "data": {"incident_id": incident["id"], "booking_id": req.booking_id}
                })
            except Exception:
                pass

    return {
        "status": "success",
        "phase": req.phase,
        "findings": findings,
        "flagged": flagged,
        "completedAt": insp_record.get("completed_at", "")[:10]
    }

