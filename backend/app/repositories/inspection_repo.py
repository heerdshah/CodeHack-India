import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from backend.app.repositories.base import BaseRepository

class InspectionRepository(BaseRepository):
    def __init__(self):
        super().__init__("inspections")
        self._memory_inspections: Dict[str, Dict[str, Any]] = {
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1": {
                "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
                "booking_id": "bk-seed-2",
                "phase": "pre",
                "completed_by": "55555555-5555-5555-5555-555555555555",
                "findings": ["Baseline recorded across 6 angles"],
                "flagged": False,
                "completed_at": "2026-10-24T09:15:00Z"
            },
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2": {
                "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
                "booking_id": "bk-seed-2",
                "phase": "post",
                "completed_by": "55555555-5555-5555-5555-555555555555",
                "findings": ["Possible new scuff on floor — Bottom view (61% confidence)"],
                "flagged": True,
                "completed_at": "2026-10-26T18:30:00Z"
            }
        }
        self._memory_photos: Dict[str, Dict[str, Any]] = {}

    async def get_by_booking_and_phase(self, booking_id: str, phase: str) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*, inspection_photos(*)").eq("booking_id", booking_id).eq("phase", phase).execute()
            if res.data:
                return res.data[0]
        for insp in self._memory_inspections.values():
            if insp.get("booking_id") == booking_id and insp.get("phase") == phase:
                insp_copy = dict(insp)
                insp_copy["inspection_photos"] = [p for p in self._memory_photos.values() if p.get("inspection_id") == insp["id"]]
                return insp_copy
        return None

    async def create_inspection(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in data:
            data["id"] = str(uuid.uuid4())
        data["completed_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_live():
            res = self.get_client().table(self.table_name).insert(data).execute()
            if res.data:
                return res.data[0]
        self._memory_inspections[data["id"]] = data
        return data

    async def add_photo(self, photo_data: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in photo_data:
            photo_data["id"] = str(uuid.uuid4())
        if self.is_live():
            res = self.get_client().table("inspection_photos").insert(photo_data).execute()
            if res.data:
                return res.data[0]
        self._memory_photos[photo_data["id"]] = photo_data
        return photo_data

    async def get_photos_for_inspection(self, inspection_id: str) -> List[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table("inspection_photos").select("*").eq("inspection_id", inspection_id).execute()
            if res.data:
                return res.data
        return [p for p in self._memory_photos.values() if p.get("inspection_id") == inspection_id]

inspection_repo = InspectionRepository()

