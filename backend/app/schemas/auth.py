import re
from pydantic import BaseModel, field_validator
from typing import Optional, List

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str
    full_name: str
    dob: str
    academic_role: str = "Student"
    department: str
    id_document_path: Optional[str] = None

    @field_validator("email")
    def validate_academic_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.search(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(edu|ac\.in)$', clean):
            raise ValueError("Registration requires an institutional email ending in .edu or .ac.in")
        return clean

    @field_validator("username")
    def validate_username(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 3:
            raise ValueError("Username must be at least 3 characters long")
        return clean

class LoginRequest(BaseModel):
    identifier: str # Username or Email
    password: str

class UserProfileResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    dob: str
    academic_role: str
    department: str
    system_role: str
    id_document_path: Optional[str] = None
    is_verified: bool
    credentials: List[str] = []
