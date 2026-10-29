from pydantic import BaseModel
from typing import Optional, List

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    dob: Optional[str] = None
    department: Optional[str] = None
    academic_role: Optional[str] = None

class UserRoleUpdateRequest(BaseModel):
    system_role: str # 'user', 'owner', 'manager', 'admin'

