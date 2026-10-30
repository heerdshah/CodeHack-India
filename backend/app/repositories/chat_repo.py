from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
from app.repositories.base import BaseRepository

class ChatRepository(BaseRepository):
    def __init__(self):
        super().__init__("chat_messages")
        self._memory_messages: List[Dict[str, Any]] = [
            {
                "id": "msg-demo-1",
                "booking_id": "book-1",
                "sender_id": "22222222-2222-2222-2222-222222222222",
                "sender_name": "Dr. Mira Okafor",
                "content": "Hi! Please make sure to bring your safety goggles for the 5-Axis CNC session.",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ]

    async def list_by_booking(self, booking_id: str) -> List[Dict[str, Any]]:
        client = self.get_client()
        if client:
            try:
                res = client.table("chat_messages").select("*").eq("booking_id", booking_id).order("created_at").execute()
                if res.data is not None:
                    return res.data
            except Exception:
                pass
        return [m for m in self._memory_messages if str(m.get("booking_id")) == str(booking_id)]

    async def create_message(self, booking_id: str, sender_id: str, sender_name: str, content: str) -> Dict[str, Any]:
        msg = {
            "id": str(uuid.uuid4()),
            "booking_id": booking_id,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        client = self.get_client()
        if client:
            try:
                client.table("chat_messages").insert(msg).execute()
            except Exception:
                pass
        self._memory_messages.append(msg)
        return msg

chat_repo = ChatRepository()

