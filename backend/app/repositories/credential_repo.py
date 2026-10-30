import uuid
from typing import Optional, Dict, Any, List
from app.repositories.base import BaseRepository

class CredentialRepository(BaseRepository):
    def __init__(self):
        super().__init__("user_credentials")
        self._memory_credentials: Dict[str, Dict[str, Any]] = {
            "66666666-6666-6666-6666-666666666661": {
                "id": "66666666-6666-6666-6666-666666666661",
                "user_id": "44444444-4444-4444-4444-444444444444",
                "credential_name": "Lab Safety Level 2 Certification",
                "issuing_body": "Campus EHS Division",
                "issue_date": "2026-01-15",
                "expiry_date": "2027-01-15",
                "document_path": "verification-docs/demo_lab_safety.pdf",
                "status": "approved",
                "ai_analysis": {"confidence": 0.98, "matches_requirement": True, "name_match": True, "reasons": ["Valid certificate issued by Campus EHS Division"]}
            },
            "66666666-6666-6666-6666-666666666662": {
                "id": "66666666-6666-6666-6666-666666666662",
                "user_id": "44444444-4444-4444-4444-444444444444",
                "credential_name": "CNC Operator Clearance",
                "issuing_body": "Fab Lab Training Board",
                "issue_date": "2026-02-10",
                "expiry_date": "2027-02-10",
                "document_path": "verification-docs/demo_cnc_cert.pdf",
                "status": "approved",
                "ai_analysis": {"confidence": 0.95, "matches_requirement": True, "name_match": True, "reasons": ["Clearance verified"]}
            },
            "66666666-6666-6666-6666-666666666663": {
                "id": "66666666-6666-6666-6666-666666666663",
                "user_id": "55555555-5555-5555-5555-555555555555",
                "credential_name": "Studio Induction",
                "issuing_body": "Media Production Department",
                "issue_date": "2026-03-01",
                "expiry_date": "2027-03-01",
                "document_path": "verification-docs/demo_studio_ind.pdf",
                "status": "approved",
                "ai_analysis": {"confidence": 0.99, "matches_requirement": True, "name_match": True, "reasons": ["Induction records complete"]}
            }
        }

    async def get_by_id(self, cred_id: str) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*").eq("id", cred_id).execute()
            if res.data:
                return res.data[0]
        return self._memory_credentials.get(str(cred_id))

    async def list_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*").eq("user_id", user_id).execute()
            if res.data:
                return res.data
        return [c for c in self._memory_credentials.values() if c.get("user_id") == str(user_id)]

    async def list_pending_review(self) -> List[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*, users:user_id(full_name, email, department)").in_("status", ["ai_verified_pending_review", "pending_upload", "analyzing"]).execute()
            if res.data:
                return res.data
        return [c for c in self._memory_credentials.values() if c.get("status") in ["ai_verified_pending_review", "pending_upload", "analyzing"]]

    async def create(self, cred_data: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in cred_data:
            cred_data["id"] = str(uuid.uuid4())
        if self.is_live():
            res = self.get_client().table(self.table_name).insert(cred_data).execute()
            if res.data:
                return res.data[0]
        self._memory_credentials[cred_data["id"]] = cred_data
        return cred_data

    async def update(self, cred_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).update(updates).eq("id", cred_id).execute()
            if res.data:
                return res.data[0]
        c = self._memory_credentials.get(str(cred_id))
        if c:
            c.update(updates)
            return c
        return None

credential_repo = CredentialRepository()

