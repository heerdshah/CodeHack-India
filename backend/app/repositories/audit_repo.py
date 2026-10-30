import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from app.repositories.base import BaseRepository

class AuditRepository(BaseRepository):
    def __init__(self):
        super().__init__("audit_log")
        self._memory_audit: List[Dict[str, Any]] = [
            {
                "id": "99999999-9999-9999-9999-999999999991",
                "actor_id": "11111111-1111-1111-1111-111111111111",
                "actor_role": "admin",
                "action": "system.init",
                "entity_type": "system",
                "entity_id": "seed",
                "before_state": None,
                "after_state": {"status": "initialized"},
                "ip_address": "127.0.0.1",
                "created_at": "2026-10-24T00:00:00Z"
            }
        ]
        self._memory_flags: List[Dict[str, Any]] = []

    async def log(
        self,
        actor_id: Optional[str],
        actor_role: str,
        action: str,
        entity_type: str,
        entity_id: str,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        try:
            entry = {
                "id": str(uuid.uuid4()),
                "actor_id": actor_id,
                "actor_role": actor_role,
                "action": action,
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "before_state": before_state,
                "after_state": after_state,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            if self.is_live():
                try:
                    res = self.get_client().table(self.table_name).insert(entry).execute()
                    if res.data:
                        return res.data[0]
                except Exception as e:
                    logger.warning(f"[Audit] Supabase insert failed: {e}")
            self._memory_audit.insert(0, entry)
            return entry
        except Exception as e:
            logger.warning(f"[Audit] Log failed: {e}")
            return None

    async def list_logs(
        self,
        entity_type: Optional[str] = None,
        actor_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        if self.is_live():
            q = self.get_client().table(self.table_name).select("*")
            if entity_type:
                q = q.eq("entity_type", entity_type)
            if actor_id:
                q = q.eq("actor_id", actor_id)
            res = q.order("created_at", desc=True).limit(limit).execute()
            if res.data:
                return res.data
        filtered = self._memory_audit
        if entity_type:
            filtered = [e for e in filtered if e.get("entity_type") == entity_type]
        if actor_id:
            filtered = [e for e in filtered if e.get("actor_id") == actor_id]
        return filtered[:limit]

    # Suspicious flags for managers
    async def flag_user(self, user_id: str, flag_type: str, reason: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "flag_type": flag_type,
            "reason": reason,
            "evidence": evidence,
            "is_reviewed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        if self.is_live():
            res = self.get_client().table("suspicious_flags").insert(entry).execute()
            if res.data:
                return res.data[0]
        self._memory_flags.append(entry)
        return entry

    async def list_flags(self) -> List[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table("suspicious_flags").select("*, users:user_id(full_name, email, department)").order("created_at", desc=True).execute()
            if res.data:
                return res.data
        return self._memory_flags

audit_repo = AuditRepository()

