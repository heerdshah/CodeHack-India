from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any

from app.repositories.notification_repo import notification_repo
from app.core.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("")
async def get_my_notifications(current_user: dict = Depends(get_current_user)):
    return await notification_repo.list_by_user(current_user["id"])

@router.patch("/{notif_id}/read")
async def mark_notification_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    ok = await notification_repo.mark_as_read(notif_id, current_user["id"])
    return {"success": ok}

@router.post("/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    ok = await notification_repo.mark_all_as_read(current_user["id"])
    return {"success": ok}

