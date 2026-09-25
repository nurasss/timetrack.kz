from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.models import MarkType
from app.services.attendance_rules import as_utc, deduplicate_marks, is_approved_status


@dataclass(frozen=True)
class ScheduleView:
    start_time: time
    end_time: time
    lunch_start: time | None = None
    lunch_end: time | None = None
    days_of_week: tuple[int, ...] = (0, 1, 2, 3, 4)
    late_tolerance_minutes: int = 0
    overtime_threshold_minutes: int = 0


@dataclass(frozen=True)
class WorkInterval:
    employee_id: Any
    started_at: datetime
    ended_at: datetime
    check_in: Any
    check_out: Any


@dataclass(frozen=True)
class DayWork:
    day: date
    worked_minutes: int = 0
    lunch_minutes: int = 0
    overtime_minutes: int = 0
    scheduled: bool = False


def schedule_view(schedule: Any | None) -> ScheduleView | None:
    if schedule is None:
        return None
    return ScheduleView(
        start_time=schedule.start_time,
        end_time=schedule.end_time,
        lunch_start=getattr(schedule, "lunch_start", None),
        lunch_end=getattr(schedule, "lunch_end", None),
        days_of_week=tuple(int(day) for day in (getattr(schedule, "days_of_week", None) or ())),
        late_tolerance_minutes=int(getattr(schedule, "late_tolerance_minutes", 0) or 0),
        overtime_threshold_minutes=int(getattr(schedule, "overtime_threshold_minutes", 0) or 0),
    )


def is_working_day(day: date, schedule: ScheduleView | None, holidays: set[date] | None = None) -> bool:
    if holidays and day in holidays:
        return False
    if schedule is None:
        return day.weekday() < 5
    return day.weekday() in schedule.days_of_week


def pair_marks_by_employee(marks: Iterable[Any]) -> list[WorkInterval]:
    grouped: dict[Any, list[Any]] = defaultdict(list)
    approved = [mark for mark in marks if is_approved_status(getattr(mark, "status", None))]
    for mark in deduplicate_marks(approved):
        grouped[getattr(mark, "employee_id", None)].append(mark)

    intervals: list[WorkInterval] = []
    for employee_id, employee_marks in grouped.items():
        open_check_ins: list[Any] = []
        for mark in sorted(employee_marks, key=lambda item: as_utc(item.marked_at)):
            mark_type = getattr(mark, "type", None)
            marked_at = as_utc(mark.marked_at)
            if str(getattr(mark_type, "value", mark_type)) == MarkType.CHECK_IN.value:
                open_check_ins.append(mark)
                continue
            if str(getattr(mark_type, "value", mark_type)) != MarkType.CHECK_OUT.value or not open_check_ins:
                continue
            check_in = open_check_ins.pop(0)
            started_at = as_utc(check_in.marked_at)
            if marked_at <= started_at:
                continue
            intervals.append(
                WorkInterval(
                    employee_id=employee_id,
                    started_at=started_at,
                    ended_at=marked_at,
                    check_in=check_in,
                    check_out=mark,
                )
            )
    return sorted(intervals, key=lambda interval: interval.started_at)


def _local_day_bounds(day: date, timezone: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=timezone)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=timezone)
    return start, end


def _lunch_interval(day: date, schedule: ScheduleView, timezone: ZoneInfo) -> tuple[datetime, datetime] | None:
    if schedule.lunch_start is None or schedule.lunch_end is None:
        return None
    start = datetime.combine(day, schedule.lunch_start, tzinfo=timezone)
    end = datetime.combine(day, schedule.lunch_end, tzinfo=timezone)
    if end <= start:
        end += timedelta(days=1)
    return start, end


def split_work_interval(
    interval: WorkInterval,
    *,
    timezone: ZoneInfo,
    schedule: ScheduleView | None,
    holidays: set[date] | None = None,
) -> list[DayWork]:
    start = interval.started_at.astimezone(timezone)
    end = interval.ended_at.astimezone(timezone)
    if end <= start:
        return []
    last_day = (end - timedelta(microseconds=1)).date()
    current_day = start.date()
    result: list[DayWork] = []
    while current_day <= last_day:
        day_start, day_end = _local_day_bounds(current_day, timezone)
        overlap_start = max(start, day_start)
        overlap_end = min(end, day_end)
        if overlap_end > overlap_start:
            raw_minutes = max(0, int((overlap_end - overlap_start).total_seconds() // 60))
            scheduled = is_working_day(current_day, schedule, holidays)
            lunch_minutes = 0
            if scheduled and schedule is not None:
                lunch = _lunch_interval(current_day, schedule, timezone)
                if lunch is not None:
                    lunch_start, lunch_end = lunch
                    lunch_overlap_start = max(overlap_start, lunch_start)
                    lunch_overlap_end = min(overlap_end, lunch_end)
                    if lunch_overlap_end > lunch_overlap_start:
                        lunch_minutes = int((lunch_overlap_end - lunch_overlap_start).total_seconds() // 60)
            worked_minutes = max(0, raw_minutes - lunch_minutes)
            threshold = schedule.overtime_threshold_minutes if schedule is not None else 0
            if not scheduled:
                overtime_minutes = worked_minutes
            elif threshold > 0:
                overtime_minutes = max(0, worked_minutes - threshold)
            else:
                overtime_minutes = 0
            result.append(
                DayWork(
                    day=current_day,
                    worked_minutes=worked_minutes,
                    lunch_minutes=lunch_minutes,
                    overtime_minutes=overtime_minutes,
                    scheduled=scheduled,
                )
            )
        current_day += timedelta(days=1)
    return result


def approved_marks(marks: Iterable[Any]) -> list[Any]:
    return [mark for mark in marks if is_approved_status(getattr(mark, "status", None))]


def local_marked_at(mark: Any, timezone: ZoneInfo) -> datetime:
    return as_utc(mark.marked_at).astimezone(timezone)


def local_marked_date(mark: Any, timezone: ZoneInfo) -> date:
    return local_marked_at(mark, timezone).date()
