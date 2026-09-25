from datetime import date
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models import EmploymentStatus
from app.schemas.common import OrmModel


class EmployeeInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def _validate_optional_date(value: date | None) -> date | None:
    if value is not None and not 1900 <= value.year <= 2200:
        raise ValueError("date is outside the supported range")
    return value


def _validate_optional_url(value: str | None) -> str | None:
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("avatar_url must be an http or https URL")
    return value


class EmployeeIn(EmployeeInput):
    full_name: str = Field(min_length=1, max_length=255)
    user_id: UUID | None = None
    department_id: UUID | None = None
    position_id: UUID | None = None
    position_name: str | None = Field(default=None, min_length=1, max_length=255)
    manager_id: UUID | None = None
    iin: str | None = Field(default=None, max_length=32)
    employee_code: str | None = Field(default=None, max_length=64)
    phone: str | None = Field(default=None, max_length=64)
    email: EmailStr | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=512)
    biometric_consent: dict[str, Any] | None = None
    employment_status: EmploymentStatus = EmploymentStatus.ACTIVE
    hired_at: date | None = None
    fired_at: date | None = None

    @field_validator("hired_at", "fired_at")
    @classmethod
    def validate_dates(cls, value: date | None) -> date | None:
        return _validate_optional_date(value)

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar(cls, value: str | None) -> str | None:
        return _validate_optional_url(value)


class EmployeePatch(EmployeeInput):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    user_id: UUID | None = None
    department_id: UUID | None = None
    position_id: UUID | None = None
    position_name: str | None = Field(default=None, min_length=1, max_length=255)
    manager_id: UUID | None = None
    iin: str | None = Field(default=None, max_length=32)
    employee_code: str | None = Field(default=None, max_length=64)
    phone: str | None = Field(default=None, max_length=64)
    email: EmailStr | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=512)
    biometric_consent: dict[str, Any] | None = None
    employment_status: EmploymentStatus | None = None
    hired_at: date | None = None
    fired_at: date | None = None

    @field_validator("hired_at", "fired_at")
    @classmethod
    def validate_dates(cls, value: date | None) -> date | None:
        return _validate_optional_date(value)

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar(cls, value: str | None) -> str | None:
        return _validate_optional_url(value)

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field_name in ("full_name", "employment_status"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class EmployeeOut(OrmModel):
    id: UUID
    company_id: UUID
    user_id: UUID | None = None
    full_name: str
    department_id: UUID | None
    position_id: UUID | None
    manager_id: UUID | None = None
    department: str | None = None
    position: str | None = None
    status: EmploymentStatus
    today_status: str = "NOT_MARKED"
    employee_code: str | None
    phone: str | None
    email: str | None
    avatar_url: str | None
    biometric_consent: dict[str, Any] | None = None
    hired_at: date | None = None
    fired_at: date | None = None


class EmployeesPage(BaseModel):
    items: list[EmployeeOut]
    total: int
    page: int
    limit: int
