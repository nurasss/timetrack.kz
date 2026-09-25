from datetime import date, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import OrmModel


class ScheduleInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("days_of_week", check_fields=False)
    @classmethod
    def validate_days(cls, value: list[int]) -> list[int]:
        if any(day < 0 or day > 6 for day in value):
            raise ValueError("days_of_week values must be between 0 and 6")
        if len(set(value)) != len(value):
            raise ValueError("days_of_week must not contain duplicates")
        return value


class ScheduleIn(ScheduleInput):
    name: str = Field(min_length=1, max_length=255)
    start_time: time
    end_time: time
    lunch_start: time | None = None
    lunch_end: time | None = None
    days_of_week: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4], min_length=1, max_length=7)
    late_tolerance_minutes: int = Field(default=10, ge=0, le=240)
    overtime_threshold_minutes: int = Field(default=0, ge=0, le=1440)

    @model_validator(mode="after")
    def validate_times(self):
        if (self.lunch_start is None) != (self.lunch_end is None):
            raise ValueError("lunch_start and lunch_end must be provided together")
        if self.start_time == self.end_time:
            raise ValueError("start_time and end_time must differ")
        return self


class SchedulePatch(ScheduleInput):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    start_time: time | None = None
    end_time: time | None = None
    lunch_start: time | None = None
    lunch_end: time | None = None
    days_of_week: list[int] | None = Field(default=None, min_length=1, max_length=7)
    late_tolerance_minutes: int | None = Field(default=None, ge=0, le=240)
    overtime_threshold_minutes: int | None = Field(default=None, ge=0, le=1440)

    @model_validator(mode="after")
    def validate_patch(self):
        for field_name in ("name", "start_time", "end_time", "days_of_week", "late_tolerance_minutes", "overtime_threshold_minutes"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        if (
            (self.lunch_start is None) != (self.lunch_end is None)
            and ("lunch_start" in self.model_fields_set or "lunch_end" in self.model_fields_set)
            and (self.lunch_start is not None or self.lunch_end is not None)
        ):
            raise ValueError("lunch_start and lunch_end must be provided together")
        if self.start_time is not None and self.end_time is not None and self.start_time == self.end_time:
            raise ValueError("start_time and end_time must differ")
        return self


class ScheduleOut(OrmModel):
    id: UUID
    company_id: UUID
    name: str
    start_time: time
    end_time: time
    lunch_start: time | None
    lunch_end: time | None
    days_of_week: list[int]
    late_tolerance_minutes: int
    overtime_threshold_minutes: int


class ScheduleAssignmentIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    employee_id: UUID
    valid_from: date
    valid_to: date | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        for value in (self.valid_from, self.valid_to):
            if value is not None and not 1900 <= value.year <= 2200:
                raise ValueError("date is outside the supported range")
        if self.valid_to is not None and self.valid_to < self.valid_from:
            raise ValueError("valid_to cannot be before valid_from")
        return self
