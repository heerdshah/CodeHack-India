from pydantic import BaseModel, Field
from typing import List, Optional

class CertificateVerificationResult(BaseModel):
    holder_name: Optional[str] = Field(None, description="Name of the person to whom certificate was issued")
    certificate_title: Optional[str] = Field(None, description="Title or name of the certification")
    issuing_body: Optional[str] = Field(None, description="Organization or department that issued certificate")
    issue_date: Optional[str] = Field(None, description="Date of issuance YYYY-MM-DD or string")
    expiry_date: Optional[str] = Field(None, description="Expiry date YYYY-MM-DD if applicable")
    matches_requirement: bool = Field(False, description="Whether certificate matches the required qualification")
    name_match: bool = Field(False, description="Whether certificate holder matches applicant name")
    expired: bool = Field(False, description="Whether the certificate is expired")
    authenticity_concerns: bool = Field(False, description="Any signs of alteration, forgery or inconsistency")
    confidence: float = Field(0.0, description="Confidence score between 0.0 and 1.0")
    reasons: List[str] = Field(default_factory=list, description="Explanations for the verification decision")

class PhotoQualityAssessment(BaseModel):
    quality_ok: bool = Field(True, description="Whether photo is clear and correctly angled")
    is_blurry: bool = Field(False, description="Whether photo is blurry or out of focus")
    correct_angle: bool = Field(True, description="Whether photo captures the specified perspective")
    correct_object: bool = Field(True, description="Whether the photo shows the specified equipment/space")
    notes: Optional[str] = Field(None, description="Guidance or retake instructions if quality_ok is false")

class AngleDamageComparison(BaseModel):
    angle: str = Field(..., description="Angle evaluated: Front, Back, Left, Right, Top, Bottom")
    changed: bool = Field(False, description="Whether differences or new wear/damage are observed")
    description: str = Field("No significant changes observed.", description="Detailed observations")
    severity: str = Field("none", description="none, low, medium, high, critical")
    confidence: float = Field(0.0, description="Confidence score between 0.0 and 1.0")
    retake_needed: bool = Field(False, description="True if one of the images is too blurry to compare")

class IncidentSummaryResult(BaseModel):
    title: str = Field(..., description="Concise title for incident")
    ai_summary: str = Field(..., description="Objective, professional summary of reported damage/incident")
    severity_assessment: str = Field("medium", description="low, medium, high, critical")
    suggested_actions: List[str] = Field(default_factory=list, description="Recommendations for the resource owner")

class AgreementClausesResult(BaseModel):
    tailored_clauses: List[str] = Field(default_factory=list, description="Specific terms tailored to resource rules")
    risk_notes: Optional[str] = Field(None, description="Notes on high-risk aspects of the booking")

