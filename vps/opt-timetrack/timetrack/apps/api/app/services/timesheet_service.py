import calendar
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AttendanceMark,
    Company,
    Employee,
    EmployeeScheduleAssignment,
    EmploymentStatus,
    LeaveRequest,
    LeaveStatus,
    MarkStatus,
    MarkType,
    WorkSchedule,
)
from app.schemas.timesheet import TimesheetDay, TimesheetEmployee, TimesheetResponse
from app.services.attendance_calculator import (
    DayWork,
    WorkInterval,
    approved_marks,
    is_working_day,
    local_marked_at,
    pair_marks_by_employee,
    schedule_view,
    split_work_interval,
)
from app.services.timezone_service import company_timezone

MONTH_PATTERN = re.compile(r"^(?P<year>\d{4})-(?P<month>0[1-9]|1[0-2])$")
MAX_TIMESHEET_EMPLOYEES = 2000
MAX_TIMESHEET_MARKS = 200_000


@dataclass(frozen=True)
class DailyAttendanceSummary:
    day: date
    total_active: int
    on_work: set[UUID]
    late: set[UUID]
    absent: set[UUID]
    employees: list[TimesheetEmployee]


def parse_month(month: str) -> tuple[date, date]:
    match = MONTH_PATTERN.fullmatch(month)
    if match is None:
        raise HTTPException(status_code=422, detail="month must use YYYY-MM format")
    year = int(match.group("year"))
    month_number = int(match.group("month"))
    if not 2000 <= year <= 2100:
        raise HTTPException(status_code=422, detail="month is outside the supported range")
    last_day = calendar.monthrange(year, month_number)[1]
    return date(year, month_number, 1), date(year, month_number, last_day)


def _date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def _local_bounds(start: date, end: date, timezone: ZoneInfo) -> tuple[datetime, datetime]:
    local_start = datetime.combine(start, time.min, tzinfo=timezone)
    local_end = datetime.combine(end + timedelta(days=1), time.min, tzinfo=timezone)
    return local_start.astimezone(UTC), local_end.astimezone(UTC)


async def _load_company(session: AsyncSession, company_id: UUID) -> Company:
    company = await session.scalar(select(Company).where(Company.id == company_id))
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def _active_employees_query(company_id: UUID, start: date, end: date):
    return select(Employee).where(
        Employee.company_id == company_id,
        or_(Employee.employment_status != EmploymentStatus.FIRED, Employee.fired_at >= start),
        or_(Employee.hired_at.is_(None), Employee.hired_at <= end),
        or_(Employee.fired_at.is_(None), Employee.fired_at >= start),
    )


async def _load_employees(session: AsyncSession, company_id: UUID, start: date, end: date) -> list[Employee]:
    employees = (
        await session.scalars(
            _active_employees_query(company_id, start, end)
            .options(selectinload(Employee.department), selectinload(Employee.position))
            .order_by(Employee.full_name)
            .limit(MAX_TIMESHEET_EMPLOYEES + 1)
        )
    ).all()
    if len(employees) > MAX_TIMESHEET_EMPLOYEES:
        raise HTTPException(status_code=413, detail="Too many employees for one timesheet")
    return list(employees)


async def _load_schedule_rows(
    session: AsyncSession,
    *,
    company_id: UUID,
    employee_ids: list[UUID],
    start: date,
    end: date,
) -> dict[UUID, list[tuple[EmployeeScheduleAssignment, WorkSchedule]]]:
    if not employee_ids:
        return {}
    rows = (
        await session.execute(
            select(EmployeeScheduleAssignment, WorkSchedule)
            .join(WorkSchedule, WorkSchedule.id == EmployeeScheduleAssignment.work_schedule_id)
            .join(Employee, Employee.id == EmployeeScheduleAssignment.employee_id)
            .where(
                Employee.company_id == company_id,
                EmployeeScheduleAssignment.employee_id.in_(employee_ids),
                EmployeeScheduleAssignment.valid_from <= end,
                or_(
                    EmployeeScheduleAssignment.valid_to.is_(None),
                    EmployeeScheduleAssignment.valid_to >= start,
                ),
            )
            .order_by(EmployeeScheduleAssignment.employee_id, EmployeeScheduleAssignment.valid_from.desc())
        )
    ).all()
    result: dict[UUID, list[tuple[EmployeeScheduleAssignment, WorkSchedule]]] = defaultdict(list)
    for assignment, schedule in rows:
        result[assignment.employee_id].append((assignment, schedule))
    return result


def _effective_schedule(
    rows: list[tuple[EmployeeScheduleAssignment, WorkSchedule]],
    employee_id: UUID,
    day: date,
) -> WorkSchedule | None:
    for assignment, schedule in rows:
        if assignment.valid_from <= day and (assignment.valid_to is None or assignment.valid_to >= day):
            return schedule
    return None


def _holidays(company: Company) -> set[date]:
    values = (company.settings or {}).get("holidays", [])
    if not isinstance(values, list):
        return set()
    result: set[date] = set()
    for value in values[:3660]:
        try:
            parsed = date.fromisoformat(str(value))
        except ValueError:
            continue
        if 1900 <= parsed.year <= 2200:
            result.add(parsed)
    return result


def _approved_status_values() -> list[MarkStatus]:
    values = [MarkStatus.VALID]
    approved = getattr(MarkStatus, "APPROVED", None)
    if approved is not None:
        values.append(approved)
    return values


async def _load_marks(
    session: AsyncSession,
    *,
    company_id: UUID,
    employee_ids: list[UUID],
    start_utc: datetime,
    end_utc: datetime,
    now: datetime,
) -> list[AttendanceMark]:
    if not employee_ids or end_utc <= start_utc:
        return []
    marks = (
        await session.scalars(
            select(AttendanceMark)
            .where(
                AttendanceMark.company_id == company_id,
                AttendanceMark.employee_id.in_(employee_ids),
                AttendanceMark.status.in_(_approved_status_values()),
                AttendanceMark.marked_at >= start_utc - timedelta(days=3),
                AttendanceMark.marked_at <= min(end_utc + timedelta(days=3), now),
            )
            .order_by(AttendanceMark.marked_at)
            .limit(MAX_TIMESHEET_MARKS + 1)
        )
    ).all()
    if len(marks) > MAX_TIMESHEET_MARKS:
        raise HTTPException(status_code=413, detail="Too many attendance marks for one timesheet")
    return list(marks)


def _effective_day_work(
    interval: WorkInterval,
    *,
    timezone: ZoneInfo,
    schedule_rows: list[tuple[EmployeeScheduleAssignment, WorkSchedule]],
    employee_id: UUID,
    holidays: set[date],
) -> list[DayWork]:
    start = interval.started_at.astimezone(timezone)
    end = interval.ended_at.astimezone(timezone)
    current_day = start.date()
    last_day = (end - timedelta(microseconds=1)).date()
    result: list[DayWork] = []
    while current_day <= last_day:
        day_start = datetime.combine(current_day, time.min, tzinfo=timezone)
        day_end = datetime.combine(current_day + timedelta(days=1), time.min, tzinfo=timezone)
        overlap_start = max(start, day_start)
        overlap_end = min(end, day_end)
        if overlap_end > overlap_start:
            schedule = _effective_schedule(schedule_rows, employee_id, current_day)
            daily_interval = WorkInterval(
                employee_id=employee_id,
                started_at=overlap_start,
                ended_at=overlap_end,
                check_in=interval.check_in,
                check_out=interval.check_out,
            )
            result.extend(
                split_work_interval(
                    daily_interval,
                    timezone=timezone,
                    schedule=schedule_view(schedule),
                    holidays=holidays,
                )
            )
        current_day += timedelta(days=1)
    return result


def _mark_display_map(
    marks: list[AttendanceMark],
    timezone: ZoneInfo,
) -> tuple[dict[tuple[UUID, date], AttendanceMark], dict[tuple[UUID, date], AttendanceMark]]:
    check_ins: dict[tuple[UUID, date], AttendanceMark] = {}
    check_outs: dict[tuple[UUID, date], AttendanceMark] = {}
    for mark in approved_marks(marks):
        local_day = local_marked_at(mark, timezone).date()
        key = (mark.employee_id, local_day)
        if mark.type == MarkType.CHECK_IN:
            check_ins.setdefault(key, mark)
        elif mark.type == MarkType.CHECK_OUT:
            check_outs[key] = mark
    return check_ins, check_outs


def _leave_map(leaves: list[LeaveRequest], start: date, end: date) -> dict[tuple[UUID, date], str]:
    result: dict[tuple[UUID, date], str] = {}
    for leave in leaves:
        first = max(leave.start_date, start)
        last = min(leave.end_date, end)
        for day in _date_range(first, last):
            result[(leave.employee_id, day)] = leave.type.value
    return result


async def build_timesheet(
    session: AsyncSession,
    *,
    company_id: UUID,
    month: str,
    employee_id: UUID | None = None,
) -> TimesheetResponse:
    start_date, end_date = parse_month(month)
    company = await _load_company(session, company_id)
    timezone = company_timezone(company)
    start_utc, end_utc = _local_bounds(start_date, end_date, timezone)
    now = datetime.now(UTC)
    employees = await _load_employees(session, company_id, start_date, end_date)
    if employee_id is not None:
        employees = [employee for employee in employees if employee.id == employee_id]
        if not employees:
            raise HTTPException(status_code=404, detail="Employee not found for the requested period")
    employee_ids = [employee.id for employee in employees]
    schedule_rows = await _load_schedule_rows(
        session,
        company_id=company_id,
        employee_ids=employee_ids,
        start=start_date,
        end=end_date,
    )
    leaves = (
        await session.scalars(
            select(LeaveRequest).where(
                LeaveRequest.company_id == company_id,
                LeaveRequest.status == LeaveStatus.APPROVED,
                LeaveRequest.start_date <= end_date,
                LeaveRequest.end_date >= start_date,
            )
        )
    ).all()
    leaves_by_day = _leave_map(list(leaves), start_date, end_date)
    holidays = _holidays(company)
    marks = await _load_marks(
        session,
        company_id=company_id,
        employee_ids=employee_ids,
        start_utc=start_utc,
        end_utc=end_utc,
        now=now,
    )
    intervals = pair_marks_by_employee(marks)
    work_by_employee_day: dict[tuple[UUID, date], DayWork] = {}
    for interval in intervals:
        rows = schedule_rows.get(interval.employee_id, [])
        for day_work in _effective_day_work(
            interval,
            timezone=timezone,
            schedule_rows=rows,
            employee_id=interval.employee_id,
            holidays=holidays,
        ):
            key = (interval.employee_id, day_work.day)
            previous = work_by_employee_day.get(key)
            if previous is None:
                work_by_employee_day[key] = day_work
            else:
                work_by_employee_day[key] = DayWork(
                    day=day_work.day,
                    worked_minutes=previous.worked_minutes + day_work.worked_minutes,
                    lunch_minutes=previous.lunch_minutes + day_work.lunch_minutes,
                    overtime_minutes=previous.overtime_minutes + day_work.overtime_minutes,
                    scheduled=previous.scheduled or day_work.scheduled,
                )
    check_ins, check_outs = _mark_display_map(marks, timezone)
    today = now.astimezone(timezone).date()
    rows: list[TimesheetEmployee] = []
    for employee in employees:
        days: list[TimesheetDay] = []
        total_worked = 0
        total_late = 0
        total_overtime = 0
        absences = 0
        employee_schedule_rows = schedule_rows.get(employee.id, [])
        for current_date in _date_range(start_date, end_date):
            work = work_by_employee_day.get((employee.id, current_date), DayWork(current_date))
            check_in = check_ins.get((employee.id, current_date))
            check_out = check_outs.get((employee.id, current_date))
            leave_status = leaves_by_day.get((employee.id, current_date))
            scheduled = work.scheduled
            if work.worked_minutes == 0 and check_in is None and check_out is None:
                scheduled = is_working_day(current_date, schedule_view(_effective_schedule(employee_schedule_rows, employee.id, current_date)), holidays)
            late_minutes = max(0, int(getattr(check_in, "late_minutes", 0) or 0)) if check_in is not None else 0
            future = current_date > today
            if future:
                status = "FUTURE"
            elif leave_status and work.worked_minutes == 0:
                status = leave_status
            elif work.worked_minutes > 0 or check_in is not None or check_out is not None:
                status = "LATE" if late_minutes > 0 else "WORKED" if work.worked_minutes > 0 else "INCOMPLETE"
            elif not scheduled:
                status = "HOLIDAY" if current_date in holidays else "WEEKEND"
            else:
                status = "ABSENT"
            if status == "ABSENT":
                absences += 1
            total_worked += work.worked_minutes
            total_late += late_minutes
            total_overtime += work.overtime_minutes
            days.append(
                TimesheetDay(
                    date=current_date.isoformat(),
                    status=status,
                    check_in=local_marked_at(check_in, timezone).strftime("%H:%M") if check_in else None,
                    check_out=local_marked_at(check_out, timezone).strftime("%H:%M") if check_out else None,
                    worked_minutes=work.worked_minutes,
                    late_minutes=late_minutes,
                    overtime_minutes=work.overtime_minutes,
                )
            )
        rows.append(
            TimesheetEmployee(
                employee_id=str(employee.id),
                full_name=employee.full_name,
                department_id=str(employee.department_id) if employee.department_id else None,
                department_name=employee.department.name if employee.department else None,
                position=employee.position.name if employee.position else None,
                days=days,
                total_worked_minutes=total_worked,
                total_late_minutes=total_late,
                total_overtime_minutes=total_overtime,
                absences=absences,
            )
        )
    return TimesheetResponse(month=month, timezone=timezone.key, employees=rows)


async def build_daily_attendance(
    session: AsyncSession,
    *,
    company_id: UUID,
    day: date | None = None,
) -> DailyAttendanceSummary:
    company = await _load_company(session, company_id)
    timezone = company_timezone(company)
    target_day = day or datetime.now(UTC).astimezone(timezone).date()
    month = target_day.strftime("%Y-%m")
    response = await build_timesheet(session, company_id=company_id, month=month)
    on_work: set[UUID] = set()
    late: set[UUID] = set()
    absent: set[UUID] = set()
    for employee in response.employees:
        target = next((item for item in employee.days if item.date == target_day.isoformat()), None)
        if target is None:
            continue
        employee_id = UUID(employee.employee_id)
        if target.check_in is not None:
            on_work.add(employee_id)
        if target.late_minutes > 0:
            late.add(employee_id)
        if target.status == "ABSENT":
            absent.add(employee_id)
    return DailyAttendanceSummary(
        day=target_day,
        total_active=len(response.employees),
        on_work=on_work,
        late=late,
        absent=absent,
        employees=response.employees,
    )
