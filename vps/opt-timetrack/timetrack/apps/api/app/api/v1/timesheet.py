import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import company_scope, current_user, require_roles
from app.models import Role, User
from app.schemas.timesheet import TimesheetResponse
from app.services.audit_service import write_audit
from app.services.rbac import is_privileged
from app.services.tenant_service import (
    commit_or_conflict,
    ensure_employee_reference,
    resolve_employee_for_user,
)
from app.services.timesheet_export import render_timesheet_xlsx
from app.services.timesheet_service import build_timesheet

router = APIRouter()


async def _requested_employee_id(
    session: AsyncSession,
    *,
    user: User,
    company_id: UUID,
    requested_employee_id: str | None,
) -> UUID | None:
    if requested_employee_id is not None:
        try:
            employee_id = UUID(requested_employee_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="employee_id must be a UUID") from exc
        if not is_privileged(user.role):
            own = await resolve_employee_for_user(session, company_id=company_id, user_id=user.id)
            if employee_id != own.id:
                raise HTTPException(status_code=403, detail="Employee can only view their own timesheet")
            return own.id
        await ensure_employee_reference(session, company_id=company_id, employee_id=employee_id)
        return employee_id
    if not is_privileged(user.role):
        own = await resolve_employee_for_user(session, company_id=company_id, user_id=user.id)
        return own.id
    return None


@router.get("", response_model=TimesheetResponse)
async def timesheet(
    month: str = Query(..., min_length=7, max_length=7),
    employee_id: str | None = Query(default=None, min_length=36, max_length=36),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    target_employee_id = await _requested_employee_id(
        session,
        user=user,
        company_id=company_id,
        requested_employee_id=employee_id,
    )
    return await build_timesheet(
        session,
        company_id=company_id,
        month=month,
        employee_id=target_employee_id,
    )


@router.get("/export/xlsx")
async def export_xlsx(
    month: str = Query(..., min_length=7, max_length=7),
    employee_id: str | None = Query(default=None, min_length=36, max_length=36),
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    target_employee_id = await _requested_employee_id(
        session,
        user=user,
        company_id=company_id,
        requested_employee_id=employee_id,
    )
    data = await build_timesheet(
        session,
        company_id=company_id,
        month=month,
        employee_id=target_employee_id,
    )
    try:
        content = await asyncio.to_thread(render_timesheet_xlsx, data)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    await write_audit(
        session,
        action="export_timesheet",
        entity_type="timesheet",
        company_id=company_id,
        user_id=user.id,
        metadata={"month": month, "employee_id": str(target_employee_id) if target_employee_id else None},
    )
    await commit_or_conflict(session, "Timesheet export could not be audited")
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="timesheet-{month}.xlsx"'},
    )


@router.get("/export/pdf")
async def export_pdf(
    month: str = Query(..., min_length=7, max_length=7),
    user: User = Depends(current_user),
):
    company_scope(user)
    raise HTTPException(status_code=501, detail="PDF timesheet export is not implemented")


@router.get("/payroll", response_model=TimesheetResponse)
async def payroll(
    month: str = Query(..., min_length=7, max_length=7),
    employee_id: str | None = Query(default=None, min_length=36, max_length=36),
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    return await timesheet(month=month, employee_id=employee_id, user=user, session=session)
