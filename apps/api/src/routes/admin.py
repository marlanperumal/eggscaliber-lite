from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.auth import CurrentUser, get_current_user
from src.database import get_session
from src.models.collection import CollectionRead
from src.models.group import (
    AddCollectionBody,
    AddDatasetBody,
    OrgSubscriptionRead,
    PackageCollectionDetail,
    UpdateScopeBody,
)
from src.models.package import PackageCreate, PackageRead, PackageVisibility
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


@router.get("/admin/packages", response_model=list[PackageRead])
async def list_all_packages(
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """List all packages (super-user only)."""
    return await admin_service.list_packages(session)


@router.post("/admin/packages", response_model=PackageRead, status_code=201)
async def create_package(
    body: PackageCreate,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Create a new package (super-user only)."""
    return await admin_service.create_package(session, body)


class PackageUpdate(SQLModel):
    visibility: PackageVisibility | None = None


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


@router.get("/admin/collections", response_model=list[CollectionRead])
async def list_all_collections(
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """List all collections (super-user only)."""
    return await admin_service.list_collections(session)


@router.get(
    "/admin/packages/{package_id}/collections",
    response_model=list[PackageCollectionDetail],
)
async def list_package_collections(
    package_id: int,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """List collections included in a package with their scope and dataset inclusions."""
    return await admin_service.list_package_collections(session, package_id)


@router.post(
    "/admin/packages/{package_id}/collections",
    response_model=PackageCollectionDetail,
    status_code=201,
)
async def add_collection_to_package(
    package_id: int,
    body: AddCollectionBody,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Add a collection to a package."""
    return await admin_service.add_collection_to_package(
        session,
        package_id=package_id,
        collection_id=body.collection_id,
        scope=body.scope,
    )


@router.patch(
    "/admin/packages/{package_id}/collections/{collection_id}",
    response_model=PackageCollectionDetail,
)
async def update_package_collection_scope(
    package_id: int,
    collection_id: int,
    body: UpdateScopeBody,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Update the dataset scope for a collection within a package."""
    return await admin_service.update_collection_scope(
        session,
        package_id=package_id,
        collection_id=collection_id,
        scope=body.scope,
    )


@router.delete(
    "/admin/packages/{package_id}/collections/{collection_id}",
    response_model=None,
    status_code=204,
)
async def remove_collection_from_package(
    package_id: int,
    collection_id: int,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Remove a collection from a package."""
    await admin_service.remove_collection_from_package(
        session, package_id=package_id, collection_id=collection_id
    )


@router.post(
    "/admin/packages/{package_id}/collections/{collection_id}/datasets",
    response_model=None,
    status_code=201,
)
async def add_dataset_inclusion(
    package_id: int,
    collection_id: int,
    body: AddDatasetBody,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Add a dataset to the selected-scope inclusion list for a collection."""
    await admin_service.add_dataset_inclusion(
        session,
        package_id=package_id,
        collection_id=collection_id,
        dataset_id=body.dataset_id,
    )


@router.delete(
    "/admin/packages/{package_id}/collections/{collection_id}/datasets/{dataset_id}",
    response_model=None,
    status_code=204,
)
async def remove_dataset_inclusion(
    package_id: int,
    collection_id: int,
    dataset_id: int,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Remove a dataset from the selected-scope inclusion list."""
    await admin_service.remove_dataset_inclusion(
        session,
        package_id=package_id,
        collection_id=collection_id,
        dataset_id=dataset_id,
    )
