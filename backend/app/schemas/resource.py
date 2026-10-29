from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ResourceCreateRequest(BaseModel):
    id: str
    name: str
    department: str
    category: str
    location: str
    building: Optional[str] = None
    floor: Optional[str] = None
    latitude: float
    longitude: float
    image: str
    description: str
    condition: str
    criteria: List[str] = []
    rules: List[str] = []
    approval_mode: str = "manual"
    opening_hours: Optional[Dict[str, Any]] = None
    max_active_bookings_per_user: int = 2
    max_hours_per_week_per_user: int = 20
    cooldown_hours_after_booking: int = 4

class ResourceUpdateRequest(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image: Optional[str] = None
    description: Optional[str] = None
    condition: Optional[str] = None
    criteria: Optional[List[str]] = None
    rules: Optional[List[str]] = None
    approval_mode: Optional[str] = None
    opening_hours: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class ResourceResponse(BaseModel):
    id: str
    name: str
    department: str
    category: str
    owner_id: str
    owner_name: Optional[str] = None
    location: str
    building: Optional[str] = None
    floor: Optional[str] = None
    latitude: float
    longitude: float
    image: str
    description: str
    condition: str
    criteria: List[str]
    rules: List[str] = []
    approval_mode: str
    opening_hours: Optional[Dict[str, Any]] = None
    bookedUntil: Optional[str] = None
    queue: int = 0
    distance_km: Optional[float] = None
    is_active: bool = True

