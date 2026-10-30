import uuid
from typing import Optional, Dict, Any, List
from app.repositories.base import BaseRepository
from app.core.security import get_password_hash

# Pre-computed bcrypt hashes for seed passwords (rounds=4 for fast startup).
# In production with Supabase these are not used.
_ADMIN_HASH = "$2b$04$wdahq5fAYylTRvsJXgPeiO/9Hn2V9f5GJAhl0gOCkJVx7dxD19YvS"   # AdminPass123!
_OWNER_HASH = "$2b$04$0vlrxcwK/0UlDMaeCYewmeJEmIorbi8uFZijhe9dL8zwqj57jlbQK"   # OwnerPass123!
_USER_HASH  = "$2b$04$m7JjW3CNoLLJruSmcryiO.EluE7EETbEXGTnHMpv8I/f8.AZ2ibVe"    # UserPass123!

class UserRepository(BaseRepository):
    def __init__(self):
        super().__init__("users")
        # In-memory store fallback with seed users
        self._memory_users: Dict[str, Dict[str, Any]] = {
            "11111111-1111-1111-1111-111111111111": {
                "id": "11111111-1111-1111-1111-111111111111",
                "email": "admin@inst.edu",
                "username": "admin",
                "password_hash": _ADMIN_HASH,
                "full_name": "System Administrator",
                "dob": "1985-05-15",
                "academic_role": "Faculty",
                "department": "Computer Science",
                "system_role": "admin",
                "id_document_path": "verification-docs/admin_id.pdf",
                "is_verified": True
            },
            "22222222-2222-2222-2222-222222222222": {
                "id": "22222222-2222-2222-2222-222222222222",
                "email": "mira.okafor@inst.edu",
                "username": "mira_okafor",
                "password_hash": _OWNER_HASH,
                "full_name": "Dr. Mira Okafor",
                "dob": "1982-08-20",
                "academic_role": "Faculty",
                "department": "Mechanical Engineering",
                "system_role": "owner",
                "id_document_path": "verification-docs/mira_id.pdf",
                "is_verified": True
            },
            "33333333-3333-3333-3333-333333333333": {
                "id": "33333333-3333-3333-3333-333333333333",
                "email": "anders.halden@inst.edu",
                "username": "anders_halden",
                "password_hash": _OWNER_HASH,
                "full_name": "Prof. Anders Halden",
                "dob": "1978-03-12",
                "academic_role": "Faculty",
                "department": "Computer Science",
                "system_role": "owner",
                "id_document_path": "verification-docs/anders_id.pdf",
                "is_verified": True
            },
            "44444444-4444-4444-4444-444444444444": {
                "id": "44444444-4444-4444-4444-444444444444",
                "email": "p.raman@inst.edu",
                "username": "priya_raman",
                "password_hash": _USER_HASH,
                "full_name": "Priya Raman",
                "dob": "1998-11-04",
                "academic_role": "Researcher",
                "department": "Mechanical Engineering",
                "system_role": "user",
                "id_document_path": "verification-docs/priya_id.pdf",
                "is_verified": True
            },
            "55555555-5555-5555-5555-555555555555": {
                "id": "55555555-5555-5555-5555-555555555555",
                "email": "t.reyes@inst.edu",
                "username": "tomas_reyes",
                "password_hash": _USER_HASH,
                "full_name": "Tomás Reyes",
                "dob": "2002-04-18",
                "academic_role": "Student",
                "department": "Media & Film",
                "system_role": "user",
                "id_document_path": "verification-docs/tomas_id.pdf",
                "is_verified": True
            }
        }

    async def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*").eq("id", user_id).execute()
            if res.data:
                return res.data[0]
        return self._memory_users.get(str(user_id))

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*").ilike("email", clean_email).execute()
            if res.data:
                return res.data[0]
        for u in self._memory_users.values():
            if u["email"].lower() == clean_email:
                return u
        return None

    async def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        clean_username = username.strip().lower()
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*").ilike("username", clean_username).execute()
            if res.data:
                return res.data[0]
        for u in self._memory_users.values():
            if u["username"].lower() == clean_username:
                return u
        return None

    async def create(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in user_data:
            user_data["id"] = str(uuid.uuid4())
        user_data["email"] = user_data["email"].strip().lower()
        user_data["username"] = user_data["username"].strip().lower()

        if self.is_live():
            res = self.get_client().table(self.table_name).insert(user_data).execute()
            if res.data:
                return res.data[0]

        self._memory_users[str(user_data["id"])] = user_data
        return user_data

    async def update(self, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).update(updates).eq("id", user_id).execute()
            if res.data:
                return res.data[0]

        user = self._memory_users.get(str(user_id))
        if user:
            user.update(updates)
            return user
        return None

    async def list_all(self) -> List[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*").order("created_at", desc=True).execute()
            if res.data:
                return res.data
        return list(self._memory_users.values())

user_repo = UserRepository()
