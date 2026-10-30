from fastapi import APIRouter, HTTPException, status, Response, Request, Depends
from typing import Dict, Any
from datetime import datetime, timezone

from app.schemas.auth import RegisterRequest, LoginRequest, UserProfileResponse
from app.repositories.user_repo import user_repo
from app.repositories.credential_repo import credential_repo
from app.repositories.audit_repo import audit_repo
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.core.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory rate limiting tracker: ip -> [timestamps]
_login_attempts: Dict[str, list] = {}

def check_login_rate_limit(ip: str):
    now = datetime.now(timezone.utc).timestamp()
    attempts = [t for t in _login_attempts.get(ip, []) if now - t < 60]
    _login_attempts[ip] = attempts
    if len(attempts) >= 10:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 1 minute before trying again."
        )

@router.post("/register", response_model=UserProfileResponse)
async def register(req: RegisterRequest, response: Response, request: Request):
    # Check duplicate email
    existing_email = await user_repo.get_by_email(req.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this institutional email already exists."
        )

    # Check duplicate username
    existing_username = await user_repo.get_by_username(req.username)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This username is already taken. Please choose another."
        )

    user_dict = {
        "email": req.email,
        "username": req.username,
        "password_hash": get_password_hash(req.password),
        "full_name": req.full_name,
        "dob": req.dob,
        "academic_role": req.academic_role,
        "department": req.department,
        "system_role": "user",
        "id_document_path": req.id_document_path,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    created_user = await user_repo.create(user_dict)

    # Issue JWT token in httpOnly cookie
    token = create_access_token(data={"sub": created_user["id"], "role": created_user["system_role"]})
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False, # Set to True in production HTTPS
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    # Audit log
    await audit_repo.log(
        actor_id=created_user["id"],
        actor_role="user",
        action="user.register",
        entity_type="user",
        entity_id=created_user["id"],
        after_state={"email": req.email, "username": req.username},
        ip_address=request.client.host if request.client else "127.0.0.1"
    )

    return UserProfileResponse(
        id=created_user["id"],
        email=created_user["email"],
        username=created_user["username"],
        full_name=created_user["full_name"],
        dob=created_user["dob"],
        academic_role=created_user["academic_role"],
        department=created_user["department"],
        system_role=created_user["system_role"],
        id_document_path=created_user.get("id_document_path"),
        is_verified=created_user.get("is_verified", False),
        credentials=[]
    )

@router.post("/login", response_model=UserProfileResponse)
async def login(req: LoginRequest, response: Response, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_login_rate_limit(client_ip)

    # Allow login by email or username
    user = await user_repo.get_by_email(req.identifier)
    if not user:
        user = await user_repo.get_by_username(req.identifier)

    if not user or not verify_password(req.password, user.get("password_hash", "")):
        _login_attempts.setdefault(client_ip, []).append(datetime.now(timezone.utc).timestamp())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password."
        )

    # Reset failed attempts on success
    if client_ip in _login_attempts:
        _login_attempts[client_ip] = []

    # Issue JWT token
    token = create_access_token(data={"sub": user["id"], "role": user.get("system_role", "user")})
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    # Fetch user's approved credentials
    user_creds = await credential_repo.list_by_user(user["id"])
    approved_creds = [c["credential_name"] for c in user_creds if c.get("status") == "approved"]

    # Audit log
    await audit_repo.log(
        actor_id=user["id"],
        actor_role=user.get("system_role", "user"),
        action="user.login",
        entity_type="user",
        entity_id=user["id"],
        ip_address=client_ip
    )

    return UserProfileResponse(
        id=user["id"],
        email=user["email"],
        username=user["username"],
        full_name=user["full_name"],
        dob=user["dob"],
        academic_role=user.get("academic_role", "Student"),
        department=user.get("department", ""),
        system_role=user.get("system_role", "user"),
        id_document_path=user.get("id_document_path"),
        is_verified=user.get("is_verified", False),
        credentials=approved_creds
    )

@router.post("/logout")
async def logout(response: Response, request: Request, current_user: dict = Depends(get_current_user)):
    response.delete_cookie(key=settings.COOKIE_NAME)
    await audit_repo.log(
        actor_id=current_user["id"],
        actor_role=current_user.get("system_role", "user"),
        action="user.logout",
        entity_type="user",
        entity_id=current_user["id"],
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    return {"message": "Logged out successfully."}

@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user_creds = await credential_repo.list_by_user(current_user["id"])
    approved_creds = [c["credential_name"] for c in user_creds if c.get("status") == "approved"]

    return UserProfileResponse(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user["username"],
        full_name=current_user["full_name"],
        dob=current_user["dob"],
        academic_role=current_user.get("academic_role", "Student"),
        department=current_user.get("department", ""),
        system_role=current_user.get("system_role", "user"),
        id_document_path=current_user.get("id_document_path"),
        is_verified=current_user.get("is_verified", False),
        credentials=approved_creds
    )

