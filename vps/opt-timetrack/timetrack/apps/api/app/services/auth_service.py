import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    secure_compare,
    verify_password,
)
from app.models import AuthSession, Company, CompanyStatus, EmailVerificationCode, Role, User
from app.schemas.auth import AuthUser, EmailVerificationResponse, RegisterCompanyRequest, TokenResponse
from app.services.audit_service import write_audit
from app.services.email_service import send_password_reset_code, send_verification_code

MAX_CODE_ATTEMPTS = 5
EMAIL_VERIFICATION_PURPOSE = "email_verification"
PASSWORD_RESET_PURPOSE = "password_reset"
INVALID_CREDENTIALS = "Invalid email or password"
INVALID_VERIFICATION_CODE = "Invalid verification code"
INVALID_RESET_CODE = "Invalid reset code"
NEUTRAL_VERIFICATION_MESSAGE = "If the account exists, verification instructions were sent"
NEUTRAL_RESET_MESSAGE = "If the account exists, reset instructions were sent"
_DUMMY_PASSWORD_HASH = hash_password("timetrack-invalid-password")


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _invalid_credentials() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)


def _invalid_verification() -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_VERIFICATION_CODE)


def _invalid_reset() -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_RESET_CODE)


def _invalid_refresh() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")


def _company_is_usable(company: Company | None) -> bool:
    return company is not None and company.status in {CompanyStatus.ACTIVE, CompanyStatus.TRIAL}


async def _validate_user_for_auth(session: AsyncSession, user: User, *, require_verified: bool = True) -> Company | None:
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    if require_verified and user.email_verified_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email is not verified")
    if user.company_id is None:
        if user.role != Role.SUPER_ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no company")
        return None
    company = await session.get(Company, user.company_id)
    if not _company_is_usable(company):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company is not active")
    return company


async def _revoke_after_refresh_failure(session: AsyncSession, user_id: UUID, reason: str) -> None:
    await revoke_user_sessions(session, user_id, reason=reason)
    await session.commit()


async def build_token_response(
    session: AsyncSession,
    user: User,
    ip: str | None = None,
    user_agent: str | None = None,
    session_jti: UUID | None = None,
) -> TokenResponse:
    company = await _validate_user_for_auth(session, user)
    token_version = int(user.token_version or 0)
    jti = session_jti or uuid4()
    now = _utcnow()
    refresh_expires = now + timedelta(days=settings.jwt_refresh_token_expire_days)
    refresh = create_token(
        user.id,
        "refresh",
        refresh_expires - now,
        company_id=user.company_id,
        token_version=token_version,
        jti=jti,
        session_id=jti,
    )
    access = create_token(
        user.id,
        "access",
        timedelta(minutes=settings.jwt_access_token_expire_minutes),
        company_id=user.company_id,
        token_version=token_version,
        jti=jti,
        session_id=jti,
    )
    session.add(
        AuthSession(
            id=jti,
            jti=jti,
            user_id=user.id,
            company_id=user.company_id,
            token_hash=hash_refresh_token(refresh),
            token_version=token_version,
            expires_at=refresh_expires,
            created_at=now,
            ip_address=ip,
            user_agent=user_agent,
        )
    )
    await session.flush()
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=AuthUser(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            company_id=user.company_id,
            company_name=company.name if company else None,
        ),
    )


async def login(
    session: AsyncSession,
    email: str,
    password: str,
    ip: str | None,
    user_agent: str | None,
) -> TokenResponse:
    normalized_email = _normalize_email(email)
    user = await session.scalar(select(User).where(User.email == normalized_email))
    password_hash = user.password_hash if user else _DUMMY_PASSWORD_HASH
    password_valid = verify_password(password, password_hash)
    if not user or not password_valid:
        raise _invalid_credentials()
    try:
        await _validate_user_for_auth(session, user)
    except HTTPException as exc:
        raise _invalid_credentials() from exc
    user.last_login_at = _utcnow()
    await write_audit(
        session,
        action="login",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        company_id=user.company_id,
        ip_address=ip,
        user_agent=user_agent,
    )
    response = await build_token_response(session, user, ip, user_agent)
    await session.commit()
    return response


async def register_company(
    session: AsyncSession,
    payload: RegisterCompanyRequest,
    ip: str | None = None,
    user_agent: str | None = None,
) -> EmailVerificationResponse:
    normalized_email = _normalize_email(payload.email)
    existing = await session.scalar(select(User).where(User.email == normalized_email))
    if existing:
        return _neutral_verification_response(normalized_email)

    company = Company(
        name=payload.company_name,
        bin=payload.bin,
        email=normalized_email,
        phone=payload.phone,
        status=CompanyStatus.TRIAL,
        settings={
            "language": "ru",
            "timezone": settings.default_timezone,
            "require_photo_on_mark": True,
            "require_geolocation": True,
            "allow_offline_marks": True,
            "late_tolerance_minutes": 10,
            "photo_retention_days": 90,
            "mark_editing_enabled": False,
        },
    )
    session.add(company)
    await session.flush()
    user = User(
        company_id=company.id,
        email=normalized_email,
        phone=payload.phone,
        full_name=payload.full_name,
        role=Role.COMPANY_ADMIN,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    session.add(user)
    await write_audit(
        session,
        action="register_company",
        entity_type="company",
        company_id=company.id,
        user_id=user.id,
    )
    try:
        await issue_email_verification_code(session, user, ip, user_agent)
        await session.commit()
    except HTTPException:
        await session.rollback()
    return _neutral_verification_response(normalized_email)


async def resend_verification_code(
    session: AsyncSession,
    email: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> EmailVerificationResponse:
    normalized_email = _normalize_email(email)
    user = await session.scalar(select(User).where(User.email == normalized_email))
    if not user or user.email_verified_at is not None or not user.is_active:
        return _neutral_verification_response(normalized_email)
    try:
        await issue_email_verification_code(session, user, ip, user_agent)
        await session.commit()
    except HTTPException:
        await session.rollback()
    return _neutral_verification_response(normalized_email)


async def verify_email(session: AsyncSession, email: str, code: str) -> TokenResponse:
    normalized_email = _normalize_email(email)
    user = await session.scalar(select(User).where(User.email == normalized_email).with_for_update())
    if not user or user.email_verified_at is not None or not user.is_active:
        raise _invalid_verification()
    try:
        await _validate_user_for_auth(session, user, require_verified=False)
    except HTTPException as exc:
        raise _invalid_verification() from exc

    now = _utcnow()
    verification = await session.scalar(
        select(EmailVerificationCode)
        .where(
            EmailVerificationCode.user_id == user.id,
            EmailVerificationCode.email == normalized_email,
            EmailVerificationCode.purpose == EMAIL_VERIFICATION_PURPOSE,
            EmailVerificationCode.consumed_at.is_(None),
        )
        .order_by(EmailVerificationCode.created_at.desc(), EmailVerificationCode.id.desc())
        .with_for_update()
    )
    if not verification or verification.expires_at <= now or verification.attempts >= MAX_CODE_ATTEMPTS:
        if verification and verification.attempts >= MAX_CODE_ATTEMPTS:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many verification attempts")
        raise _invalid_verification()

    code_matches = secure_compare(verification.code_hash, hash_verification_code(code))
    result = await session.execute(
        update(EmailVerificationCode)
        .where(
            EmailVerificationCode.id == verification.id,
            EmailVerificationCode.consumed_at.is_(None),
            EmailVerificationCode.attempts < MAX_CODE_ATTEMPTS,
        )
        .values(
            attempts=EmailVerificationCode.attempts + 1,
            consumed_at=now if code_matches else None,
        )
    )
    if getattr(result, "rowcount", 1) != 1:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many verification attempts")
    if not code_matches:
        await session.commit()
        raise _invalid_verification()

    user.email_verified_at = now
    await write_audit(
        session,
        action="verify_email",
        entity_type="user",
        entity_id=user.id,
        company_id=user.company_id,
        user_id=user.id,
    )
    try:
        response = await build_token_response(session, user)
    except HTTPException as exc:
        await session.rollback()
        raise _invalid_verification() from exc
    await session.commit()
    return response


async def request_password_reset(
    session: AsyncSession,
    email: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict[str, str | bool]:
    normalized_email = _normalize_email(email)
    user = await session.scalar(select(User).where(User.email == normalized_email))
    neutral = {"ok": True, "message": NEUTRAL_RESET_MESSAGE}
    if not user:
        return neutral
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = _utcnow()
    try:
        email_sent = await send_password_reset_code(user.email, code)
    except Exception:
        await session.rollback()
        return neutral
    if not email_sent:
        await session.rollback()
        return neutral

    await session.execute(
        update(EmailVerificationCode)
        .where(
            EmailVerificationCode.user_id == user.id,
            EmailVerificationCode.purpose == PASSWORD_RESET_PURPOSE,
            EmailVerificationCode.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )
    session.add(
        EmailVerificationCode(
            user_id=user.id,
            email=user.email.lower(),
            code_hash=hash_verification_code(code),
            purpose=PASSWORD_RESET_PURPOSE,
            expires_at=now + timedelta(minutes=settings.email_code_ttl_minutes),
            ip_address=ip,
            user_agent=user_agent,
        )
    )
    await session.commit()
    return neutral


async def reset_password(session: AsyncSession, email: str, code: str, password: str) -> dict[str, bool]:
    normalized_email = _normalize_email(email)
    user = await session.scalar(select(User).where(User.email == normalized_email).with_for_update())
    if not user:
        raise _invalid_reset()

    now = _utcnow()
    reset_code = await session.scalar(
        select(EmailVerificationCode)
        .where(
            EmailVerificationCode.user_id == user.id,
            EmailVerificationCode.email == normalized_email,
            EmailVerificationCode.purpose == PASSWORD_RESET_PURPOSE,
            EmailVerificationCode.consumed_at.is_(None),
        )
        .order_by(EmailVerificationCode.created_at.desc(), EmailVerificationCode.id.desc())
        .with_for_update()
    )
    if not reset_code or reset_code.expires_at <= now or reset_code.attempts >= MAX_CODE_ATTEMPTS:
        if reset_code and reset_code.attempts >= MAX_CODE_ATTEMPTS:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many reset attempts")
        raise _invalid_reset()

    code_matches = secure_compare(reset_code.code_hash, hash_verification_code(code))
    result = await session.execute(
        update(EmailVerificationCode)
        .where(
            EmailVerificationCode.id == reset_code.id,
            EmailVerificationCode.consumed_at.is_(None),
            EmailVerificationCode.attempts < MAX_CODE_ATTEMPTS,
        )
        .values(
            attempts=EmailVerificationCode.attempts + 1,
            consumed_at=now if code_matches else None,
        )
    )
    if getattr(result, "rowcount", 1) != 1:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many reset attempts")
    if not code_matches:
        await session.commit()
        raise _invalid_reset()

    user.password_hash = hash_password(password)
    user.token_version = int(user.token_version or 0) + 1
    await revoke_user_sessions(session, user.id, reason="password_reset")
    await write_audit(
        session,
        action="reset_password",
        entity_type="user",
        entity_id=user.id,
        company_id=user.company_id,
        user_id=user.id,
    )
    await session.commit()
    return {"ok": True}


async def issue_email_verification_code(
    session: AsyncSession,
    user: User,
    ip: str | None = None,
    user_agent: str | None = None,
) -> EmailVerificationResponse:
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = _utcnow()
    expires_at = now + timedelta(minutes=settings.email_code_ttl_minutes)
    try:
        email_sent = await send_verification_code(user.email, code)
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=503, detail="Unable to send verification email") from exc
    if not email_sent:
        await session.rollback()
        raise HTTPException(status_code=503, detail="SMTP is not configured")

    await session.execute(
        update(EmailVerificationCode)
        .where(
            EmailVerificationCode.user_id == user.id,
            EmailVerificationCode.purpose == EMAIL_VERIFICATION_PURPOSE,
            EmailVerificationCode.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )
    session.add(
        EmailVerificationCode(
            user_id=user.id,
            email=user.email.lower(),
            code_hash=hash_verification_code(code),
            purpose=EMAIL_VERIFICATION_PURPOSE,
            expires_at=expires_at,
            ip_address=ip,
            user_agent=user_agent,
        )
    )
    await session.flush()
    return _neutral_verification_response(user.email)


async def refresh_session(
    session: AsyncSession,
    refresh_token: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> TokenResponse:
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
        token_user_id = UUID(str(payload["sub"]))
        jti = UUID(str(payload["jti"]))
        token_session_id = UUID(str(payload.get("sid") or jti))
    except (KeyError, TypeError, ValueError) as exc:
        raise _invalid_refresh() from exc
    if token_session_id != jti:
        raise _invalid_refresh()

    try:
        user = await session.scalar(select(User).where(User.id == token_user_id).with_for_update())
    except Exception as exc:
        raise _invalid_refresh() from exc
    if not user:
        raise _invalid_refresh()

    auth_session = await session.scalar(
        select(AuthSession).where(AuthSession.jti == jti).with_for_update()
    )
    if not auth_session:
        raise _invalid_refresh()
    if auth_session.user_id != user.id:
        await _revoke_after_refresh_failure(session, user.id, "refresh_reuse")
        raise _invalid_refresh()
    if not secure_compare(auth_session.token_hash, hash_refresh_token(refresh_token)):
        await _revoke_after_refresh_failure(session, user.id, "refresh_reuse")
        raise _invalid_refresh()
    if auth_session.rotated_to_jti is not None or auth_session.revoked_reason == "rotated":
        await _revoke_after_refresh_failure(session, user.id, "refresh_reuse")
        raise _invalid_refresh()
    if auth_session.revoked_at is not None:
        raise _invalid_refresh()

    now = _utcnow()
    if auth_session.expires_at <= now:
        await _revoke_after_refresh_failure(session, user.id, "expired")
        raise _invalid_refresh()

    try:
        token_version = int(payload.get("ver", payload.get("token_version")))
        legacy_token_version = int(payload["token_version"]) if "token_version" in payload else token_version
    except (TypeError, ValueError) as exc:
        await _revoke_after_refresh_failure(session, user.id, "refresh_reuse")
        raise _invalid_refresh() from exc
    if token_version != legacy_token_version:
        await _revoke_after_refresh_failure(session, user.id, "refresh_reuse")
        raise _invalid_refresh()
    if token_version != int(user.token_version or 0) or token_version != int(auth_session.token_version):
        await _revoke_after_refresh_failure(session, auth_session.user_id, "refresh_reuse")
        raise _invalid_refresh()
    if auth_session.company_id != user.company_id:
        await _revoke_after_refresh_failure(session, auth_session.user_id, "refresh_reuse")
        raise _invalid_refresh()
    if payload.get("company_id") is not None:
        try:
            if UUID(str(payload["company_id"])) != user.company_id:
                raise _invalid_refresh()
        except (TypeError, ValueError) as exc:
            raise _invalid_refresh() from exc
    elif user.company_id is not None:
        await _revoke_after_refresh_failure(session, auth_session.user_id, "refresh_reuse")
        raise _invalid_refresh()

    try:
        await _validate_user_for_auth(session, user)
    except HTTPException as exc:
        await _revoke_after_refresh_failure(session, auth_session.user_id, "account_state")
        raise _invalid_refresh() from exc

    new_jti = uuid4()
    try:
        response = await build_token_response(session, user, ip, user_agent, session_jti=new_jti)
    except HTTPException as exc:
        await session.rollback()
        raise _invalid_refresh() from exc
    auth_session.last_used_at = now
    auth_session.revoked_at = now
    auth_session.revoked_reason = "rotated"
    auth_session.rotated_to_jti = new_jti
    await session.commit()
    return response


async def refresh(
    session: AsyncSession,
    refresh_token: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> TokenResponse:
    return await refresh_session(session, refresh_token, ip, user_agent)


async def logout_session(
    session: AsyncSession,
    *,
    refresh_token: str | None = None,
    access_token: str | None = None,
) -> int:
    jtis: set[UUID] = set()
    if refresh_token:
        try:
            payload = decode_token(refresh_token, expected_type="refresh")
            jtis.add(UUID(str(payload["jti"])))
        except (KeyError, TypeError, ValueError):
            pass
    if access_token:
        try:
            payload = decode_token(access_token, expected_type="access")
            session_id = payload.get("sid") or payload.get("jti")
            if session_id:
                jtis.add(UUID(str(session_id)))
        except (KeyError, TypeError, ValueError):
            pass
    if not jtis:
        return 0
    auth_sessions = (
        await session.scalars(select(AuthSession).where(AuthSession.jti.in_(jtis)).with_for_update())
    ).all()
    now = _utcnow()
    for auth_session in auth_sessions:
        if auth_session.revoked_at is None:
            auth_session.revoked_at = now
            auth_session.revoked_reason = "logout"
    await session.commit()
    return len(auth_sessions)


async def logout(
    session: AsyncSession,
    *,
    refresh_token: str | None = None,
    access_token: str | None = None,
) -> int:
    return await logout_session(
        session,
        refresh_token=refresh_token,
        access_token=access_token,
    )


async def revoke_user_sessions(
    session: AsyncSession,
    user_id: UUID,
    *,
    reason: str = "revoked",
    now: datetime | None = None,
) -> None:
    revoked_at = now or _utcnow()
    await session.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=revoked_at, revoked_reason=reason[:64])
    )


async def disable_user(session: AsyncSession, user_id: UUID) -> bool:
    user = await session.scalar(select(User).where(User.id == user_id).with_for_update())
    if not user:
        return False
    user.is_active = False
    user.token_version = int(user.token_version or 0) + 1
    await revoke_user_sessions(session, user.id, reason="disabled")
    await session.commit()
    return True


def hash_verification_code(code: str) -> str:
    normalized = code if isinstance(code, str) and len(code) == 6 and code.isascii() and code.isdigit() else ""
    return hashlib.sha256(f"{settings.jwt_secret or ''}:{normalized}".encode()).hexdigest()


def _neutral_verification_response(email: str) -> EmailVerificationResponse:
    return EmailVerificationResponse(
        email=email,
        message=NEUTRAL_VERIFICATION_MESSAGE,
        expires_in_minutes=settings.email_code_ttl_minutes,
        email_sent=True,
    )
