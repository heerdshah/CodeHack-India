from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class BookingCreateRequest(BaseModel):
    resource_id: str
    start_date: str # ISO string
    end_date: str # ISO string
    purpose: str
    proof_files: List[str] = []

class BookingStatusUpdateRequest(BaseModel):
    status: str
    rejection_reason: Optional[str] = None

class BookingCheckinRequest(BaseModel):
    otp: str

class BookingSignRequest(BaseModel):
    signer_role: Optional[str] = None # Deprecated/ignored: role is derived from authenticated session
    signature_data: str # Base64 or string
    document_hash: str # SHA-256

class ApplicantInfo(BaseModel):
    name: str
    role: str
    department: str
    email: str

class BookingResponse(BaseModel):
    id: str
    resourceId: str
    resource_name: Optional[str] = None
    applicant: ApplicantInfo
    isMine: bool
    startDate: str
    endDate: str
    purpose: str
    status: str
    proofFiles: List[str] = []
    rejectionReason: Optional[str] = None
    userSignature: Optional[str] = None
    ownerSignature: Optional[str] = None
    otp: Optional[str] = None
    ownerVerified: bool = False
    pre: Optional[Dict[str, Any]] = None
    post: Optional[Dict[str, Any]] = None

