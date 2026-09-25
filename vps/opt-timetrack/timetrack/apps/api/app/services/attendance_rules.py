from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

from app.models import MarkStatus, MarkType

MAX_OFFLINE_BACKDATE_DAYS = 7
MAX_MANUAL_BACKDATE_DAYS = 31
FUTURE_TOLERANCE_SECONDS = 30


class AttendanceState(StrEnum):
    OUT = "OUT"
    IN = "IN"


class MarkTransitionError(ValueError):
    status_code = 409

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def normalize_mark_type(value: MarkType | str) -> MarkType:
    if isinstance(value, MarkType):
        return value
    try:
        return MarkType(str(value))
    except ValueError as exc:
        raise ValueError("Unknown mark type") from exc


def status_value(value: Any) -> str | None:
    return None if value is None else str(getattr(value, "value", value))


def is_approved_status(value: Any) -> bool:
    normalized = status_value(value)
    if normalized is None:
        return True
    return normalized in {MarkStatus.VALID.value, "APPROVED"}


def effective_mark_time(
    marked_at: datetime | None,
    *,
    now: datetime,
    offline: bool,
    max_backdate_days: int = MAX_OFFLINE_BACKDATE_DAYS,
    allow_missing: bool = False,
) -> datetime:
    current = as_utc(now)
    if marked_at is None:
        if offline or not allow_missing:
            raise ValueError("marked_at is required")
        return current
    supplied = as_utc(marked_at)
    if supplied > current + timedelta(seconds=FUTURE_TOLERANCE_SECONDS):
        raise ValueError("marked_at cannot be in the future")
    if offline and supplied < current - timedelta(days=max_backdate_days):
        raise ValueError("marked_at is outside the offline window")
    return supplied if offline else current


def iter_effective_marks(marks: Iterable[Any]) -> list[Any]:
    return sorted(marks, key=lambda mark: as_utc(mark.marked_at))


def sequence_state(marks: Iterable[Any]) -> AttendanceState:
    state = AttendanceState.OUT
    for mark in iter_effective_marks(marks):
        if status_value(getattr(mark, "status", None)) == MarkStatus.REJECTED.value:
            continue
        mark_type = normalize_mark_type(mark.type)
        if mark_type == MarkType.CHECK_IN:
            if state == AttendanceState.IN:
                raise MarkTransitionError("An open check-in already exists")
            state = AttendanceState.IN
        else:
            if state == AttendanceState.OUT:
                raise MarkTransitionError("A check-in is required before check-out")
            state = AttendanceState.OUT
    return state


def validate_sequence_transition(state: AttendanceState | str, mark_type: MarkType | str) -> AttendanceState:
    try:
        normalized_state = state if isinstance(state, AttendanceState) else AttendanceState(str(state))
    except ValueError as exc:
        raise ValueError("Unknown attendance state") from exc
    normalized_type = normalize_mark_type(mark_type)
    if normalized_type == MarkType.CHECK_IN:
        if normalized_state != AttendanceState.OUT:
            raise MarkTransitionError("Duplicate or out-of-order check-in")
        return AttendanceState.IN
    if normalized_state != AttendanceState.IN:
        raise MarkTransitionError("A check-in is required before check-out")
    return AttendanceState.OUT


def mark_fingerprint(mark: Any) -> tuple[Any, ...]:
    idempotency_key = getattr(mark, "idempotency_key", None)
    client_event_id = getattr(mark, "client_event_id", None)
    client_mark_id = getattr(mark, "client_mark_id", None)
    identity = idempotency_key or client_event_id or client_mark_id
    if identity:
        return (getattr(mark, "employee_id", None), str(getattr(mark, "type", "")), str(identity))
    timestamp = as_utc(mark.marked_at)
    return (getattr(mark, "employee_id", None), str(getattr(mark, "type", "")), timestamp.isoformat())


def deduplicate_marks(marks: Iterable[Any]) -> list[Any]:
    unique: dict[tuple[Any, ...], Any] = {}
    for mark in iter_effective_marks(marks):
        unique.setdefault(mark_fingerprint(mark), mark)
    return sorted(unique.values(), key=lambda mark: as_utc(mark.marked_at))
