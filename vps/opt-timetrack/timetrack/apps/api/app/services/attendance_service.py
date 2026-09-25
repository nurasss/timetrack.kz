from collections import OrderedDict
from datetime import UTC, datetime
from threading import Lock
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AttendanceMark,
    Company,
    Employee,
    EmployeeScheduleAssignment,
    EmploymentStatus,
    Location,
    MarkSource,
    MarkStatus,
    MarkType,
    WorkSchedule,
)
from app.schemas.attendance import ManualMarkCreate, MarkCreate, SelfMarkCreate
from app.services.attendance_rules import (
    MAX_MANUAL_BACKDATE_DAYS,
    MAX_OFFLINE_BACKDATE_DAYS,
    MarkTransitionError,
    as_utc,
    effective_mark_time,
    AttendanceState,
    validate_sequence_transition,
)
from app.services.audit_service import write_audit
from app.services.consent_service import require_biometric_consent
from app.services.geofence_service import evaluate_geofence
from app.services.tenant_service import (
    commit_or_conflict,
    ensure_employee_reference,
    ensure_location_reference,
    flush_or_conflict,
    resolve_employee_for_user,
)
from app.services.timezone_service import company_timezone

MAX_IDEMPOTENCY_CACHE_SIZE = 2048
MAX_ACCURACY_METERS = 100.0
_idempotency_cache: OrderedDict[tuple[UUID, UUID, str, str], tuple[tuple[Any, ...], UUID]] = OrderedDict()
_idempotency_lock = Lock()


def _supports(model: type, field: str) -> bool:
    return hasattr(model, field)


def _set_supported(instance: object, field: str, value: Any) -> None:
    if _supports(type(instance), field):
        setattr(instance, field, value)


def _payload_value(payload: object, field: str, default: Any = None) -> Any:
    return getattr(payload, field, default)


def _offline_requested(payload: object) -> bool:
    return bool(_payload_value(payload, "offline", False) or _payload_value(payload, "is_offline", False))


def _idempotency_key(payload: object) -> str | None:
    value = (
        _payload_value(payload, "idempotency_key")
        or _payload_value(payload, "client_event_id")
        or _payload_value(payload, "client_mark_id")
    )
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _fingerprint(payload: object, marked_at: datetime) -> tuple[Any, ...]:
    timestamp = marked_at.isoformat() if _offline_requested(payload) or _payload_value(payload, "type") else None
    return (
        timestamp,
        str(_payload_value(payload, "location_id", "")),
        _payload_value(payload, "lat"),
        _payload_value(payload, "lng"),
        _payload_value(payload, "accuracy_meters"),
        _payload_value(payload, "photo_url"),
        _payload_value(payload, "liveness_passed"),
        _payload_value(payload, "face_match_score"),
        _payload_value(payload, "source"),
        repr(_payload_value(payload, "idempotency_metadata")),
    )


def _effective_time_or_http(*args, **kwargs) -> datetime:
    try:
        return effective_mark_time(*args, **kwargs)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _cache_get(key: tuple[UUID, UUID, str, str], fingerprint: tuple[Any, ...]) -> UUID | None:
    with _idempotency_lock:
        item = _idempotency_cache.get(key)
        if item is None:
            return None
        cached_fingerprint, mark_id = item
        if cached_fingerprint != fingerprint:
            raise HTTPException(status_code=409, detail="Idempotency key was already used with different data")
        _idempotency_cache.move_to_end(key)
        return mark_id


def _cache_put(key: tuple[UUID, UUID, str, str], fingerprint: tuple[Any, ...], mark_id: UUID) -> None:
    with _idempotency_lock:
        _idempotency_cache[key] = (fingerprint, mark_id)
        _idempotency_cache.move_to_end(key)
        while len(_idempotency_cache) > MAX_IDEMPOTENCY_CACHE_SIZE:
            _idempotency_cache.popitem(last=False)


def _cache_remove(key: tuple[UUID, UUID, str, str]) -> None:
    with _idempotency_lock:
        _idempotency_cache.pop(key, None)


async def _load_mark(session: AsyncSession, mark_id: UUID) -> AttendanceMark | None:
    return await session.scalar(
        select(AttendanceMark)
        .options(selectinload(AttendanceMark.employee), selectinload(AttendanceMark.location))
        .where(AttendanceMark.id == mark_id)
    )


async def _find_idempotent_mark(
    session: AsyncSession,
    *,
    company_id: UUID,
    employee_id: UUID,
    idempotency_key: str,
) -> AttendanceMark | None:
    for field in ("idempotency_key", "client_event_id", "client_mark_id"):
        if not _supports(AttendanceMark, field):
            continue
        column = getattr(AttendanceMark, field)
        existing = await session.scalar(
            select(AttendanceMark)
            .options(selectinload(AttendanceMark.employee), selectinload(AttendanceMark.location))
            .where(
                AttendanceMark.company_id == company_id,
                AttendanceMark.employee_id == employee_id,
                column == idempotency_key,
            )
        )
        if existing is not None:
            return existing
    return None


def _setting(settings: dict[str, Any], key: str, default: bool) -> bool:
    value = settings.get(key, default)
    if key.startswith("require_"):
        return value is not False
    return bool(value)


async def _load_company(session: AsyncSession, company_id: UUID) -> Company:
    company = await session.scalar(select(Company).where(Company.id == company_id))
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


async def _employee_for_mark(
    session: AsyncSession,
    *,
    company_id: UUID,
    user_id: UUID,
    employee_id: UUID | None,
    manual: bool,
) -> Employee:
    if employee_id is None or not manual:
        if employee_id is None:
            return await resolve_employee_for_user(session, company_id=company_id, user_id=user_id, lock=True)
        employee = await ensure_employee_reference(
            session,
            company_id=company_id,
            employee_id=employee_id,
            lock=True,
        )
        if employee.user_id != user_id:
            raise HTTPException(status_code=403, detail="Employee is not linked to the authenticated user")
        return employee
    return await ensure_employee_reference(session, company_id=company_id, employee_id=employee_id, lock=True)


async def _location_for_mark(
    session: AsyncSession,
    *,
    company_id: UUID,
    payload: object,
    require_active: bool,
) -> Location | None:
    location_id = _payload_value(payload, "location_id")
    if location_id is None:
        return None
    if not isinstance(location_id, UUID):
        raise HTTPException(status_code=422, detail="location_id must be a UUID")
    return await ensure_location_reference(
        session,
        company_id=company_id,
        location_id=location_id,
        active=require_active,
        lock=True,
    )


async def _employee_schedule(
    session: AsyncSession,
    *,
    company_id: UUID,
    employee_id: UUID,
    local_date,
) -> WorkSchedule | None:
    return await session.scalar(
        select(WorkSchedule)
        .join(EmployeeScheduleAssignment, EmployeeScheduleAssignment.work_schedule_id == WorkSchedule.id)
        .where(
            WorkSchedule.company_id == company_id,
            EmployeeScheduleAssignment.employee_id == employee_id,
            EmployeeScheduleAssignment.valid_from <= local_date,
            (
                EmployeeScheduleAssignment.valid_to.is_(None)
                | (EmployeeScheduleAssignment.valid_to >= local_date)
            ),
        )
        .order_by(EmployeeScheduleAssignment.valid_from.desc())
        .limit(1)
    )


def _evaluate_schedule(
    mark_type: MarkType,
    marked_at: datetime,
    schedule: WorkSchedule | None,
    timezone,
) -> tuple[bool, int, bool, int]:
    if schedule is None:
        return False, 0, False, 0
    local = marked_at.astimezone(timezone)
    minutes = local.hour * 60 + local.minute
    start = schedule.start_time.hour * 60 + schedule.start_time.minute + schedule.late_tolerance_minutes
    end = schedule.end_time.hour * 60 + schedule.end_time.minute
    if end <= start:
        end += 24 * 60
        if mark_type == MarkType.CHECK_OUT and minutes < end - 24 * 60:
            minutes += 24 * 60
    if mark_type == MarkType.CHECK_IN and minutes > start:
        return True, minutes - start, False, 0
    if mark_type == MarkType.CHECK_OUT and minutes < end:
        return False, 0, True, end - minutes
    return False, 0, False, 0


async def _check_sequence(
    session: AsyncSession,
    *,
    company_id: UUID,
    employee_id: UUID,
    mark_type: MarkType,
    marked_at: datetime,
) -> None:
    latest = await session.scalar(
        select(AttendanceMark)
        .where(
            AttendanceMark.company_id == company_id,
            AttendanceMark.employee_id == employee_id,
            AttendanceMark.status != MarkStatus.REJECTED,
        )
        .order_by(desc(AttendanceMark.marked_at), desc(AttendanceMark.id))
        .limit(1)
    )
    if latest is not None and as_utc(latest.marked_at) > marked_at:
        raise HTTPException(status_code=409, detail="An older mark cannot follow a newer mark")
    try:
        state = AttendanceState.IN if latest is not None and latest.type == MarkType.CHECK_IN else AttendanceState.OUT
        validate_sequence_transition(state, mark_type)
    except MarkTransitionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


async def create_mark(
    session: AsyncSession,
    *,
    company_id: UUID,
    user_id: UUID,
    mark_type: MarkType,
    payload: MarkCreate | SelfMarkCreate | ManualMarkCreate,
    employee_id: UUID | None = None,
    manual: bool = False,
) -> AttendanceMark:
    now = datetime.now(UTC)
    company = await _load_company(session, company_id)
    explicit_employee_id = employee_id or _payload_value(payload, "employee_id")
    employee = await _employee_for_mark(
        session,
        company_id=company_id,
        user_id=user_id,
        employee_id=explicit_employee_id,
        manual=manual,
    )
    if not manual and employee.employment_status != EmploymentStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Inactive employees cannot create attendance marks")
    offline = False if manual else _offline_requested(payload)
    marked_at_value = _payload_value(payload, "marked_at")
    if offline:
        if not _setting(company.settings or {}, "allow_offline_marks", True):
            raise HTTPException(status_code=422, detail="Offline marks are disabled")
        effective_time = _effective_time_or_http(
            marked_at_value,
            now=now,
            offline=True,
            max_backdate_days=MAX_OFFLINE_BACKDATE_DAYS,
        )
    elif manual:
        effective_time = _effective_time_or_http(
            marked_at_value,
            now=now,
            offline=marked_at_value is not None,
            max_backdate_days=MAX_MANUAL_BACKDATE_DAYS,
            allow_missing=True,
        )
    else:
        effective_time = _effective_time_or_http(
            marked_at_value,
            now=now,
            offline=False,
            allow_missing=True,
        )

    idempotency_key = _idempotency_key(payload)
    if offline and idempotency_key is None:
        raise HTTPException(status_code=422, detail="offline marks require an idempotency key")
    fingerprint = _fingerprint(payload, effective_time)
    cache_key = (company_id, employee.id, mark_type.value, idempotency_key or _fingerprint_key(fingerprint))
    if idempotency_key is not None:
        cached_id = _cache_get(cache_key, fingerprint)
        if cached_id is not None:
            existing = await _load_mark(session, cached_id)
            if existing is not None:
                return existing
            _cache_remove(cache_key)
        existing = await _find_idempotent_mark(
            session,
            company_id=company_id,
            employee_id=employee.id,
            idempotency_key=idempotency_key,
        )
        if existing is not None:
            if existing.type != mark_type or _fingerprint(payload, as_utc(existing.marked_at)) != fingerprint:
                raise HTTPException(status_code=409, detail="Idempotency key was already used with different data")
            return existing

    settings = company.settings or {}
    require_geolocation = _setting(settings, "require_geolocation", True)
    require_photo = _setting(settings, "require_photo_on_mark", True)
    location = await _location_for_mark(
        session,
        company_id=company_id,
        payload=payload,
        require_active=True,
    )
    lat = _payload_value(payload, "lat")
    lng = _payload_value(payload, "lng")
    accuracy = _payload_value(payload, "accuracy_meters")
    inside = False
    distance = None
    suspicious = False
    if location is not None:
        inside, distance, geo_suspicious = evaluate_geofence(
            mark_lat=lat,
            mark_lng=lng,
            location_lat=float(location.lat),
            location_lng=float(location.lng),
            radius_meters=location.radius_meters,
            accuracy_meters=accuracy,
        )
        suspicious = suspicious or geo_suspicious
    if not manual and require_geolocation:
        if location is None or lat is None or lng is None:
            raise HTTPException(status_code=422, detail="Geolocation is required for this mark")
        if not inside:
            raise HTTPException(status_code=422, detail="Mark is outside the location geofence")
        if accuracy is None or accuracy > MAX_ACCURACY_METERS:
            raise HTTPException(status_code=422, detail="Location accuracy is insufficient")
    elif (lat is not None or lng is not None) and location is None:
        suspicious = True

    photo_url = _payload_value(payload, "photo_url")
    liveness_passed = _payload_value(payload, "liveness_passed")
    face_match_score = _payload_value(payload, "face_match_score")
    if not manual and require_photo and (not photo_url or liveness_passed is not True):
        raise HTTPException(status_code=422, detail="Photo and liveness evidence are required for this mark")
    require_biometric_consent(employee.biometric_consent, has_biometric_data=bool(photo_url))
    if liveness_passed is not True or not photo_url:
        suspicious = True
    if offline:
        suspicious = True

    await _check_sequence(session, company_id=company_id, employee_id=employee.id, mark_type=mark_type, marked_at=effective_time)

    schedule = await _employee_schedule(
        session,
        company_id=company_id,
        employee_id=employee.id,
        local_date=effective_time.astimezone(company_timezone(company)).date(),
    )
    timezone = company_timezone(company)
    is_late, late_minutes, is_early, early_minutes = _evaluate_schedule(mark_type, effective_time, schedule, timezone)
    status = MarkStatus.MANUAL if manual else MarkStatus.SUSPICIOUS if suspicious else MarkStatus.VALID
    mark = AttendanceMark(
        company_id=company_id,
        employee_id=employee.id,
        location_id=location.id if location is not None else None,
        type=mark_type,
        source=_payload_value(payload, "source", MarkSource.WEB),
        marked_at=effective_time,
        server_at=now,
        lat=lat,
        lng=lng,
        accuracy_meters=accuracy,
        photo_url=photo_url,
        face_match_score=face_match_score,
        liveness_passed=liveness_passed,
        is_inside_geofence=inside,
        distance_to_location_meters=distance,
        is_late=is_late,
        late_minutes=late_minutes,
        is_early_leave=is_early,
        early_leave_minutes=early_minutes,
        status=status,
        comment=_payload_value(payload, "comment"),
    )
    _set_supported(mark, "idempotency_key", idempotency_key)
    _set_supported(mark, "client_event_id", _payload_value(payload, "client_event_id") or idempotency_key)
    _set_supported(mark, "idempotency_metadata", _payload_value(payload, "idempotency_metadata"))
    _set_supported(mark, "client_mark_id", _payload_value(payload, "client_mark_id"))
    _set_supported(mark, "is_offline", offline)
    _set_supported(mark, "captured_at", marked_at_value)
    session.add(mark)
    await flush_or_conflict(session, detail="Attendance mark conflicts with an existing record")
    await write_audit(
        session,
        action="manual_mark" if manual else "create_mark",
        entity_type="attendance_mark",
        entity_id=mark.id,
        company_id=company_id,
        user_id=user_id,
        metadata={
            "type": mark_type.value,
            "offline": offline,
            "idempotency_key": idempotency_key,
        },
    )
    await commit_or_conflict(session, detail="Attendance mark conflicts with an existing record")
    if idempotency_key is not None:
        _cache_put(cache_key, fingerprint, mark.id)
    loaded = await _load_mark(session, mark.id)
    if loaded is None:
        raise HTTPException(status_code=500, detail="Attendance mark could not be loaded")
    return loaded


def _fingerprint_key(fingerprint: tuple[Any, ...]) -> str:
    return "|".join("" if value is None else str(value) for value in fingerprint)


async def create_manual_mark(
    session: AsyncSession,
    *,
    company_id: UUID,
    user_id: UUID,
    mark_type: MarkType,
    payload: ManualMarkCreate,
) -> AttendanceMark:
    return await create_mark(
        session,
        company_id=company_id,
        user_id=user_id,
        mark_type=mark_type,
        payload=payload,
        employee_id=payload.employee_id,
        manual=True,
    )
