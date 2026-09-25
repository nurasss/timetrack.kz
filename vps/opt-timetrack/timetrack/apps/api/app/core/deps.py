from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.rbac import ADMIN_ROLES, EMPLOYEE_ROLES, HR_ROLES, MANAGER_ROLES
from app.core.security import decode_token
from app.models import AuthSession, Company, CompanyStatus, Role, User
from app.services.rbac import has_permission

bearer = HTTPBearer(auto_error=False)


def _token_version(payload: dict) -> int:
    try:
        value = int(payload.get("ver", payload.get("token_version")))
        legacy_value = int(payload["token_version"]) if "token_version" in payload else value
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid token") from exc
    if value != legacy_value or value < 0:
        raise ValueError("Invalid token")
    return value


def _token_company_id(payload: dict) -> UUID | None:
    value = payload.get("company_id")
    if value is None:
        return None
    try:
        return UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid token") from exc


async def _authenticate_access_token(
    credentials: HTTPAuthorizationCredentials | None,
    session: AsyncSession,
    *,
    require_verified: bool,
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
        user_id = UUID(str(payload["sub"]))
        session_id = UUID(str(payload.get("sid") or payload["jti"]))
        token_version = _token_version(payload)
        token_company_id = _token_company_id(payload)
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    auth_session = await session.scalar(
        select(AuthSession).where(AuthSession.jti == session_id)
    )
    if not auth_session or auth_session.revoked_at is not None or auth_session.rotated_to_jti is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if auth_session.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if auth_session.user_id != user.id or auth_session.token_version != token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if int(user.token_version or 0) != token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if auth_session.company_id != user.company_id or token_company_id != user.company_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    if require_verified and user.email_verified_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email is not verified")

    if user.company_id is None:
        if user.role != Role.SUPER_ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no company")
    else:
        company = await session.get(Company, user.company_id)
        if not company or company.status not in {CompanyStatus.ACTIVE, CompanyStatus.TRIAL}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company is not active")
    return user


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    return await _authenticate_access_token(credentials, session, require_verified=True)


async def current_user_allow_unverified(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    return await _authenticate_access_token(credentials, session, require_verified=False)


def require_roles(*roles: Role):
    allowed_roles = frozenset(roles) | {Role.SUPER_ADMIN}

    async def dependency(user: User = Depends(current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency


def require_permission(permission: str):
    async def dependency(user: User = Depends(current_user)) -> User:
        if not has_permission(user.role, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency


def require_admin_only(user: User = Depends(current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


def require_hr(user: User = Depends(current_user)) -> User:
    if user.role not in HR_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


def require_manager(user: User = Depends(current_user)) -> User:
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


def require_employee(user: User = Depends(current_user)) -> User:
    if user.role != Role.EMPLOYEE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


def require_employee_or_above(user: User = Depends(current_user)) -> User:
    if user.role not in EMPLOYEE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


require_admin = require_admin_only
require_hr_only = require_hr
require_manager_only = require_manager


def company_scope(user: User) -> UUID:
    if user.role == Role.SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="SUPER_ADMIN must select a company")
    if not user.company_id:
        raise HTTPException(status_code=403, detail="User has no company")
    return user.company_id


async def ensure_company_user(session: AsyncSession, user_id: UUID, company_id: UUID) -> User:
    user = await session.scalar(select(User).where(User.id == user_id, User.company_id == company_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
