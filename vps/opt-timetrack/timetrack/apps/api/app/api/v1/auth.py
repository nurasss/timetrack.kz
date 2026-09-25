from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import bearer, current_user
from app.core.rate_limit import enforce_rate_limit
from app.models import Company, User
from app.schemas.auth import (
    AuthUser,
    EmailVerificationResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RegisterCompanyRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenRefreshRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services.auth_service import (
    login,
    logout_session,
    refresh_session,
    register_company,
    request_password_reset,
    resend_verification_code,
    verify_email,
)
from app.services.auth_service import (
    reset_password as reset_password_service,
)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login_route(
    payload: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    await enforce_rate_limit("login", request, payload.email)
    return await login(
        session,
        payload.email,
        payload.password,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: TokenRefreshRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    return await refresh_session(
        session,
        payload.refresh_token,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )


@router.post("/logout")
async def logout(
    payload: LogoutRequest | None = Body(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
):
    refresh_token = payload.refresh_token if payload else None
    access_token = credentials.credentials if credentials else None
    if not refresh_token and not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    await logout_session(
        session,
        refresh_token=refresh_token,
        access_token=access_token,
    )
    return {"ok": True}


@router.get("/me", response_model=AuthUser)
async def me(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    company_name = None
    if user.company_id:
        company = await session.get(Company, user.company_id)
        company_name = company.name if company else None
    return AuthUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        company_id=user.company_id,
        company_name=company_name,
    )


@router.post("/register-company", response_model=EmailVerificationResponse)
async def register(
    payload: RegisterCompanyRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    await enforce_rate_limit("register", request, payload.email)
    return await register_company(
        session,
        payload,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email_route(
    payload: VerifyEmailRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    await enforce_rate_limit("verify", request, payload.email)
    return await verify_email(session, payload.email, payload.code)


@router.post("/resend-verification", response_model=EmailVerificationResponse)
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    await enforce_rate_limit("resend", request, payload.email)
    return await resend_verification_code(
        session,
        payload.email,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    await enforce_rate_limit("forgot", request, payload.email)
    return await request_password_reset(
        session,
        payload.email,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    await enforce_rate_limit("reset", request, payload.email)
    return await reset_password_service(session, payload.email, payload.code, payload.password)
