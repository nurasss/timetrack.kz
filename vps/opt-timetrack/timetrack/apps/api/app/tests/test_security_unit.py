import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.core.rate_limit import InMemoryRateLimiter
from app.core.rbac import is_admin, is_employee, is_hr, is_manager
from app.core.security import create_token, decode_token, hash_refresh_token
from app.models import AuthSession, Company, CompanyStatus, Role, User
from app.services import email_service
from app.services.auth_service import hash_verification_code, refresh_session, verify_email


class ScalarOnlySession:
    def __init__(self, value):
        self.value = value

    async def scalar(self, _statement):
        return self.value

    def add(self, _value):
        raise AssertionError("verified accounts must not create sessions")


class RefreshSession:
    def __init__(self, auth_session, user, company):
        self.auth_session = auth_session
        self.user = user
        self.company = company
        self.scalar_calls = 0
        self.added = []
        self.execute_calls = 0
        self.commits = 0

    async def scalar(self, _statement):
        self.scalar_calls += 1
        return self.user if self.scalar_calls == 1 else self.auth_session

    async def get(self, model, _identifier):
        return self.company if model is Company else None

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        return None

    async def execute(self, _statement):
        self.execute_calls += 1

    async def commit(self):
        self.commits += 1


def test_access_token_requires_expected_type_and_valid_signature():
    subject = uuid4()
    session_id = uuid4()
    token = create_token(
        subject,
        "access",
        timedelta(minutes=5),
        token_version=0,
        jti=session_id,
        session_id=session_id,
    )

    payload = decode_token(token, expected_type="access")

    assert payload["typ"] == "access"
    assert payload["sub"] == str(subject)
    assert payload["sid"] == str(session_id)
    with pytest.raises(ValueError):
        decode_token(token, expected_type="refresh")
    with pytest.raises(ValueError):
        decode_token(token + "tampered", expected_type="access")


def test_refresh_token_hash_does_not_store_plaintext():
    token = "refresh-token-value"

    hashed = hash_refresh_token(token)

    assert hashed != token
    assert len(hashed) == 64
    assert hash_refresh_token(token) == hashed


def test_verified_email_with_any_code_is_rejected_without_session_write():
    user = User(
        id=uuid4(),
        email="verified@example.com",
        full_name="Verified",
        password_hash="hash",
        role=Role.EMPLOYEE,
        is_active=True,
        email_verified_at=datetime.now(UTC),
        token_version=0,
    )

    with pytest.raises(HTTPException) as raised:
        asyncio.run(verify_email(ScalarOnlySession(user), user.email, "000000"))

    assert raised.value.status_code == 400
    assert raised.value.detail == "Invalid verification code"


def test_refresh_rotation_revokes_old_session_and_reuse_is_rejected():
    company_id = uuid4()
    user_id = uuid4()
    jti = uuid4()
    user = User(
        id=user_id,
        company_id=company_id,
        email="session@example.com",
        full_name="Session",
        password_hash="hash",
        role=Role.EMPLOYEE,
        is_active=True,
        email_verified_at=datetime.now(UTC),
        token_version=1,
    )
    company = Company(id=company_id, name="Company", status=CompanyStatus.ACTIVE, plan="STARTER", settings={})
    refresh_token = create_token(
        user_id,
        "refresh",
        timedelta(days=30),
        company_id=company_id,
        token_version=1,
        jti=jti,
        session_id=jti,
    )
    auth_session = AuthSession(
        id=jti,
        jti=jti,
        user_id=user_id,
        company_id=company_id,
        token_hash=hash_refresh_token(refresh_token),
        token_version=1,
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    session = RefreshSession(auth_session, user, company)

    first = asyncio.run(refresh_session(session, refresh_token))

    assert first.refresh_token != refresh_token
    assert auth_session.revoked_at is not None
    assert auth_session.revoked_reason == "rotated"
    assert len(session.added) == 1
    session.scalar_calls = 0
    with pytest.raises(HTTPException) as raised:
        asyncio.run(refresh_session(session, refresh_token))
    assert raised.value.status_code == 401
    assert session.execute_calls == 1


def test_verification_code_hash_is_not_plaintext():
    assert hash_verification_code("123456") != "123456"
    assert len(hash_verification_code("123456")) == 64


@pytest.mark.asyncio
async def test_in_memory_rate_limiter_is_deterministic():
    limiter = InMemoryRateLimiter()

    decisions = [await limiter.hit("login:ip:test", 2, 60) for _ in range(3)]

    assert [decision.allowed for decision in decisions] == [True, True, False]


def test_production_settings_reject_missing_or_weak_secrets():
    with pytest.raises(ValueError):
        Settings(_env_file=None, app_env="production", jwt_secret=None, cors_origins="https://app.example")
    with pytest.raises(ValueError):
        Settings(_env_file=None, app_env="development", jwt_secret="short", cors_origins="http://localhost:3000")


def test_rbac_helpers_include_super_admin():
    super_admin = SimpleNamespace(role=Role.SUPER_ADMIN)
    employee = SimpleNamespace(role=Role.EMPLOYEE)

    assert is_admin(super_admin)
    assert is_hr(super_admin)
    assert is_manager(super_admin)
    assert is_employee(super_admin)
    assert is_employee(employee)
    assert not is_admin(employee)


def test_smtp_starttls_uses_default_context(monkeypatch):
    sent = SimpleNamespace(starttls_context=None, login_called=False, message=None)
    context = SimpleNamespace(minimum_version=None)

    class FakeSMTP:
        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def starttls(self, *, context):
            sent.starttls_context = context

        def login(self, username, password):
            sent.login_called = (username, password)

        def send_message(self, message):
            sent.message = message

    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(email_service.ssl, "create_default_context", lambda: context)
    monkeypatch.setattr(email_service.settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(email_service.settings, "smtp_username", "user")
    monkeypatch.setattr(email_service.settings, "smtp_password", "password")
    monkeypatch.setattr(email_service.settings, "smtp_use_tls", True)
    email_service._send_message(email_service.EmailMessage())

    assert context.minimum_version == email_service.ssl.TLSVersion.TLSv1_2
    assert sent.starttls_context is context
    assert sent.login_called == ("user", "password")
    assert sent.message is not None
