from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import company_scope, current_user, require_roles
from app.models import Location, Role, User
from app.schemas.location import LocationIn, LocationOut, LocationPatch
from app.services.audit_service import write_audit
from app.services.rbac import is_privileged
from app.services.tenant_service import commit_or_conflict, flush_or_conflict

router = APIRouter()


@router.get("", response_model=list[LocationOut])
async def list_locations(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    query = select(Location).where(Location.company_id == company_scope(user))
    if not is_privileged(user.role):
        query = query.where(Location.is_active.is_(True))
    return (await session.scalars(query.order_by(Location.name).limit(500))).all()


@router.post("", response_model=LocationOut)
async def create_location(
    payload: LocationIn,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    location = Location(company_id=company_id, **payload.model_dump())
    session.add(location)
    await flush_or_conflict(session, "Location conflicts with an existing record")
    await write_audit(
        session,
        action="create_location",
        entity_type="location",
        entity_id=location.id,
        company_id=company_id,
        user_id=user.id,
    )
    await commit_or_conflict(session, "Location conflicts with an existing record")
    return location


@router.get("/{location_id}", response_model=LocationOut)
async def get_location(
    location_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    location = await session.scalar(
        select(Location).where(Location.id == location_id, Location.company_id == company_id)
    )
    if location is None or (not is_privileged(user.role) and not location.is_active):
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(
    location_id: UUID,
    payload: LocationPatch,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    location = await session.scalar(
        select(Location)
        .where(Location.id == location_id, Location.company_id == company_id)
        .with_for_update()
    )
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(location, key, value)
    await write_audit(
        session,
        action="update_location",
        entity_type="location",
        entity_id=location.id,
        company_id=company_id,
        user_id=user.id,
        metadata={"fields": sorted(payload.model_dump(exclude_unset=True))},
    )
    await commit_or_conflict(session, "Location conflicts with an existing record")
    return location


@router.delete("/{location_id}")
async def delete_location(
    location_id: UUID,
    user: User = Depends(require_roles(Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    company_id = company_scope(user)
    location = await session.scalar(
        select(Location)
        .where(Location.id == location_id, Location.company_id == company_id)
        .with_for_update()
    )
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    location.is_active = False
    await write_audit(
        session,
        action="delete_location",
        entity_type="location",
        entity_id=location.id,
        company_id=company_id,
        user_id=user.id,
    )
    await commit_or_conflict(session, "Location could not be deactivated")
    return {"ok": True}
