from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import CompanyStatus
from app.schemas.common import OrmModel


class CompanyOut(OrmModel):
    id: UUID
    name: str
    bin: str | None
    email: EmailStr | None
    phone: str | None
    timezone: str
    logo_url: str | None
    status: CompanyStatus
    plan: str
    subscription_expires_at: datetime | None


class CompanyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=255)
    bin: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    timezone: str | None = Field(default=None, max_length=64)
    logo_url: str | None = Field(default=None, max_length=512)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str | None) -> str:
        if value is None or not value.strip():
            raise ValueError("Company name is required")
        return value.strip()

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Timezone is required")
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Unknown timezone") from exc
        return value


class CompanyStats(BaseModel):
    employees: int
    locations: int
    marks_today: int
    pending_requests: int
