from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from pydantic import BaseModel, Field

from backend.app.core.config import settings
from backend.app.core.deps import get_current_user
from backend.app.core.supabase import get_supabase_admin

router = APIRouter(prefix="/chat", tags=["Chat"])


class ConversationCreateRequest(BaseModel):
    booking_id: str = Field(min_length=1, max_length=80)


class DirectConversationRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)


class MessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


def _client():
    client = get_supabase_admin()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat requires a configured Supabase service client.",
        )
    return client


def _participant(conversation: dict[str, Any], user_id: str) -> bool:
    return user_id in (conversation["customer_id"], conversation["seller_id"])


def _get_conversation(client, conversation_id: str, user_id: str) -> dict[str, Any]:
    result = (
        client.table("conversations")
        .select("id,booking_id,customer_id,seller_id")
        .eq("id", conversation_id)
        .limit(1)
        .execute()
    )
    conversation = (result.data or [None])[0]
    if not conversation or not _participant(conversation, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    return conversation


def _present_conversation(client, conversation: dict[str, Any], user_id: str) -> dict[str, Any]:
    customer_id = conversation["customer_id"]
    seller_id = conversation["seller_id"]
    users = (
        client.table("users")
        .select("id,username,full_name")
        .in_("id", [customer_id, seller_id])
        .execute()
        .data
        or []
    )
    other_user_id = seller_id if user_id == customer_id else customer_id
    other_user = next((user for user in users if user["id"] == other_user_id), None)
    if not other_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The other participant's profile could not be loaded.",
        )

    unread_result = (
        client.table("messages")
        .select("id", count="exact", head=True)
        .eq("conversation_id", conversation["id"])
        .eq("is_read", False)
        .neq("sender_id", user_id)
        .execute()
    )
    return {
        **conversation,
        "other_user": {
            "id": other_user["id"],
            "username": other_user["username"],
            "name": other_user["full_name"],
        },
        "unread_count": unread_result.count or 0,
    }


@router.get("/realtime-token")
async def get_realtime_token(current_user: dict = Depends(get_current_user)):
    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configure SUPABASE_JWT_SECRET to enable authenticated chat updates.",
        )

    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": current_user["id"],
            "role": "authenticated",
            "aud": "authenticated",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=15)).timestamp()),
        },
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )
    return {"token": token}


@router.get("/conversations")
async def list_conversations(current_user: dict = Depends(get_current_user)):
    client = _client()
    user_id = current_user["id"]
    result = (
        client.table("conversations")
        .select("id,booking_id,customer_id,seller_id")
        .or_(f"customer_id.eq.{user_id},seller_id.eq.{user_id}")
        .execute()
    )
    conversations = result.data or []
    return [
        _present_conversation(client, conversation, user_id)
        for conversation in conversations
    ]


@router.post("/conversations")
async def create_conversation(
    request: ConversationCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    client = _client()
    booking_result = (
        client.table("bookings")
        .select("id,user_id,resource_id,status")
        .eq("id", request.booking_id)
        .limit(1)
        .execute()
    )
    booking = (booking_result.data or [None])[0]
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
    if booking["status"] in {"rejected", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chat is unavailable for rejected or cancelled bookings.",
        )

    resource_result = (
        client.table("resources")
        .select("owner_id")
        .eq("id", booking["resource_id"])
        .limit(1)
        .execute()
    )
    resource = (resource_result.data or [None])[0]
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

    customer_id = booking["user_id"]
    seller_id = resource["owner_id"]
    if customer_id == seller_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A booking customer cannot start a conversation with themselves.",
        )
    if current_user["id"] not in (customer_id, seller_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the booking customer or resource owner can start this chat.",
        )

    result = (
        client.table("conversations")
        .upsert(
            {
                "booking_id": booking["id"],
                "customer_id": customer_id,
                "seller_id": seller_id,
            },
            on_conflict="booking_id",
        )
        .execute()
    )
    conversation = (result.data or [None])[0]
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create the booking conversation.",
        )
    return _present_conversation(client, conversation, current_user["id"])


@router.post("/direct")
async def create_direct_conversation(
    request: DirectConversationRequest,
    current_user: dict = Depends(get_current_user),
):
    username = request.username.strip().removeprefix("@")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter the other person's username.",
        )

    client = _client()
    result = (
        client.table("users")
        .select("id")
        .eq("username", username)
        .limit(1)
        .execute()
    )
    other_user = (result.data or [None])[0]
    if not other_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found with username @{username}.",
        )
    if other_user["id"] == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot start a conversation with yourself.",
        )

    result = client.rpc(
        "get_or_create_direct_conversation",
        {
            "p_user_a": current_user["id"],
            "p_user_b": other_user["id"],
        },
    ).execute()
    conversation = (result.data or [None])[0]
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create the direct conversation.",
        )
    return _present_conversation(client, conversation, current_user["id"])


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    client = _client()
    _get_conversation(client, conversation_id, current_user["id"])
    result = (
        client.table("messages")
        .select("id,conversation_id,sender_id,content,is_read,created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    request: MessageCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    client = _client()
    _get_conversation(client, conversation_id, current_user["id"])
    content = request.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message content cannot be blank.",
        )
    result = (
        client.table("messages")
        .insert(
            {
                "conversation_id": conversation_id,
                "sender_id": current_user["id"],
                "content": content,
            }
        )
        .execute()
    )
    message = (result.data or [None])[0]
    if not message:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Message could not be sent.",
        )
    return message


@router.post("/conversations/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    client = _client()
    _get_conversation(client, conversation_id, current_user["id"])
    (
        client.table("messages")
        .update({"is_read": True})
        .eq("conversation_id", conversation_id)
        .neq("sender_id", current_user["id"])
        .eq("is_read", False)
        .execute()
    )
    return {"ok": True}
