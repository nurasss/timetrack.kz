from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.deps import company_scope, current_user, require_roles
from app.models import Department, Employee, EmploymentStatus, Position, Role, User
from app.schemas.employee import EmployeeIn, EmployeeOut, EmployeePatch, EmployeesPage
from app.services.audit_service import write_audit
from app.services.consent_service import normalize_consent, require_biometric_consent
from app.services.rbac import is_privileged
from app.services.tenant_service import (
    commit_or_conflict,
    ensure_employee_reference,
    validate_employee_references,
)

router = APIRouter()


def serialize_employee(employee: Employee) -> EmployeeOut:
    department = getattr(employee, "department", None)
    position = getattr(employee, "position", None)
    return EmployeeOut(
        id=employee.id,
        company_id=employee.company_id,
        user_id=employee.user_id,
        full_name=employee.full_name,
        department_id=employee.department_id,
        position_id=employee.position_id,
        manager_id=employee.manager_id,
        department=department.name if department else None,
        position=position.name if position else None,
        status=employee.employment_status,
        employee_code=employee.employee_code,
        phone=employee.phone,
        email=employee.email,
        avatar_url=employee.avatar_url,
        biometric_consent=employee.biometric_consent,
        hired_at=employee.hired_at,
        fired_at=employee.fired_at,
    )


async def _load_employee(session: AsyncSession, company_id: UUID, employee_id: UUID, *, lock: bool = False) -> Employee:
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


async def _flush_or_conflict(session: AsyncSession, detail: str) -> None:
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail=detail) from exc


def _normalize_biometric_consent(values: dict) -> None:
    if "biometric_consent" not in values:
        return
    normalized = normalize_consent(values["biometric_consent"])
    if values["biometric_consent"] is not None and normalized is None:
        raise HTTPException(status_code=422, detail="Biometric consent record is invalid")
    values["biometric_consent"] = normalized


async def _resolve_position_name(session: AsyncSession, company_id: UUID, values: dict) -> None:
    position_name = values.pop("position_name", None)
    if position_name is None:
        return
    if values.get("position_id") is not None:
        raise HTTPException(status_code=422, detail="Specify position_id or position_name, not both")
    name = position_name.strip()
    position = await session.scalar(
        select(Position).where(Position.company_id == company_id, func.lower(Position.name) == name.lower())
    )
    if position is None:
        position = Position(company_id=company_id, name=name, department_id=values.get("department_id"))
        session.add(position)
        await _flush_or_conflict(session, "Position could not be created")
    values["position_id"] = position.id


@router.get("", response_model=EmployeesPage)
async def list_employees(
    search: str | None = Query(default=None, max_length=100),
    department_id: UUID | None = None,
    status: EmploymentStatus | None = None,
    page: int = Query(1, ge=1, le=10000),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    query = (
        select(Employee)
        .options(selectinload(Employee.department), selectinload(Employee.position))
        .where(Employee.company_id == company_id)
    )
    count_query = select(func.count(Employee.id)).where(Employee.company_id == company_id)
    if department_id is not None:
        department = await session.scalar(
            select(Department).where(Department.id == department_id, Department.company_id == company_id)
        )
        if department is None:
            raise HTTPException(status_code=404, detail="Department not found")
        query = query.where(Employee.department_id == department_id)
        count_query = count_query.where(Employee.department_id == department_id)
    if status is not None:
        query = query.where(Employee.employment_status == status)
        count_query = count_query.where(Employee.employment_status == status)
    if search:
        normalized = search.strip()
        condition = or_(
            Employee.full_name.ilike(f"%{normalized}%"),
            Employee.email.ilike(f"%{normalized}%"),
            Employee.employee_code.ilike(f"%{normalized}%"),
        )
        query = query.where(condition)
        count_query = count_query.where(condition)
    items = (
        await session.scalars(query.order_by(Employee.full_name).offset((page - 1) * limit).limit(limit))
    ).all()
    return EmployeesPage(
        items=[serialize_employee(item) for item in items],
        total=await session.scalar(count_query) or 0,
        page=page,
        limit=limit,
    )


@router.post("", response_model=EmployeeOut)
async def create_employee(
    payload: EmployeeIn,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    values = payload.model_dump()
    _normalize_biometric_consent(values)
    require_biometric_consent(values.get("biometric_consent"), has_biometric_data=values.get("avatar_url") is not None)
    await _resolve_position_name(session, company_id, values)
    await validate_employee_references(session, company_id=company_id, values=values)
    if (
        values.get("fired_at") is not None
        and values.get("hired_at") is not None
        and values["fired_at"] < values["hired_at"]
    ):
        raise HTTPException(status_code=400, detail="fired_at cannot be before hired_at")
    employee = Employee(company_id=company_id, **values)
    session.add(employee)
    await _flush_or_conflict(session, "Employee conflicts with an existing binding")
    await write_audit(
        session,
        action="create_employee",
        entity_type="employee",
        entity_id=employee.id,
        company_id=company_id,
        user_id=user.id,
    )
    await commit_or_conflict(session, "Employee conflicts with an existing binding")
    return serialize_employee(await _load_employee(session, company_id, employee.id))


@router.get("/me", response_model=EmployeeOut)
async def get_current_employee(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    employee = await session.scalar(
        select(Employee)
        .options(selectinload(Employee.department), selectinload(Employee.position))
        .where(Employee.company_id == company_id, Employee.user_id == user.id)
    )
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    return serialize_employee(employee)


@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(
    employee_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    employee = await _load_employee(session, company_id, employee_id)
    if not is_privileged(user.role) and employee.user_id != user.id:
        raise HTTPException(status_code=403, detail="Employee can only view their own profile")
    return serialize_employee(employee)


@router.patch("/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: UUID,
    payload: EmployeePatch,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    employee = await _load_employee(session, company_id, employee_id, lock=True)
    values = payload.model_dump(exclude_unset=True)
    _normalize_biometric_consent(values)
    await _resolve_position_name(session, company_id, values)
    await validate_employee_references(
        session,
        company_id=company_id,
        values=values,
        employee_id=employee.id,
    )
    hired_at = values.get("hired_at", employee.hired_at)
    fired_at = values.get("fired_at", employee.fired_at)
    if hired_at is not None and fired_at is not None and fired_at < hired_at:
        raise HTTPException(status_code=400, detail="fired_at cannot be before hired_at")
    changed = sorted(values)
    for key, value in values.items():
        setattr(employee, key, value)
    require_biometric_consent(employee.biometric_consent, has_biometric_data=employee.avatar_url is not None)
    await _flush_or_conflict(session, "Employee conflicts with an existing binding")
    await write_audit(
        session,
        action="update_employee",
        entity_type="employee",
        entity_id=employee.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"fields": changed},
    )
    await commit_or_conflict(session, "Employee conflicts with an existing binding")
    return serialize_employee(await _load_employee(session, company_id, employee.id))


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: UUID,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    employee = await _load_employee(session, company_id, employee_id, lock=True)
    employee.employment_status = EmploymentStatus.FIRED
    employee.fired_at = datetime.now(UTC).date()
    await write_audit(
        session,
        action="delete_employee",
        entity_type="employee",
        entity_id=employee.id,
        company_id=company_id,
        user_id=user.id,
    )
    await commit_or_conflict(session, "Employee could not be deactivated")
    return {"ok": True}


@router.post("/import")
async def import_employees(
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
):
    raise HTTPException(status_code=501, detail="Employee import is not implemented")


@router.post("/{employee_id}/avatar")
async def upload_avatar(
    employee_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    employee = await ensure_employee_reference(session, company_id=company_id, employee_id=employee_id)
    if not is_privileged(user.role) and employee.user_id != user.id:
        raise HTTPException(status_code=403, detail="Employee can only update their own avatar")
    raise HTTPException(status_code=501, detail="Avatar upload is not implemented")
