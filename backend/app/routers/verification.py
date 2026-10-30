from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import List, Optional, Dict, Any
import uuid

from app.repositories.credential_repo import credential_repo
from app.repositories.user_repo import user_repo
from app.repositories.notification_repo import notification_repo
from app.services.ai import ai_service
from app.core.deps import get_current_user, require_owner

router = APIRouter(prefix="/verification", tags=["AI Verification"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    credential_name: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")

    file_ext = file.filename.split(".")[-1] if file.filename else "pdf"
    doc_id = str(uuid.uuid4())
    doc_path = f"verification-docs/{doc_id}.{file_ext}"

    # Create credential record
    cred_data = {
        "id": doc_id,
        "user_id": current_user["id"],
        "credential_name": credential_name,
        "document_path": doc_path,
        "status": "analyzing"
    }
    created = await credential_repo.create(cred_data)

    # Trigger AI analysis
    ai_result = await ai_service.verify_certificate(
        document_bytes=content,
        file_mime=file.content_type or "application/pdf",
        user_full_name=current_user["full_name"],
        required_criterion=credential_name
    )

    # Determine status
    if ai_result.confidence >= 0.85 and ai_result.matches_requirement and ai_result.name_match and not ai_result.expired:
        new_status = "ai_verified_pending_review"
    else:
        new_status = "ai_verified_pending_review" # Routed to owner review queue

    updated = await credential_repo.update(doc_id, {
        "issuing_body": ai_result.issuing_body,
        "issue_date": ai_result.issue_date,
        "expiry_date": ai_result.expiry_date,
        "status": new_status,
        "ai_analysis": ai_result.model_dump()
    })

    return {
        "id": doc_id,
        "credential_name": credential_name,
        "status": new_status,
        "ai_analysis": ai_result.model_dump()
    }

@router.post("/{doc_id}/analyze")
async def analyze_document(
    doc_id: str,
    required_criterion: str,
    current_user: dict = Depends(get_current_user)
):
    cred = await credential_repo.get_by_id(doc_id)
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    # In production, read document from Supabase storage; for mock, generate verification result
    dummy_bytes = b"%PDF-1.4 Mock verification content"
    ai_result = await ai_service.verify_certificate(
        document_bytes=dummy_bytes,
        file_mime="application/pdf",
        user_full_name=current_user["full_name"],
        required_criterion=required_criterion
    )

    await credential_repo.update(doc_id, {
        "status": "ai_verified_pending_review",
        "ai_analysis": ai_result.model_dump()
    })

    return ai_result.model_dump()

@router.get("/review-queue")
async def get_review_queue(current_user: dict = Depends(require_owner)):
    pending = await credential_repo.list_pending_review()
    results = []
    for p in pending:
        u = await user_repo.get_by_id(p["user_id"])
        results.append({
            "id": p["id"],
            "credential_name": p["credential_name"],
            "applicant_name": u.get("full_name") if u else "Applicant",
            "department": u.get("department") if u else "",
            "document_path": p["document_path"],
            "status": p["status"],
            "ai_analysis": p.get("ai_analysis")
        })
    return results

@router.post("/{doc_id}/confirm")
async def confirm_credential(
    doc_id: str,
    approved: bool,
    rejection_reason: Optional[str] = None,
    current_user: dict = Depends(require_owner)
):
    cred = await credential_repo.get_by_id(doc_id)
    if not cred:
        raise HTTPException(status_code=404, detail="Credential record not found")

    new_status = "approved" if approved else "rejected"
    updated = await credential_repo.update(doc_id, {
        "status": new_status,
        "reviewed_by": current_user["id"],
        "rejection_reason": rejection_reason
    })

    # Notify applicant safely
    try:
        await notification_repo.create({
            "user_id": cred["user_id"],
            "type": "credential_reviewed",
            "title": f"Credential {new_status.title()}",
            "message": f"Your certificate '{cred['credential_name']}' was {new_status} by the facility reviewer.",
            "data": {"credential_id": doc_id, "status": new_status}
        })
    except Exception as e:
        pass

    return updated

