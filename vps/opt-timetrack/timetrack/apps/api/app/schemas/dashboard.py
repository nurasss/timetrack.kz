from pydantic import BaseModel


class ChartPoint(BaseModel):
    date: str
    value: float


class LateEmployee(BaseModel):
    full_name: str
    position: str | None
    late_minutes: int
    avatar_url: str | None = None


class LocationStatus(BaseModel):
    name: str
    count: int
    percent: float


class RecentMark(BaseModel):
    employee: str
    type: str
    time: str
    location: str | None


class PendingRequest(BaseModel):
    type: str
    employee: str
    period: str


class DashboardSummary(BaseModel):
    total_employees: int
    employees_delta_week: int
    today_on_work: int
    today_on_work_percent: float
    today_late: int
    today_late_percent: float
    today_absent: int
    today_absent_percent: float
    attendance_chart: list[ChartPoint]
    late_chart: list[ChartPoint]
    late_employees: list[LateEmployee]
    location_status: list[LocationStatus]
    recent_marks: list[RecentMark]
    pending_requests: list[PendingRequest]

