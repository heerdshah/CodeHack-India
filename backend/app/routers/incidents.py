from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict, Any

from app.schemas.inspection import StandaloneIncidentCreateRequest, IncidentReviewRequest
from app.repositories.incident_repo import incident_repo
from app.repositories.resource_repo import resource_repo
from app.repositories.notification_repo import notification_repo
from app.repositories.audit_repo import audit_repo
from app.services.ai import ai_service
from app.core.deps import get_current_user, require_owner

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("")
async def list_incidents(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    incidents = await incident_repo.list_all(status=status)
    visible = []
    can_manage_all = current_user.get("system_role") in {"manager", "admin"}
    for incident in incidents:
        resource = await resource_repo.get_by_id(incident["resource_id"])
        if (
            incident.get("reported_by") == current_user["id"]
            or resource and resource.get("owner_id") == current_user["id"]
            or can_manage_all
        ):
            visible.append(incident)
    return visible

@router.post("")
async def create_standalone_incident(
    req: StandaloneIncidentCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    resource = await resource_repo.get_by_id(req.resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Generate AI summary
    summary_result = await ai_service.summarize_incident(
        resource_name=resource.get("name", "Equipment"),
        reporter_name=current_user["full_name"],
        user_description=req.description,
        context=f"Angle: {req.angle or 'General'}"
    )

    incident_data = {
        "resource_id": req.resource_id,
        "booking_id": req.booking_id,
        "reported_by": current_user["id"],
        "angle": req.angle,
        "status": "under_review",
        "severity": summary_result.severity_assessment,
        "title": req.title or summary_result.title,
        "description": req.description,
        "ai_summary": summary_result.ai_summary,
        "photos": req.photos
    }
    created = await incident_repo.create(incident_data)

    # Notify owner safely
    if resource.get("owner_id"):
        try:
            await notification_repo.create({
                "user_id": resource["owner_id"],
                "type": "inspection_flagged",
                "title": f"Incident Reported: {resource.get('name')}",
                "message": f"An incident was reported on {resource.get('name')} and requires review.",
                "data": {"incident_id": created["id"]}
            })
        except Exception:
            pass

    return created

@router.patch("/{incident_id}/review")
async def review_incident(
    incident_id: str,
    req: IncidentReviewRequest,
    current_user: dict = Depends(require_owner)
):
    incident = await incident_repo.get_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    resource = await resource_repo.get_by_id(incident["resource_id"])
    if (
        not resource
        or resource.get("owner_id") != current_user["id"]
        and current_user.get("system_role") not in {"manager", "admin"}
    ):
        raise HTTPException(status_code=403, detail="Only the resource owner can review this incident.")
    if incident.get("title", "").startswith("Return inspection review:"):
        raise HTTPException(
            status_code=409,
            detail="Use the return inspection review controls to record this decision.",
        )
    if req.status not in {"confirmed", "dismissed", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid incident review status.")
    if incident.get("status") != "under_review":
        raise HTTPException(status_code=409, detail="This incident has already been reviewed.")

    updated = await incident_repo.update(incident_id, {
        "status": req.status,
        "review_notes": req.review_notes,
        "reviewed_by": current_user["id"]
    })

    await audit_repo.log(
        actor_id=current_user["id"],
        actor_role=current_user.get("system_role", "owner"),
        action=f"incident.{req.status}",
        entity_type="incident",
        entity_id=incident_id,
        after_state={"status": req.status, "notes": req.review_notes}
    )

    return updated
