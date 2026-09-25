from datetime import UTC, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import company_scope, require_roles
from app.models import AttendanceMark, Company, Employee, LeaveRequest, LeaveStatus, Location, Role, User
from app.schemas.company import CompanyOut, CompanyStats, CompanyUpdate
from app.services.audit_service import write_audit
from app.services.timezone_service import company_timezone

router = APIRouter()


@router.get("/me", response_model=CompanyOut)
async def get_company(user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)), session: AsyncSession = Depends(get_session)):
    return await session.get(Company, company_scope(user))


@router.patch("/me", response_model=CompanyOut)
async def update_company(payload: CompanyUpdate, user: User = Depends(require_roles(Role.COMPANY_ADMIN)), session: AsyncSession = Depends(get_session)):
    company = await session.get(Company, company_scope(user))
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, key, value)
    await write_audit(session, action="update_settings", entity_type="company", company_id=company.id, user_id=user.id)
    await session.commit()
    await session.refresh(company)
    return company


@router.get("/stats", response_model=CompanyStats)
async def stats(user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)), session: AsyncSession = Depends(get_session)):
    company_id = company_scope(user)
    company = await session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    timezone = company_timezone(company)
    today = datetime.now(UTC).astimezone(timezone).date()
    start = datetime.combine(today, time.min, tzinfo=timezone).astimezone(UTC)
    end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone).astimezone(UTC)
    return CompanyStats(
        employees=await session.scalar(select(func.count(Employee.id)).where(Employee.company_id == company_id)) or 0,
        locations=await session.scalar(select(func.count(Location.id)).where(Location.company_id == company_id)) or 0,
        marks_today=await session.scalar(
            select(func.count(AttendanceMark.id)).where(AttendanceMark.company_id == company_id, AttendanceMark.marked_at >= start, AttendanceMark.marked_at < end)
        )
        or 0,
        pending_requests=await session.scalar(
            select(func.count(LeaveRequest.id)).where(LeaveRequest.company_id == company_id, LeaveRequest.status == LeaveStatus.PENDING)
        )
        or 0,
    )
