import hashlib
import hmac
import time
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from jwt import PyJWTError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_token(
    subject: UUID | str,
    token_type: str,
    expires_delta: timedelta,
    company_id: UUID | None = None,
    token_version: int | None = None,
    jti: UUID | str | None = None,
    session_id: UUID | str | None = None,
) -> str:
    if not token_type or expires_delta.total_seconds() <= 0:
        raise ValueError("Invalid token parameters")
    now = datetime.now(UTC)
    payload = {
        "sub": str(subject),
        "typ": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    if company_id is not None:
        payload["company_id"] = str(company_id)
    if token_version is not None:
        if int(token_version) < 0:
            raise ValueError("Invalid token version")
        payload["ver"] = int(token_version)
    if jti is not None:
        payload["jti"] = str(jti)
    if session_id is not None:
        payload["sid"] = str(session_id)
    secret = settings.jwt_secret
    if not secret or len(secret.encode()) < 32:
        raise ValueError("JWT secret is not configured securely")
    return jwt.encode(payload, secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: str | None = None) -> dict:
    secret = settings.jwt_secret
    if not secret or len(secret.encode()) < 32:
        raise ValueError("Invalid token")
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
    except (PyJWTError, TypeError, ValueError) as exc:
        raise ValueError("Invalid token") from exc
    if not isinstance(payload, dict):
        raise ValueError("Invalid token")
    token_type = payload.get("typ")
    if not isinstance(token_type, str) or not token_type:
        raise ValueError("Invalid token")
    if expected_type is not None and token_type != expected_type:
        raise ValueError("Invalid token type")
    try:
        subject = UUID(str(payload["sub"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid token") from exc
    payload["sub"] = str(subject)
    try:
        expires_at = float(payload["exp"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid token") from exc
    if expires_at <= time.time():
        raise ValueError("Invalid token")
    return payload


def hash_refresh_token(token: str) -> str:
    secret = (settings.jwt_secret or "").encode()
    if len(secret) < 32:
        raise ValueError("JWT secret is not configured securely")
    return hmac.new(secret, token.encode(), hashlib.sha256).hexdigest()


def secure_compare(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))
