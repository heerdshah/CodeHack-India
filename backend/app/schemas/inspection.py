from pydantic import BaseModel
from typing import Dict, List, Optional, Any

class InspectionSubmitRequest(BaseModel):
    booking_id: str
    phase: str # 'pre' or 'post'
    photos: Dict[str, str] # { 'Front': base64_or_path, ... }

class StandaloneIncidentCreateRequest(BaseModel):
    resource_id: str
    booking_id: Optional[str] = None
    angle: Optional[str] = None
    title: str
    description: str
    photos: List[str] = []

class IncidentReviewRequest(BaseModel):
    status: str # 'confirmed', 'dismissed', 'resolved'
    review_notes: str

