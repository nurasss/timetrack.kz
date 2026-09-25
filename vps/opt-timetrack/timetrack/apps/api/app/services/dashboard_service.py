from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AttendanceMark,
    Company,
    Employee,
    EmploymentStatus,
    LeaveRequest,
    LeaveStatus,
    Location,
    MarkStatus,
    MarkType,
)
from app.schemas.dashboard import (
    ChartPoint,
    DashboardSummary,
    LateEmployee,
    LocationStatus,
    PendingRequest,
    RecentMark,
)
from app.services.attendance_calculator import local_marked_at
from app.services.attendance_rules import deduplicate_marks
from app.services.timesheet_service import build_daily_attendance
from app.services.timezone_service import company_timezone


async def _company(session: AsyncSession, company_id: UUID) -> Company:
    company = await session.scalar(select(Company).where(Company.id == company_id))
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def _approved_statuses() -> list[MarkStatus]:
    values = [MarkStatus.VALID]
    approved = getattr(MarkStatus, "APPROVED", None)
    if approved is not None:
        values.append(approved)
    return values


async def _marks_for_local_day(
    session: AsyncSession,
    *,
    company_id: UUID,
    day: date,
    timezone,
) -> list[AttendanceMark]:
    start = datetime.combine(day, time.min, tzinfo=timezone).astimezone(UTC)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=timezone).astimezone(UTC)
    marks = (
        await session.scalars(
            select(AttendanceMark)
            .options(selectinload(AttendanceMark.employee).selectinload(Employee.position))
            .where(
                AttendanceMark.company_id == company_id,
                AttendanceMark.marked_at >= start,
                AttendanceMark.marked_at < end,
                AttendanceMark.marked_at <= datetime.now(UTC),
                AttendanceMark.status.in_(_approved_statuses()),
            )
            .order_by(AttendanceMark.marked_at)
        )
    ).all()
    return list(deduplicate_marks(marks))


async def dashboard_summary(session: AsyncSession, *, company_id: UUID) -> DashboardSummary:
    company = await _company(session, company_id)
    timezone = company_timezone(company)
    now = datetime.now(UTC)
    today = now.astimezone(timezone).date()
    daily = await build_daily_attendance(session, company_id=company_id, day=today)
    total_employees = daily.total_active

    def percent(value: int) -> float:
        return round(value / total_employees * 100, 1) if total_employees else 0


    attendance_chart: list[ChartPoint] = []
    late_chart: list[ChartPoint] = []
    for offset in range(4, -1, -1):
        day = today - timedelta(days=offset)
        day_summary = await build_daily_attendance(session, company_id=company_id, day=day)
        attendance_chart.append(ChartPoint(date=day.strftime("%d.%m"), value=percent(len(day_summary.on_work))))
        late_chart.append(ChartPoint(date=day.strftime("%d.%m"), value=len(day_summary.late)))

    today_marks = await _marks_for_local_day(
        session,
        company_id=company_id,
        day=today,
        timezone=timezone,
    )
    late_marks = [
        mark
        for mark in today_marks
        if mark.type == MarkType.CHECK_IN and int(getattr(mark, "late_minutes", 0) or 0) > 0
    ]
    late_marks.sort(key=lambda mark: int(getattr(mark, "late_minutes", 0) or 0), reverse=True)
    late_employees: list[LateEmployee] = []
    for mark in late_marks[:5]:
        employee = mark.employee
        position = getattr(employee, "position", None) if employee else None
        late_employees.append(
            LateEmployee(
                full_name=employee.full_name if employee else "",
                position=position.name if position else None,
                late_minutes=int(getattr(mark, "late_minutes", 0) or 0),
                avatar_url=getattr(employee, "avatar_url", None),
            )
        )

    recent_start = datetime.combine(today - timedelta(days=30), time.min, tzinfo=timezone).astimezone(UTC)
    recent_db = (
        await session.scalars(
            select(AttendanceMark)
            .options(selectinload(AttendanceMark.employee), selectinload(AttendanceMark.location))
            .where(
                AttendanceMark.company_id == company_id,
                AttendanceMark.marked_at >= recent_start,
                AttendanceMark.marked_at <= now,
                AttendanceMark.status.in_(_approved_statuses()),
            )
            .order_by(desc(AttendanceMark.marked_at))
            .limit(100)
        )
    ).all()
    recent_marks: list[RecentMark] = []
    seen_recent: set[tuple[UUID, str, str]] = set()
    for mark in deduplicate_marks(recent_db):
        local = local_marked_at(mark, timezone)
        identity = (mark.employee_id, str(getattr(mark.type, "value", mark.type)), local.isoformat())
        if identity in seen_recent:
            continue
        seen_recent.add(identity)
        recent_marks.append(
            RecentMark(
                employee=mark.employee.full_name if mark.employee else "",
                type=str(getattr(mark.type, "value", mark.type)),
                time=local.strftime("%H:%M"),
                location=mark.location.name if mark.location else None,
            )
        )
        if len(recent_marks) == 8:
            break

    locations = (
        await session.scalars(
            select(Location).where(Location.company_id == company_id, Location.is_active.is_(True)).order_by(Location.name)
        )
    ).all()
    location_status: list[LocationStatus] = []
    for location in locations:
        employee_ids = {
            mark.employee_id
            for mark in today_marks
            if mark.type == MarkType.CHECK_IN and mark.location_id == location.id
        }
        location_status.append(
            LocationStatus(
                name=location.name,
                count=len(employee_ids),
                percent=percent(len(employee_ids)),
            )
        )

    pending_db = (
        await session.scalars(
            select(LeaveRequest)
            .options(selectinload(LeaveRequest.employee))
            .where(LeaveRequest.company_id == company_id, LeaveRequest.status == LeaveStatus.PENDING)
            .order_by(desc(LeaveRequest.created_at))
            .limit(5)
        )
    ).all()
    pending = [
        PendingRequest(
            type=request.type.value,
            employee=request.employee.full_name if request.employee else "",
            period=f"{request.start_date.strftime('%d.%m')} - {request.end_date.strftime('%d.%m')}",
        )
        for request in pending_db
    ]

    prior_day = today - timedelta(days=7)
    previous_active = await session.scalar(
        select(func.count(Employee.id)).where(
            Employee.company_id == company_id,
            Employee.employment_status == EmploymentStatus.ACTIVE,
            or_(Employee.hired_at.is_(None), Employee.hired_at <= prior_day),
            or_(Employee.fired_at.is_(None), Employee.fired_at >= prior_day),
        )
    )
    employees_delta_week = total_employees - int(previous_active or 0)

    return DashboardSummary(
        total_employees=total_employees,
        employees_delta_week=employees_delta_week,
        today_on_work=len(daily.on_work),
        today_on_work_percent=percent(len(daily.on_work)),
        today_late=len(daily.late),
        today_late_percent=percent(len(daily.late)),
        today_absent=len(daily.absent),
        today_absent_percent=percent(len(daily.absent)),
        attendance_chart=attendance_chart,
        late_chart=late_chart,
        late_employees=late_employees,
        location_status=location_status,
        recent_marks=recent_marks,
        pending_requests=pending,
    )
