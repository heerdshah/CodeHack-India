from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from datetime import datetime
from typing import List, Optional, Dict, Any

from app.schemas.user import UserRoleUpdateRequest
from app.repositories.user_repo import user_repo
from app.repositories.audit_repo import audit_repo
from app.core.deps import require_admin, require_manager

router = APIRouter(prefix="/admin", tags=["Admin & Operations"])

@router.get("/users")
async def list_users(current_user: dict = Depends(require_admin)):
    users = await user_repo.list_all()
    # Strip password hashes before returning
    clean = []
    for u in users:
        u_copy = dict(u)
        u_copy.pop("password_hash", None)
        clean.append(u_copy)
    return clean

@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    req: UserRoleUpdateRequest,
    current_user: dict = Depends(require_admin)
):
    valid_roles = ["user", "owner", "manager", "admin"]
    if req.system_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid system role. Must be one of: {valid_roles}")

    target = await user_repo.get_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    updated = await user_repo.update(user_id, {"system_role": req.system_role})

    await audit_repo.log(
        actor_id=current_user["id"],
        actor_role="admin",
        action="admin.role_change",
        entity_type="user",
        entity_id=user_id,
        before_state={"role": target.get("system_role")},
        after_state={"role": req.system_role}
    )

    return {"id": user_id, "system_role": req.system_role}

@router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    limit: int = Query(100),
    current_user: dict = Depends(require_manager)
):
    return await audit_repo.list_logs(entity_type=entity_type, actor_id=actor_id, limit=limit)

@router.get("/audit/export")
async def export_audit_logs(
    booking_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: dict = Depends(require_admin)
):
    """
    Export audit logs as JSON file for institutional compliance.
    """
    logs = await audit_repo.list_logs(
        entity_type="booking" if booking_id else ("resource" if resource_id else None),
        actor_id=actor_id,
        limit=1000
    )
    return JSONResponse(
        content={"logs": logs, "count": len(logs), "exported_at": datetime.utcnow().isoformat()},
        headers={"Content-Disposition": "attachment; filename=availo_audit_export.json"}
    )

@router.get("/suspicious-flags")
async def get_suspicious_flags(current_user: dict = Depends(require_manager)):
    return await audit_repo.list_flags()
