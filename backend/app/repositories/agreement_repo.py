import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.repositories.base import BaseRepository

logger = logging.getLogger("resourcx.agreements")

class AgreementRepository(BaseRepository):
    def __init__(self):
        super().__init__("agreements")
        self._memory_agreements: Dict[str, Dict[str, Any]] = {}

    async def get_by_booking_id(self, booking_id: str) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*").eq("booking_id", booking_id).execute()
            return res.data[0] if res.data else None
        for a in self._memory_agreements.values():
            if a.get("booking_id") == booking_id:
                return a
        return None

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in data:
            data["id"] = str(uuid.uuid4())
        data["created_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_live():
            res = self.get_client().table(self.table_name).insert(data).select("*").execute()
            if not res.data:
                raise RuntimeError(f"Agreement insert returned no row for booking {data.get('booking_id')}.")
            return res.data[0]
        self._memory_agreements[data["id"]] = data
        return data

    async def update(self, agreement_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self.is_live():
            res = self.get_client().table(self.table_name).update(updates).eq("id", agreement_id).select("*").execute()
            if not res.data:
                logger.error("Agreement update returned no row for agreement %s", agreement_id)
                return None
            return res.data[0]
        a = self._memory_agreements.get(agreement_id)
        if a:
            a.update(updates)
            return a
        return None

agreement_repo = AgreementRepository()
