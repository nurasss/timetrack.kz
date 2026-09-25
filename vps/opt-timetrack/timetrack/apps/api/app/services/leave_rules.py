from datetime import date
from typing import Any

from app.models import LeaveStatus


class LeaveTransitionError(ValueError):
    status_code = 409

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


def validate_leave_transition(current: LeaveStatus | str, target: LeaveStatus | str) -> LeaveStatus:
    try:
        current_status = current if isinstance(current, LeaveStatus) else LeaveStatus(str(current))
        target_status = target if isinstance(target, LeaveStatus) else LeaveStatus(str(target))
    except ValueError as exc:
        raise ValueError("Unknown leave status") from exc
    if current_status != LeaveStatus.PENDING:
        raise LeaveTransitionError("Only pending leave requests can change status")
    if target_status not in {LeaveStatus.APPROVED, LeaveStatus.REJECTED, LeaveStatus.CANCELLED}:
        raise LeaveTransitionError("Invalid leave request transition")
    return target_status


def ranges_overlap(start: date, end: date, other_start: date, other_end: date) -> bool:
    return start <= other_end and other_start <= end


def has_overlapping_request(requests: list[Any], start: date, end: date, *, exclude_id: Any = None) -> bool:
    for request in requests:
        if request.id == exclude_id:
            continue
        status = getattr(request, "status", None)
        if status not in {LeaveStatus.PENDING, LeaveStatus.APPROVED}:
            continue
        if ranges_overlap(start, end, request.start_date, request.end_date):
            return True
    return False
