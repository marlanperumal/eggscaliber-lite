from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.auth import CurrentUser, get_current_user
from src.database import get_session
from src.models.group import OrgSubscriptionRead
from src.models.package import PackageRead, PackageVisibility
from src.models.user import OrganisationRead
from src.services import admin_service

router = APIRouter(tags=["admin"])


def _require_superuser(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not current_user.is_superuser:
        raise HTTPException(403, "Super-user access required")
    return current_user


@router.get("/admin/orgs", response_model=list[OrganisationRead])
async def list_orgs(
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """List all organisations (super-user only)."""
    return await admin_service.list_orgs(session)


@router.get("/admin/orgs/{org_id}/subscriptions", response_model=list[OrgSubscriptionRead])
async def list_subscriptions(
    org_id: int,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """List package subscriptions for an org (super-user only)."""
    return await admin_service.list_subscriptions(session, org_id)


class SubscriptionCreate(SQLModel):
    package_id: int
    start_date: date
    end_date: date | None = None


@router.post(
    "/admin/orgs/{org_id}/subscriptions",
    response_model=OrgSubscriptionRead,
    status_code=201,
)
async def create_subscription(
    org_id: int,
    body: SubscriptionCreate,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Subscribe an org to a private package (super-user only)."""
    return await admin_service.create_subscription(
        session,
        org_id=org_id,
        package_id=body.package_id,
        start_date=body.start_date,
        end_date=body.end_date,
    )


@router.delete(
    "/admin/orgs/{org_id}/subscriptions/{package_id}",
    response_model=None,
    status_code=204,
)
async def delete_subscription(
    org_id: int,
    package_id: int,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Remove an org's subscription to a package (super-user only)."""
    await admin_service.delete_subscription(session, org_id, package_id)


class PackageUpdate(SQLModel):
    visibility: PackageVisibility | None = None
    name: str | None = None
    description: str | None = None


@router.patch("/admin/packages/{package_id}", response_model=PackageRead)
async def update_package(
    package_id: int,
    body: PackageUpdate,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Update a package's visibility or metadata (super-user only)."""
    if body.visibility is not None:
        return await admin_service.update_package_visibility(session, package_id, body.visibility)
    raise HTTPException(422, "No updatable fields provided")
