from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any

from app.schemas.user import UserUpdateRequest
from app.schemas.auth import UserProfileResponse
from app.schemas.booking import BookingResponse
from app.repositories.user_repo import user_repo
from app.repositories.booking_repo import booking_repo
from app.repositories.credential_repo import credential_repo
from app.repositories.resource_repo import resource_repo
from app.core.deps import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.patch("/me", response_model=UserProfileResponse)
async def update_profile(req: UserUpdateRequest, current_user: dict = Depends(get_current_user)):
    updates = {}
    if req.full_name is not None:
        updates["full_name"] = req.full_name
    if req.dob is not None:
        updates["dob"] = req.dob
    if req.department is not None:
        updates["department"] = req.department
    if req.academic_role is not None:
        updates["academic_role"] = req.academic_role

    updated = await user_repo.update(current_user["id"], updates)
    user_creds = await credential_repo.list_by_user(current_user["id"])
    approved_creds = [c["credential_name"] for c in user_creds if c.get("status") == "approved"]

    return UserProfileResponse(
        id=updated["id"],
        email=updated["email"],
        username=updated["username"],
        full_name=updated["full_name"],
        dob=updated["dob"],
        academic_role=updated.get("academic_role", "Student"),
        department=updated.get("department", ""),
        system_role=updated.get("system_role", "user"),
        id_document_path=updated.get("id_document_path"),
        is_verified=updated.get("is_verified", False),
        credentials=approved_creds
    )

@router.get("/me/bookings")
async def get_my_bookings(current_user: dict = Depends(get_current_user)):
    bookings = await booking_repo.list_by_user(current_user["id"])
    results = []
    for b in bookings:
        res = await resource_repo.get_by_id(b["resource_id"])
        results.append({
            "id": b["id"],
            "resourceId": b["resource_id"],
            "resource_name": res.get("name") if res else "Equipment",
            "applicant": {
                "name": current_user["full_name"],
                "role": current_user.get("academic_role", "Student"),
                "department": current_user.get("department", ""),
                "email": current_user["email"]
            },
            "isMine": True,
            "startDate": b["start_date"][:10],
            "endDate": b["end_date"][:10],
            "purpose": b["purpose"],
            "status": b["status"],
            "proofFiles": b.get("proof_files", []),
            "rejectionReason": b.get("rejection_reason"),
            "userSignature": "signed" if b.get("checked_in_at") or b.get("status") in ["signed", "active", "returned", "completed"] else None,
            "ownerSignature": "signed" if b.get("status") in ["signed", "active", "returned", "completed"] else None,
            "otp": b.get("checkin_otp"),
            "ownerVerified": b.get("owner_verified", False)
        })
    return results

@router.get("/me/credentials")
async def get_my_credentials(current_user: dict = Depends(get_current_user)):
    return await credential_repo.list_by_user(current_user["id"])

