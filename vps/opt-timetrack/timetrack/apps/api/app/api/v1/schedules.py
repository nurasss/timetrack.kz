from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import company_scope, current_user, require_roles
from app.models import EmployeeScheduleAssignment, Role, User, WorkSchedule
from app.schemas.schedule import ScheduleAssignmentIn, ScheduleIn, ScheduleOut, SchedulePatch
from app.services.audit_service import write_audit
from app.services.rbac import is_privileged
from app.services.tenant_service import (
    commit_or_conflict,
    ensure_employee_reference,
    ensure_schedule_reference,
    flush_or_conflict,
    resolve_employee_for_user,
)

router = APIRouter()


@router.get("", response_model=list[ScheduleOut])
async def list_schedules(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    query = select(WorkSchedule).where(WorkSchedule.company_id == company_id)
    if not is_privileged(user.role):
        employee = await resolve_employee_for_user(session, company_id=company_id, user_id=user.id)
        query = query.join(EmployeeScheduleAssignment, EmployeeScheduleAssignment.work_schedule_id == WorkSchedule.id).where(
            EmployeeScheduleAssignment.employee_id == employee.id
        )
    return (await session.scalars(query.order_by(WorkSchedule.name).limit(500)).unique()).all()


@router.post("", response_model=ScheduleOut)
async def create_schedule(
    payload: ScheduleIn,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    schedule = WorkSchedule(company_id=company_scope(user), **payload.model_dump())
    session.add(schedule)
    await flush_or_conflict(session, "Schedule conflicts with an existing record")
    await write_audit(
        session,
        action="create_schedule",
        entity_type="work_schedule",
        entity_id=schedule.id,
        company_id=schedule.company_id,
        user_id=user.id,
    )
    await commit_or_conflict(session, "Schedule conflicts with an existing record")
    return schedule


@router.get("/{schedule_id}", response_model=ScheduleOut)
async def get_schedule(
    schedule_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    schedule = await ensure_schedule_reference(session, company_id=company_id, schedule_id=schedule_id)
    if not is_privileged(user.role):
        employee = await resolve_employee_for_user(session, company_id=company_id, user_id=user.id)
        assigned = await session.scalar(
            select(EmployeeScheduleAssignment.id).where(
                EmployeeScheduleAssignment.employee_id == employee.id,
                EmployeeScheduleAssignment.work_schedule_id == schedule.id,
            )
        )
        if assigned is None:
            raise HTTPException(status_code=403, detail="Schedule is not assigned to the employee")
    return schedule


@router.patch("/{schedule_id}", response_model=ScheduleOut)
async def update_schedule(
    schedule_id: UUID,
    payload: SchedulePatch,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    schedule = await ensure_schedule_reference(session, company_id=company_id, schedule_id=schedule_id, lock=True)
    values = payload.model_dump(exclude_unset=True)
    merged = {
        "name": values.get("name", schedule.name),
        "start_time": values.get("start_time", schedule.start_time),
        "end_time": values.get("end_time", schedule.end_time),
        "lunch_start": values.get("lunch_start", schedule.lunch_start),
        "lunch_end": values.get("lunch_end", schedule.lunch_end),
        "days_of_week": values.get("days_of_week", schedule.days_of_week),
        "late_tolerance_minutes": values.get("late_tolerance_minutes", schedule.late_tolerance_minutes),
        "overtime_threshold_minutes": values.get(
            "overtime_threshold_minutes", schedule.overtime_threshold_minutes
        ),
    }
    validated = ScheduleIn.model_validate(merged)
    for key, value in validated.model_dump().items():
        setattr(schedule, key, value)
    await write_audit(
        session,
        action="update_schedule",
        entity_type="work_schedule",
        entity_id=schedule.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"fields": sorted(values)},
    )
    await commit_or_conflict(session, "Schedule conflicts with an existing record")
    return schedule


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: UUID,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    schedule = await ensure_schedule_reference(session, company_id=company_id, schedule_id=schedule_id, lock=True)
    await session.delete(schedule)
    await write_audit(
        session,
        action="delete_schedule",
        entity_type="work_schedule",
        entity_id=schedule.id,
        company_id=company_id,
        user_id=user.id,
    )
    await commit_or_conflict(session, "Schedule is still assigned or conflicts with existing data")
    return {"ok": True}


@router.post("/{schedule_id}/assign")
async def assign_schedule(
    schedule_id: UUID,
    payload: ScheduleAssignmentIn,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    schedule = await ensure_schedule_reference(session, company_id=company_id, schedule_id=schedule_id, lock=True)
    employee = await ensure_employee_reference(
        session,
        company_id=company_id,
        employee_id=payload.employee_id,
        lock=True,
    )
    end_condition = (
        EmployeeScheduleAssignment.valid_from <= payload.valid_to
        if payload.valid_to is not None
        else EmployeeScheduleAssignment.id.is_not(None)
    )
    overlap = await session.scalar(
        select(EmployeeScheduleAssignment.id).where(
            EmployeeScheduleAssignment.employee_id == employee.id,
            end_condition,
            or_(
                EmployeeScheduleAssignment.valid_to.is_(None),
                EmployeeScheduleAssignment.valid_to >= payload.valid_from,
            ),
        )
    )
    if overlap is not None:
        raise HTTPException(status_code=409, detail="Employee schedule assignments cannot overlap")
    assignment = EmployeeScheduleAssignment(
        employee_id=employee.id,
        work_schedule_id=schedule.id,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
    )
    session.add(assignment)
    await flush_or_conflict(session, "Schedule conflicts with an existing record")
    await write_audit(
        session,
        action="assign_schedule",
        entity_type="employee_schedule_assignment",
        entity_id=assignment.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"schedule_id": str(schedule.id), "employee_id": str(employee.id)},
    )
    await commit_or_conflict(session, "Schedule assignment conflicts with an existing assignment")
    return {"ok": True, "id": str(assignment.id)}
