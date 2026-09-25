from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import LeaveStatus, LeaveType
from app.schemas.common import OrmModel


class LeaveRequestIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    employee_id: UUID | None = None
    type: LeaveType
    start_date: date
    end_date: date
    comment: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_dates(self):
        for value in (self.start_date, self.end_date):
            if not 1900 <= value.year <= 2200:
                raise ValueError("date is outside the supported range")
        if self.end_date < self.start_date:
            raise ValueError("start_date cannot be after end_date")
        if (self.end_date - self.start_date).days > 366:
            raise ValueError("leave request cannot exceed 366 days")
        return self


class RejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    reason: str | None = Field(default=None, max_length=2000)


class LeaveRequestOut(OrmModel):
    id: UUID
    company_id: UUID
    employee_id: UUID
    employee: str | None = None
    approver_id: UUID | None
    type: LeaveType
    start_date: date
    end_date: date
    comment: str | None
    status: LeaveStatus
    approved_at: datetime | None
    rejected_at: datetime | None
    reject_reason: str | None
