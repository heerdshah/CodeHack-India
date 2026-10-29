import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from backend.app.repositories.base import BaseRepository

class NotificationRepository(BaseRepository):
    def __init__(self):
        super().__init__("notifications")
        self._memory_notifs: Dict[str, Dict[str, Any]] = {
            "88888888-8888-8888-8888-888888888881": {
                "id": "88888888-8888-8888-8888-888888888881",
                "user_id": "44444444-4444-4444-4444-444444444444",
                "type": "booking_request",
                "title": "Booking Submitted",
                "message": "Your booking request for 5-Axis CNC Mill has been submitted for owner approval.",
                "data": {"booking_id": "bk-seed-1"},
                "is_read": False,
                "created_at": "2026-10-24T10:01:00Z"
            }
        }

    async def list_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
            if res.data:
                return res.data
        items = [n for n in self._memory_notifs.values() if n.get("user_id") == str(user_id)]
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return items

    async def create(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            if "id" not in data:
                data["id"] = str(uuid.uuid4())
            data["created_at"] = datetime.now(timezone.utc).isoformat()
            if "is_read" not in data:
                data["is_read"] = False
            if self.is_live():
                res = self.get_client().table(self.table_name).insert(data).execute()
                if res.data:
                    return res.data[0]
            self._memory_notifs[data["id"]] = data
            return data
        except Exception as e:
            logger.warning(f"[Notification] Failed to create notification: {e}")
            return None

    async def mark_as_read(self, notif_id: str, user_id: str) -> bool:
        if self.is_live():
            self.get_client().table(self.table_name).update({"is_read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
            return True
        n = self._memory_notifs.get(notif_id)
        if n and n.get("user_id") == str(user_id):
            n["is_read"] = True
            return True
        return False

    async def mark_all_as_read(self, user_id: str) -> bool:
        if self.is_live():
            self.get_client().table(self.table_name).update({"is_read": True}).eq("user_id", user_id).execute()
            return True
        for n in self._memory_notifs.values():
            if n.get("user_id") == str(user_id):
                n["is_read"] = True
        return True

notification_repo = NotificationRepository()

