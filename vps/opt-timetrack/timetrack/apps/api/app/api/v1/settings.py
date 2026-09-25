from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import company_scope, require_roles
from app.models import Company, Role, User
from app.schemas.settings import SettingsPatch, SettingsPayload
from app.services.audit_service import write_audit
from app.services.tenant_service import commit_or_conflict

router = APIRouter()
_SETTING_FIELDS = set(SettingsPayload.model_fields)


@router.get("", response_model=SettingsPayload)
async def get_settings(
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company = await session.scalar(select(Company).where(Company.id == company_scope(user)))
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    values = {key: value for key, value in (company.settings or {}).items() if key in _SETTING_FIELDS}
    try:
        return SettingsPayload.model_validate(values)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Stored company settings are invalid") from exc


@router.patch("", response_model=SettingsPayload)
async def update_settings(
    payload: SettingsPatch,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company = await session.scalar(select(Company).where(Company.id == company_scope(user)))
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    current = dict(company.settings or {})
    current.update(payload.model_dump(exclude_unset=True))
    try:
        validated = SettingsPayload.model_validate(
            {key: value for key, value in current.items() if key in _SETTING_FIELDS}
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Company settings are invalid") from exc
    company.settings = {**current, **validated.model_dump()}
    if "timezone" in payload.model_fields_set:
        company.timezone = validated.timezone
    await write_audit(
        session,
        action="update_settings",
        entity_type="settings",
        company_id=company.id,
        user_id=user.id,
        metadata={"fields": sorted(payload.model_dump(exclude_unset=True))},
    )
    await commit_or_conflict(session, "Settings could not be saved")
    return validated
