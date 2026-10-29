import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from backend.app.repositories.base import BaseRepository

class IncidentRepository(BaseRepository):
    def __init__(self):
        super().__init__("incidents")
        self._memory_incidents: Dict[str, Dict[str, Any]] = {
            "77777777-7777-7777-7777-777777777771": {
                "id": "77777777-7777-7777-7777-777777777771",
                "booking_id": "bk-seed-2",
                "resource_id": "sound-stage",
                "reported_by": "55555555-5555-5555-5555-555555555555",
                "angle": "Bottom",
                "status": "under_review",
                "severity": "medium",
                "title": "Floor scuff detected during return inspection",
                "description": "Post-inspection flagged scuff mark near lighting stand anchor.",
                "ai_summary": "Minor surface wear detected from Bottom angle comparison with 61% confidence. Potential cosmetic scuff.",
                "photos": ["/images/res-studio.jpg"],
                "created_at": "2026-10-26T18:35:00Z"
            }
        }

    async def get_by_id(self, incident_id: str) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*, users:reported_by(full_name, email), resources:resource_id(name)").eq("id", incident_id).execute()
            if res.data:
                return res.data[0]
        return self._memory_incidents.get(incident_id)

    async def list_all(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.is_live():
            q = self.get_client().table(self.table_name).select("*, users:reported_by(full_name, email), resources:resource_id(name)")
            if status:
                q = q.eq("status", status)
            res = q.order("created_at", desc=True).execute()
            if res.data:
                return res.data
        items = list(self._memory_incidents.values())
        if status:
            items = [i for i in items if i.get("status") == status]
        return items

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in data:
            data["id"] = str(uuid.uuid4())
        data["created_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_live():
            res = self.get_client().table(self.table_name).insert(data).execute()
            if res.data:
                return res.data[0]
        self._memory_incidents[data["id"]] = data
        return data

    async def update(self, incident_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_live():
            res = self.get_client().table(self.table_name).update(updates).eq("id", incident_id).execute()
            if res.data:
                return res.data[0]
        inc = self._memory_incidents.get(incident_id)
        if inc:
            inc.update(updates)
            return inc
        return None

incident_repo = IncidentRepository()

