from fastapi import Request, HTTPException, status, Depends
from typing import Optional, List
from app.core.config import settings
from app.core.security import decode_access_token
from app.repositories.user_repo import user_repo

async def get_token_from_request(request: Request) -> Optional[str]:
    # Check httpOnly cookie first
    token = request.cookies.get(settings.COOKIE_NAME)
    if token:
        return token
    # Fallback to Authorization: Bearer <token>
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return None

async def get_current_user(request: Request):
    token = await get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in."
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token."
        )
    user_id = payload["sub"]
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists."
        )
    return user

async def get_optional_user(request: Request):
    token = await get_token_from_request(request)
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    return await user_repo.get_by_id(payload["sub"])

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("system_role", "user")
        if user_role not in allowed_roles and user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)} (current: {user_role})"
            )
        return current_user
    return role_checker

require_user = require_roles(["user", "owner", "manager", "admin"])
require_owner = require_roles(["owner", "manager", "admin"])
require_manager = require_roles(["manager", "admin"])
require_admin = require_roles(["admin"])

