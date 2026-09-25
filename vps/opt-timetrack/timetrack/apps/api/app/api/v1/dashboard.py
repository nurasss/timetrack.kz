from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import company_scope, require_roles
from app.models import Role, User
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import dashboard_summary

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def summary(
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    return await dashboard_summary(session, company_id=company_scope(user))
