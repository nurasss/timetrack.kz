from collections.abc import Mapping
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Department, Employee, Location, Position, User, WorkSchedule


async def flush_or_conflict(session: AsyncSession, detail: str = "Resource conflict") -> None:
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=detail) from exc


async def commit_or_conflict(session: AsyncSession, detail: str = "Resource conflict") -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=detail) from exc


async def ensure_company_reference(
    session: AsyncSession,
    model: type,
    object_id: UUID | None,
    company_id: UUID,
    label: str,
    *,
    lock: bool = False,
):
    if object_id is None:
        return None
    query = select(model).where(model.id == object_id, model.company_id == company_id)
    if lock:
        query = query.with_for_update()
    instance = await session.scalar(query)
    if instance is None:
        raise HTTPException(status_code=400, detail=f"{label} does not belong to the company")
    return instance


def validate_unique_employee_binding(
    existing_employee_id: UUID | None,
    *,
    user_id: UUID,
    employee_id: UUID | None = None,
) -> None:
    if existing_employee_id is not None and existing_employee_id != employee_id:
        raise HTTPException(status_code=409, detail="User is already bound to another employee")


def validate_manager_reference(employee_id: UUID | None, manager_id: UUID | None) -> None:
    if employee_id is not None and manager_id == employee_id:
        raise HTTPException(status_code=400, detail="Employee cannot be their own manager")


async def validate_employee_references(
    session: AsyncSession,
    *,
    company_id: UUID,
    values: Mapping[str, object],
    employee_id: UUID | None = None,
) -> None:
    department_id = values.get("department_id")
    position_id = values.get("position_id")
    manager_id = values.get("manager_id")
    user_id = values.get("user_id")

    await ensure_company_reference(session, Department, department_id if isinstance(department_id, UUID) else None, company_id, "Department")
    position = await ensure_company_reference(
        session,
        Position,
        position_id if isinstance(position_id, UUID) else None,
        company_id,
        "Position",
    )
    manager = await ensure_company_reference(
        session,
        Employee,
        manager_id if isinstance(manager_id, UUID) else None,
        company_id,
        "Manager",
    )
    if manager is not None:
        validate_manager_reference(employee_id, manager.id)

    if (
        isinstance(position, Position)
        and isinstance(department_id, UUID)
        and position.department_id is not None
        and position.department_id != department_id
    ):
        raise HTTPException(status_code=400, detail="Position does not belong to the selected department")

    if isinstance(user_id, UUID):
        user = await session.scalar(
            select(User).where(User.id == user_id, User.company_id == company_id).with_for_update()
        )
        if user is None:
            raise HTTPException(status_code=400, detail="User does not belong to the company")
        existing = await session.scalar(
            select(Employee)
            .options(selectinload(Employee.department), selectinload(Employee.position))
            .where(Employee.company_id == company_id, Employee.user_id == user_id)
            .with_for_update()
        )
        validate_unique_employee_binding(
            existing.id if existing is not None else None,
            user_id=user_id,
            employee_id=employee_id,
        )

    if isinstance(manager_id, UUID) and employee_id is not None:
        await _ensure_manager_chain_has_no_cycle(session, company_id=company_id, employee_id=employee_id, manager_id=manager_id)


async def _ensure_manager_chain_has_no_cycle(
    session: AsyncSession,
    *,
    company_id: UUID,
    employee_id: UUID,
    manager_id: UUID,
) -> None:
    current_id = manager_id
    seen: set[UUID] = set()
    while current_id is not None:
        if current_id == employee_id or current_id in seen:
            raise HTTPException(status_code=400, detail="Manager relationship contains a cycle")
        seen.add(current_id)
        current_id = await session.scalar(
            select(Employee.manager_id).where(Employee.id == current_id, Employee.company_id == company_id)
        )


async def resolve_employee_for_user(
    session: AsyncSession,
    *,
    company_id: UUID,
    user_id: UUID,
    lock: bool = False,
) -> Employee:
    query = (
        select(Employee)
        .options(selectinload(Employee.department), selectinload(Employee.position))
        .where(Employee.company_id == company_id, Employee.user_id == user_id)
    )
    if lock:
        query = query.with_for_update()
    employee = await session.scalar(query)
    if employee is None:
        raise HTTPException(status_code=403, detail="Employee profile is not linked to the authenticated user")
    return employee


async def ensure_employee_reference(
    session: AsyncSession,
    *,
    company_id: UUID,
    employee_id: UUID,
    lock: bool = False,
) -> Employee:
    query = (
        select(Employee)
        .options(selectinload(Employee.department), selectinload(Employee.position))
        .where(Employee.id == employee_id, Employee.company_id == company_id)
    )
    if lock:
        query = query.with_for_update()
    employee = await session.scalar(query)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


async def ensure_location_reference(
    session: AsyncSession,
    *,
    company_id: UUID,
    location_id: UUID,
    active: bool = False,
    lock: bool = False,
) -> Location:
    query = select(Location).where(Location.id == location_id, Location.company_id == company_id)
    if active:
        query = query.where(Location.is_active.is_(True))
    if lock:
        query = query.with_for_update()
    location = await session.scalar(query)
    if location is None:
        detail = "Active location not found" if active else "Location not found"
        raise HTTPException(status_code=400 if active else 404, detail=detail)
    return location


async def ensure_schedule_reference(
    session: AsyncSession,
    *,
    company_id: UUID,
    schedule_id: UUID,
    lock: bool = False,
) -> WorkSchedule:
    query = select(WorkSchedule).where(WorkSchedule.id == schedule_id, WorkSchedule.company_id == company_id)
    if lock:
        query = query.with_for_update()
    schedule = await session.scalar(query)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule
