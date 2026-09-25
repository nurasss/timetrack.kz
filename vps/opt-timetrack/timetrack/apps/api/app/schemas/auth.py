from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models import Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterCompanyRequest(BaseModel):
    company_name: str
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    bin: str | None = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=1)


class EmailVerificationResponse(BaseModel):
    ok: bool = True
    email: EmailStr
    message: str
    expires_in_minutes: int
    email_sent: bool


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=1, max_length=32)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=1, max_length=32)
    password: str


class AuthUser(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: Role
    company_id: UUID | None
    company_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AuthUser
