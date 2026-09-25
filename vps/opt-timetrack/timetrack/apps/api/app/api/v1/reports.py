from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import company_scope, require_roles
from app.models import Role, User
from app.services.dashboard_service import dashboard_summary

router = APIRouter()


@router.get("/attendance")
async def attendance_report(
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    return await dashboard_summary(session, company_id=company_scope(user))


@router.get("/export/xlsx")
async def export_xlsx(
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
):
    raise HTTPException(status_code=501, detail="XLSX report export is not implemented")


@router.get("/export/pdf")
async def export_pdf(
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
):
    raise HTTPException(status_code=501, detail="PDF report export is not implemented")


@router.get("/{name}")
async def generic_report(
    name: str = Path(..., min_length=1, max_length=64),
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
):
    raise HTTPException(status_code=501, detail=f"Report '{name}' is not implemented")
