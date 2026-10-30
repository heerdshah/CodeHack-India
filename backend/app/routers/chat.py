from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
from backend.app.core.deps import get_current_user
from backend.app.repositories.chat_repo import chat_repo

router = APIRouter(prefix="/chat", tags=["Chat"])

class SendMessageRequest(BaseModel):
    content: str

@router.get("/{booking_id}/messages")
async def get_messages(booking_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    return await chat_repo.list_by_booking(booking_id)

@router.post("/{booking_id}/messages")
async def send_message(booking_id: str, body: SendMessageRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    return await chat_repo.create_message(
        booking_id=booking_id,
        sender_id=current_user["id"],
        sender_name=current_user.get("full_name", "User"),
        content=body.content
    )

