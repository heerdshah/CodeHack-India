import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from app.repositories.base import BaseRepository

class BookingRepository(BaseRepository):
    def __init__(self):
        super().__init__("bookings")
        self._memory_bookings: Dict[str, Dict[str, Any]] = {
            "bk-seed-1": {
                "id": "bk-seed-1",
                "resource_id": "cnc-5axis",
                "user_id": "44444444-4444-4444-4444-444444444444",
                "start_date": "2026-11-10T09:00:00Z",
                "end_date": "2026-11-12T17:00:00Z",
                "purpose": "Machining titanium test coupons for a fatigue study.",
                "status": "pending",
                "proof_files": ["verification-docs/demo_cnc_cert.pdf"],
                "owner_verified": False,
                "created_at": "2026-10-24T10:00:00Z"
            },
            "bk-seed-2": {
                "id": "bk-seed-2",
                "resource_id": "sound-stage",
                "user_id": "55555555-5555-5555-5555-555555555555",
                "start_date": "2026-10-24T09:00:00Z",
                "end_date": "2026-10-26T18:00:00Z",
                "purpose": "Final-year thesis short film shoot.",
                "status": "returned",
                "proof_files": ["verification-docs/demo_studio_ind.pdf"],
                "checkin_otp": "482913",
                "owner_verified": True,
                "created_at": "2026-10-20T11:00:00Z"
            }
        }
        self._memory_waitlist: Dict[str, Dict[str, Any]] = {}

    async def get_by_id(self, booking_id: str) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*, users:user_id(full_name, email, academic_role, department)").eq("id", booking_id).execute()
            if res.data:
                return res.data[0]
        return self._memory_bookings.get(booking_id)

    async def list_by_resource(self, resource_id: str) -> List[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*, users:user_id(full_name, email, academic_role, department)").eq("resource_id", resource_id).execute()
            if res.data:
                return res.data
        return [b for b in self._memory_bookings.values() if b.get("resource_id") == resource_id]

    async def list_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*, resources:resource_id(name, department, location, image)").eq("user_id", user_id).execute()
            if res.data:
                return res.data
        return [b for b in self._memory_bookings.values() if b.get("user_id") == str(user_id)]

    async def list_all(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.is_live():
            q = self.get_client().table(self.table_name).select("*, users:user_id(full_name, email, academic_role, department), resources:resource_id(name, department, location, owner_id)")
            if status:
                q = q.eq("status", status)
            res = q.order("start_date", desc=True).execute()
            if res.data:
                return res.data
        items = list(self._memory_bookings.values())
        if status:
            items = [b for b in items if b.get("status") == status]
        return items

    async def check_overlap(self, resource_id: str, start: datetime, end: datetime, exclude_booking_id: Optional[str] = None) -> bool:
        """Checks if interval overlaps with confirmed/active bookings."""
        active_statuses = ["approved", "signed", "active", "overdue"]
        if self.is_live():
            # Query supabase for potential overlaps
            res = self.get_client().table(self.table_name).select("id, start_date, end_date").eq("resource_id", resource_id).in_("status", active_statuses).execute()
            for b in (res.data or []):
                if exclude_booking_id and b["id"] == exclude_booking_id:
                    continue
                b_start = datetime.fromisoformat(b["start_date"].replace("Z", "+00:00"))
                b_end = datetime.fromisoformat(b["end_date"].replace("Z", "+00:00"))
                if max(start, b_start) < min(end, b_end):
                    return True
            return False

        for b in self._memory_bookings.values():
            if b.get("resource_id") != resource_id or b.get("status") not in active_statuses:
                continue
            if exclude_booking_id and b.get("id") == exclude_booking_id:
                continue
            b_start = datetime.fromisoformat(b["start_date"].replace("Z", "+00:00"))
            b_end = datetime.fromisoformat(b["end_date"].replace("Z", "+00:00"))
            if max(start, b_start) < min(end, b_end):
                return True
        return False

    async def create(self, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in booking_data:
            booking_data["id"] = f"bk-{uuid.uuid4().hex[:8]}"
        if "created_at" not in booking_data:
            booking_data["created_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_live():
            res = self.get_client().table(self.table_name).insert(booking_data).execute()
            if res.data:
                return res.data[0]
        self._memory_bookings[booking_data["id"]] = booking_data
        return booking_data

    async def update(self, booking_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_live():
            res = self.get_client().table(self.table_name).update(updates).eq("id", booking_id).execute()
            if res.data:
                return res.data[0]
        b = self._memory_bookings.get(booking_id)
        if b:
            b.update(updates)
            return b
        return None

    # Waitlist operations
    async def get_waitlist_by_resource(self, resource_id: str) -> List[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table("waitlist").select("*, users:user_id(full_name, email)").eq("resource_id", resource_id).eq("status", "waiting").order("position").execute()
            if res.data:
                return res.data
        entries = [w for w in self._memory_waitlist.values() if w.get("resource_id") == resource_id and w.get("status") in ["waiting", "promoted_holding"]]
        entries.sort(key=lambda x: x.get("position", 0))
        return entries

    async def add_to_waitlist(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in entry:
            entry["id"] = str(uuid.uuid4())
        # compute next position
        existing = await self.get_waitlist_by_resource(entry["resource_id"])
        entry["position"] = len(existing) + 1
        entry["status"] = "waiting"
        entry["created_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_live():
            res = self.get_client().table("waitlist").insert(entry).execute()
            if res.data:
                return res.data[0]
        self._memory_waitlist[entry["id"]] = entry
        return entry

    async def update_waitlist_entry(self, entry_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_live():
            res = self.get_client().table("waitlist").update(updates).eq("id", entry_id).execute()
            if res.data:
                return res.data[0]
        w = self._memory_waitlist.get(entry_id)
        if w:
            w.update(updates)
            return w
        return None

    def reset(self):
        """Resets in-memory store to initial seed state."""
        self._memory_bookings = {
            "bk-seed-1": {
                "id": "bk-seed-1",
                "resource_id": "cnc-5axis",
                "user_id": "44444444-4444-4444-4444-444444444444",
                "start_date": "2026-11-10T09:00:00Z",
                "end_date": "2026-11-12T17:00:00Z",
                "purpose": "Machining titanium test coupons for a fatigue study.",
                "status": "pending",
                "proof_files": ["verification-docs/demo_cnc_cert.pdf"],
                "owner_verified": False,
                "created_at": "2026-10-24T10:00:00Z"
            },
            "bk-seed-2": {
                "id": "bk-seed-2",
                "resource_id": "sound-stage",
                "user_id": "55555555-5555-5555-5555-555555555555",
                "start_date": "2026-10-24T09:00:00Z",
                "end_date": "2026-10-26T18:00:00Z",
                "purpose": "Final-year thesis short film shoot.",
                "status": "returned",
                "proof_files": ["verification-docs/demo_studio_ind.pdf"],
                "checkin_otp": "482913",
                "owner_verified": True,
                "created_at": "2026-10-20T11:00:00Z"
            }
        }
        self._memory_waitlist = {}

booking_repo = BookingRepository()

