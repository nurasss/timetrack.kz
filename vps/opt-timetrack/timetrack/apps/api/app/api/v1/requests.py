from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.deps import company_scope, current_user, require_roles
from app.models import Employee, LeaveRequest, LeaveStatus, LeaveType, Role, User
from app.schemas.leave_request import LeaveRequestIn, LeaveRequestOut, RejectRequest
from app.services.audit_service import write_audit
from app.services.leave_rules import LeaveTransitionError, has_overlapping_request, validate_leave_transition
from app.services.rbac import is_privileged
from app.services.tenant_service import (
    commit_or_conflict,
    ensure_employee_reference,
    flush_or_conflict,
    resolve_employee_for_user,
)

router = APIRouter()


def serialize_request(request: LeaveRequest) -> LeaveRequestOut:
    employee = getattr(request, "employee", None)
    return LeaveRequestOut(
        id=request.id,
        company_id=request.company_id,
        employee_id=request.employee_id,
        employee=employee.full_name if employee else None,
        approver_id=request.approver_id,
        type=request.type,
        start_date=request.start_date,
        end_date=request.end_date,
        comment=request.comment,
        status=request.status,
        approved_at=request.approved_at,
        rejected_at=request.rejected_at,
        reject_reason=request.reject_reason,
    )


async def _load_request(session: AsyncSession, company_id: UUID, request_id: UUID, *, lock: bool = False):
    query = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.employee))
        .where(LeaveRequest.id == request_id, LeaveRequest.company_id == company_id)
    )
    if lock:
        query = query.with_for_update()
    return await session.scalar(query)


async def _target_employee(
    session: AsyncSession,
    *,
    company_id: UUID,
    user: User,
    requested_employee_id: UUID | None,
    lock: bool = False,
) -> Employee:
    if is_privileged(user.role):
        if requested_employee_id is None:
            raise HTTPException(status_code=422, detail="employee_id is required for privileged requests")
        return await ensure_employee_reference(
            session,
            company_id=company_id,
            employee_id=requested_employee_id,
            lock=lock,
        )
    employee = await resolve_employee_for_user(session, company_id=company_id, user_id=user.id, lock=lock)
    if requested_employee_id is not None and requested_employee_id != employee.id:
        raise HTTPException(status_code=403, detail="Employee can only create requests for themselves")
    return employee


async def _assert_no_overlap(
    session: AsyncSession,
    *,
    employee: Employee,
    start_date: date,
    end_date: date,
    exclude_id: UUID | None = None,
) -> None:
    requests = (
        await session.scalars(
            select(LeaveRequest)
            .where(
                LeaveRequest.employee_id == employee.id,
                LeaveRequest.start_date <= end_date,
                LeaveRequest.end_date >= start_date,
                LeaveRequest.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
            )
            .with_for_update()
        )
    ).all()
    if has_overlapping_request(list(requests), start_date, end_date, exclude_id=exclude_id):
        raise HTTPException(status_code=409, detail="Leave request overlaps an existing request")


async def _transition(
    request: LeaveRequest,
    target: LeaveStatus,
) -> None:
    try:
        validate_leave_transition(request.status, target)
    except LeaveTransitionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("", response_model=list[LeaveRequestOut])
async def list_requests(
    employee_id: UUID | None = None,
    status: LeaveStatus | None = None,
    request_type: LeaveType | None = Query(default=None, alias="type"),
    page: int = Query(1, ge=1, le=10000),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    if not is_privileged(user.role):
        own_employee = await resolve_employee_for_user(session, company_id=company_id, user_id=user.id)
        if employee_id is not None and employee_id != own_employee.id:
            raise HTTPException(status_code=403, detail="Employee can only view their own requests")
        employee_id = own_employee.id
    elif employee_id is not None:
        await ensure_employee_reference(session, company_id=company_id, employee_id=employee_id)
    query = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.employee))
        .where(LeaveRequest.company_id == company_id)
    )
    if employee_id is not None:
        query = query.where(LeaveRequest.employee_id == employee_id)
    if status is not None:
        query = query.where(LeaveRequest.status == status)
    if request_type is not None:
        query = query.where(LeaveRequest.type == request_type)
    requests = (
        await session.scalars(
            query.order_by(LeaveRequest.created_at.desc()).offset((page - 1) * limit).limit(limit)
        )
    ).all()
    return [serialize_request(item) for item in requests]


@router.post("", response_model=LeaveRequestOut)
async def create_request(
    payload: LeaveRequestIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    employee = await _target_employee(
        session,
        company_id=company_id,
        user=user,
        requested_employee_id=payload.employee_id,
        lock=True,
    )
    await _assert_no_overlap(
        session,
        employee=employee,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    request = LeaveRequest(
        company_id=company_id,
        employee_id=employee.id,
        type=payload.type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        comment=payload.comment,
        status=LeaveStatus.PENDING,
    )
    session.add(request)
    await flush_or_conflict(session, "Leave request conflicts with an existing record")
    await write_audit(
        session,
        action="create_request",
        entity_type="leave_request",
        entity_id=request.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"from": None, "to": LeaveStatus.PENDING.value},
    )
    await commit_or_conflict(session, "Leave request conflicts with an existing record")
    request.employee = employee
    return serialize_request(request)


@router.get("/{request_id}", response_model=LeaveRequestOut)
async def get_request(
    request_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    request = await _load_request(session, company_id, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if not is_privileged(user.role) and (request.employee is None or request.employee.user_id != user.id):
        raise HTTPException(status_code=403, detail="Employee can only view their own requests")
    return serialize_request(request)


async def _load_for_transition(
    session: AsyncSession,
    *,
    company_id: UUID,
    request_id: UUID,
) -> LeaveRequest:
    request = await _load_request(session, company_id, request_id, lock=True)
    if request is None or request.employee is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return request


@router.post("/{request_id}/approve", response_model=LeaveRequestOut)
@router.patch("/{request_id}/approve", response_model=LeaveRequestOut)
async def approve_request(
    request_id: UUID,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    request = await _load_for_transition(session, company_id=company_id, request_id=request_id)
    if request.employee.user_id == user.id:
        raise HTTPException(status_code=403, detail="Self-approval is not allowed")
    await _transition(request, LeaveStatus.APPROVED)
    await _assert_no_overlap(
        session,
        employee=request.employee,
        start_date=request.start_date,
        end_date=request.end_date,
        exclude_id=request.id,
    )
    previous_status = request.status
    request.status = LeaveStatus.APPROVED
    request.approver_id = user.id
    request.approved_at = datetime.now(UTC)
    await write_audit(
        session,
        action="approve_request",
        entity_type="leave_request",
        entity_id=request.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"from": previous_status.value, "to": LeaveStatus.APPROVED.value},
    )
    await commit_or_conflict(session, "Leave request could not be approved")
    return serialize_request(request)


@router.post("/{request_id}/reject", response_model=LeaveRequestOut)
@router.patch("/{request_id}/reject", response_model=LeaveRequestOut)
async def reject_request(
    request_id: UUID,
    payload: RejectRequest,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    request = await _load_for_transition(session, company_id=company_id, request_id=request_id)
    if request.employee.user_id == user.id:
        raise HTTPException(status_code=403, detail="Self-approval is not allowed")
    await _transition(request, LeaveStatus.REJECTED)
    previous_status = request.status
    request.status = LeaveStatus.REJECTED
    request.approver_id = user.id
    request.rejected_at = datetime.now(UTC)
    request.reject_reason = payload.reason
    await write_audit(
        session,
        action="reject_request",
        entity_type="leave_request",
        entity_id=request.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"from": previous_status.value, "to": LeaveStatus.REJECTED.value},
    )
    await commit_or_conflict(session, "Leave request could not be rejected")
    return serialize_request(request)


@router.delete("/{request_id}")
@router.patch("/{request_id}/cancel")
async def cancel_request(
    request_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    request = await _load_for_transition(session, company_id=company_id, request_id=request_id)
    if not is_privileged(user.role) and request.employee.user_id != user.id:
        raise HTTPException(status_code=403, detail="Employee can only cancel their own requests")
    await _transition(request, LeaveStatus.CANCELLED)
    previous_status = request.status
    request.status = LeaveStatus.CANCELLED
    await write_audit(
        session,
        action="cancel_request",
        entity_type="leave_request",
        entity_id=request.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"from": previous_status.value, "to": LeaveStatus.CANCELLED.value},
    )
    await commit_or_conflict(session, "Leave request could not be cancelled")
    return {"ok": True, "id": str(request.id)}
