from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.deps import company_scope, current_user, require_roles
from app.models import AttendanceMark, Company, Location, MarkStatus, MarkType, Role, User
from app.schemas.attendance import ManualMarkCreate, MarkOut, SelfMarkCreate
from app.services.attendance_service import create_manual_mark, create_mark
from app.services.audit_service import write_audit
from app.services.rbac import is_privileged
from app.services.tenant_service import commit_or_conflict, resolve_employee_for_user
from app.services.timezone_service import company_timezone

router = APIRouter()


def serialize_mark(mark: AttendanceMark) -> MarkOut:
    employee = getattr(mark, "employee", None)
    location = getattr(mark, "location", None)
    return MarkOut(
        id=mark.id,
        company_id=mark.company_id,
        employee_id=mark.employee_id,
        employee=employee.full_name if employee else None,
        location_id=mark.location_id,
        location=location.name if location else None,
        type=mark.type,
        source=mark.source,
        marked_at=mark.marked_at,
        server_at=mark.server_at,
        accuracy_meters=float(mark.accuracy_meters) if mark.accuracy_meters is not None else None,
        lat=float(mark.lat) if mark.lat is not None else None,
        lng=float(mark.lng) if mark.lng is not None else None,
        photo_url=mark.photo_url,
        face_match_score=float(mark.face_match_score) if mark.face_match_score is not None else None,
        liveness_passed=mark.liveness_passed,
        is_inside_geofence=mark.is_inside_geofence,
        distance_to_location_meters=(
            float(mark.distance_to_location_meters) if mark.distance_to_location_meters is not None else None
        ),
        is_late=mark.is_late,
        late_minutes=mark.late_minutes,
        is_early_leave=mark.is_early_leave,
        early_leave_minutes=mark.early_leave_minutes,
        status=mark.status,
    )


async def _mark_query(session: AsyncSession, company_id: UUID, mark_id: UUID, *, lock: bool = False):
    query = (
        select(AttendanceMark)
        .options(selectinload(AttendanceMark.employee), selectinload(AttendanceMark.location))
        .where(AttendanceMark.id == mark_id, AttendanceMark.company_id == company_id)
    )
    if lock:
        query = query.with_for_update()
    return await session.scalar(query)


@router.get("", response_model=list[MarkOut])
async def list_marks(
    employee_id: UUID | None = None,
    location_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    mark_type: MarkType | None = Query(default=None, alias="type"),
    status: MarkStatus | None = None,
    page: int = Query(1, ge=1, le=10000),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    company = await session.scalar(select(Company).where(Company.id == company_id))
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    timezone = company_timezone(company)
    now = datetime.now(UTC)
    if date_from is None:
        date_from = now.astimezone(timezone).date() - timedelta(days=30)
    if date_to is None:
        date_to = now.astimezone(timezone).date()
    if any(value.year < 1900 or value.year > 2200 for value in (date_from, date_to)):
        raise HTTPException(status_code=422, detail="date range is outside the supported range")
    if date_to < date_from or (date_to - date_from).days > 366:
        raise HTTPException(status_code=422, detail="date range is invalid or too large")
    if not is_privileged(user.role):
        own_employee = await resolve_employee_for_user(session, company_id=company_id, user_id=user.id)
        if employee_id is not None and employee_id != own_employee.id:
            raise HTTPException(status_code=403, detail="Employee can only view their own marks")
        employee_id = own_employee.id
    if location_id is not None:
        location = await session.scalar(
            select(Location).where(Location.id == location_id, Location.company_id == company_id)
        )
        if location is None:
            raise HTTPException(status_code=404, detail="Location not found")
    start = datetime.combine(date_from, time.min, tzinfo=timezone).astimezone(UTC)
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone).astimezone(UTC)
    query = (
        select(AttendanceMark)
        .options(selectinload(AttendanceMark.employee), selectinload(AttendanceMark.location))
        .where(
            AttendanceMark.company_id == company_id,
            AttendanceMark.marked_at >= start,
            AttendanceMark.marked_at < end,
        )
    )
    if employee_id is not None:
        query = query.where(AttendanceMark.employee_id == employee_id)
    if location_id is not None:
        query = query.where(AttendanceMark.location_id == location_id)
    if mark_type is not None:
        query = query.where(AttendanceMark.type == mark_type)
    if status is not None:
        query = query.where(AttendanceMark.status == status)
    marks = (
        await session.scalars(query.order_by(desc(AttendanceMark.marked_at)).offset((page - 1) * limit).limit(limit))
    ).all()
    return [serialize_mark(mark) for mark in marks]


async def _validate_self_employee_id(
    session: AsyncSession,
    *,
    company_id: UUID,
    user: User,
    requested_employee_id: UUID | None,
) -> None:
    if requested_employee_id is None:
        return
    employee = await resolve_employee_for_user(session, company_id=company_id, user_id=user.id)
    if requested_employee_id != employee.id:
        raise HTTPException(status_code=403, detail="Employee cannot mark attendance for another employee")


@router.post("/check-in", response_model=MarkOut)
async def check_in(
    payload: SelfMarkCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    await _validate_self_employee_id(
        session,
        company_id=company_id,
        user=user,
        requested_employee_id=payload.employee_id,
    )
    mark = await create_mark(
        session,
        company_id=company_id,
        user_id=user.id,
        mark_type=MarkType.CHECK_IN,
        payload=payload,
    )
    return serialize_mark(mark)


@router.post("/check-out", response_model=MarkOut)
async def check_out(
    payload: SelfMarkCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    await _validate_self_employee_id(
        session,
        company_id=company_id,
        user=user,
        requested_employee_id=payload.employee_id,
    )
    mark = await create_mark(
        session,
        company_id=company_id,
        user_id=user.id,
        mark_type=MarkType.CHECK_OUT,
        payload=payload,
    )
    return serialize_mark(mark)


@router.post("/manual", response_model=MarkOut)
async def manual_mark(
    payload: ManualMarkCreate,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    mark = await create_manual_mark(
        session,
        company_id=company_scope(user),
        user_id=user.id,
        mark_type=payload.type,
        payload=payload,
    )
    return serialize_mark(mark)


@router.get("/{mark_id}", response_model=MarkOut)
async def get_mark(
    mark_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    mark = await _mark_query(session, company_id, mark_id)
    if mark is None:
        raise HTTPException(status_code=404, detail="Mark not found")
    if not is_privileged(user.role) and (mark.employee is None or mark.employee.user_id != user.id):
        raise HTTPException(status_code=403, detail="Employee can only view their own marks")
    return serialize_mark(mark)


@router.post("/{mark_id}/approve", response_model=MarkOut)
@router.patch("/{mark_id}/approve", response_model=MarkOut)
async def approve_mark(
    mark_id: UUID,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    mark = await _mark_query(session, company_id, mark_id, lock=True)
    if mark is None:
        raise HTTPException(status_code=404, detail="Mark not found")
    if mark.status not in {MarkStatus.SUSPICIOUS, MarkStatus.MANUAL}:
        raise HTTPException(status_code=409, detail="Only suspicious or manual marks can be approved")
    previous_status = mark.status
    mark.status = MarkStatus.VALID
    await write_audit(
        session,
        action="approve_mark",
        entity_type="attendance_mark",
        entity_id=mark.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"from": previous_status.value, "to": "VALID"},
    )
    await commit_or_conflict(session, "Mark could not be approved")
    refreshed = await _mark_query(session, company_id, mark_id)
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Mark not found")
    return serialize_mark(refreshed)


@router.post("/{mark_id}/reject", response_model=MarkOut)
@router.patch("/{mark_id}/reject", response_model=MarkOut)
async def reject_mark(
    mark_id: UUID,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    mark = await _mark_query(session, company_id, mark_id, lock=True)
    if mark is None:
        raise HTTPException(status_code=404, detail="Mark not found")
    if mark.status == MarkStatus.REJECTED:
        raise HTTPException(status_code=409, detail="Mark is already rejected")
    previous_status = mark.status
    mark.status = MarkStatus.REJECTED
    await write_audit(
        session,
        action="reject_mark",
        entity_type="attendance_mark",
        entity_id=mark.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"from": previous_status.value, "to": "REJECTED"},
    )
    await commit_or_conflict(session, "Mark could not be rejected")
    refreshed = await _mark_query(session, company_id, mark_id)
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Mark not found")
    return serialize_mark(refreshed)
