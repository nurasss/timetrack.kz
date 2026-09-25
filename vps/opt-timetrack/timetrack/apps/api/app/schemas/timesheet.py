from pydantic import BaseModel, ConfigDict, Field


class TimesheetDay(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str
    status: str = Field(min_length=1, max_length=32)
    check_in: str | None = None
    check_out: str | None = None
    worked_minutes: int = Field(default=0, ge=0, le=1440)
    late_minutes: int = Field(default=0, ge=0, le=1440)
    overtime_minutes: int = Field(default=0, ge=0, le=1440)


class TimesheetEmployee(BaseModel):
    model_config = ConfigDict(extra="forbid")
    employee_id: str
    full_name: str = Field(min_length=1, max_length=255)
    department_id: str | None = None
    department_name: str | None = None
    position: str | None = None
    days: list[TimesheetDay]
    total_worked_minutes: int = Field(default=0, ge=0, le=1000000)
    total_late_minutes: int = Field(default=0, ge=0, le=1000000)
    total_overtime_minutes: int = Field(default=0, ge=0, le=1000000)
    absences: int = Field(default=0, ge=0, le=366)


class TimesheetResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    timezone: str = "UTC"
    employees: list[TimesheetEmployee]
