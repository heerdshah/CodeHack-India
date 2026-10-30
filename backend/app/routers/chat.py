from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.supabase import get_supabase_admin
from app.repositories.booking_repo import booking_repo
from app.repositories.chat_repo import chat_repo
from app.repositories.local_chat_repo import local_chat_repo
from app.repositories.resource_repo import resource_repo
from app.repositories.user_repo import user_repo

router = APIRouter(prefix="/chat", tags=["Chat"])


class DirectConversationRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)


class MessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


def _client():
    client = get_supabase_admin()
    if client is not None and not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configure SUPABASE_SERVICE_KEY to use persistent chat.",
        )
    return client


def _is_participant(conversation: dict[str, Any], user_id: str) -> bool:
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
    if not conversation or not _is_participant(conversation, user_id):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conversation


async def _require_booking_chat_party(booking_id: str, user_id: str):
    booking = await booking_repo.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    resource = await resource_repo.get_by_id(booking["resource_id"])
    if user_id not in {
        booking.get("user_id"),
        resource.get("owner_id") if resource else None,
    }:
        raise HTTPException(status_code=403, detail="You are not a party to this booking.")
    return booking


def _present_conversation(client, conversation: dict[str, Any], user_id: str) -> dict[str, Any]:
    participant_ids = [conversation["customer_id"], conversation["seller_id"]]
    users = (
        client.table("users")
        .select("id,username,full_name")
        .in_("id", participant_ids)
        .execute()
        .data
        or []
    )
    other_user_id = (
        conversation["seller_id"]
        if user_id == conversation["customer_id"]
        else conversation["customer_id"]
    )
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


async def _present_memory_conversation(conversation: dict[str, Any], user_id: str):
    other_user_id = (
        conversation["seller_id"]
        if user_id == conversation["customer_id"]
        else conversation["customer_id"]
    )
    other_user = await user_repo.get_by_id(other_user_id)
    if not other_user:
        raise HTTPException(status_code=500, detail="The other participant's profile could not be loaded.")
    unread_count = await local_chat_repo.unread_count(conversation["id"], user_id)
    return {
        **conversation,
        "other_user": {
            "id": other_user["id"],
            "username": other_user["username"],
            "name": other_user["full_name"],
        },
        "unread_count": unread_count,
    }


@router.get("/users")
async def search_users(
    query: str = Query(min_length=2, max_length=80),
    current_user: dict = Depends(get_current_user),
):
    search = query.strip().removeprefix("@").lower()
    if len(search) < 2:
        return []
    client = _client()
    if client is None:
        result_users = [
            user
            for user in await user_repo.list_all()
            if user.get("id") != current_user["id"]
            and user.get("username", "").lower().startswith(search)
        ][:10]
    else:
        result = (
            client.table("users")
            .select("id,username,full_name")
            .ilike("username", f"{search}%")
            .neq("id", current_user["id"])
            .limit(10)
            .execute()
        )
        result_users = result.data or []
    return [
        {"id": user["id"], "username": user["username"], "name": user["full_name"]}
        for user in result_users
    ]


@router.get("/conversations")
async def list_conversations(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    client = _client()
    if client is None:
        conversations = await local_chat_repo.list_conversations(user_id)
        return [
            await _present_memory_conversation(conversation, user_id)
            for conversation in conversations
        ]
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


@router.post("/direct")
async def create_direct_conversation(
    request: DirectConversationRequest,
    current_user: dict = Depends(get_current_user),
):
    username = request.username.strip().removeprefix("@").lower()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter the other person's username.",
        )

    client = _client()
    if client is None:
        other_user = await user_repo.get_by_username(username)
    else:
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

    if client is None:
        conversation = await local_chat_repo.get_or_create_direct_conversation(
            current_user["id"],
            other_user["id"],
        )
    else:
        result = client.rpc(
            "get_or_create_direct_conversation",
            {"p_user_a": current_user["id"], "p_user_b": other_user["id"]},
        ).execute()
        conversation = (result.data or [None])[0]
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create the direct conversation.",
        )
    if client is None:
        return await _present_memory_conversation(conversation, current_user["id"])
    return _present_conversation(client, conversation, current_user["id"])


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    client = _client()
    if client is None:
        conversation = await local_chat_repo.get_conversation(conversation_id)
        if not conversation or not _is_participant(conversation, current_user["id"]):
            raise HTTPException(status_code=404, detail="Conversation not found.")
        return await local_chat_repo.list_messages(conversation_id, current_user["id"])
    _get_conversation(client, conversation_id, current_user["id"])
    result = (
        client.table("messages")
        .select("id,conversation_id,sender_id,content,is_read,created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )
    messages = result.data or []
    (
        client.table("messages")
        .update({"is_read": True})
        .eq("conversation_id", conversation_id)
        .neq("sender_id", current_user["id"])
        .eq("is_read", False)
        .execute()
    )
    return messages


@router.post(
    "/conversations/{conversation_id}/messages",
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: str,
    request: MessageCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    content = request.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    client = _client()
    if client is None:
        conversation = await local_chat_repo.get_conversation(conversation_id)
        if not conversation or not _is_participant(conversation, current_user["id"]):
            raise HTTPException(status_code=404, detail="Conversation not found.")
        return await local_chat_repo.create_message(
            conversation_id,
            current_user["id"],
            content,
        )
    _get_conversation(client, conversation_id, current_user["id"])
    result = (
        client.table("messages")
        .insert({
            "conversation_id": conversation_id,
            "sender_id": current_user["id"],
            "content": content,
        })
        .select("id,conversation_id,sender_id,content,is_read,created_at")
        .execute()
    )
    message = (result.data or [None])[0]
    if not message:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not send the message.",
        )
    return message


@router.get("/{booking_id}/messages")
async def list_booking_messages(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    await _require_booking_chat_party(booking_id, current_user["id"])
    return await chat_repo.list_by_booking(booking_id)


@router.post("/{booking_id}/messages")
async def send_booking_message(
    booking_id: str,
    request: MessageCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    content = request.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    await _require_booking_chat_party(booking_id, current_user["id"])
    return await chat_repo.create_message(
        booking_id=booking_id,
        sender_id=current_user["id"],
        sender_name=current_user.get("full_name", "User"),
        content=content,
    )
