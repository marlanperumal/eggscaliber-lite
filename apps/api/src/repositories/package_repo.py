from __future__ import annotations

from datetime import date as date_type
from typing import TYPE_CHECKING, cast

from sqlalchemy import select, union
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from src.auth import CurrentUser

from src.models.collection import Collection
from src.models.group import (
    Group,
    GroupMembership,
    GroupPackage,
    OrgSubscription,
    PackageCollection,
)
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation, User


async def get_all(session: AsyncSession) -> list[Package]:
    return list((await session.execute(select(Package))).scalars().all())


async def get_by_id(session: AsyncSession, package_id: int) -> Package | None:
    return (
        (await session.execute(select(Package).where(Package.id == package_id))).scalars().first()
    )


async def create_package(
    session: AsyncSession, name: str, slug: str, description: str | None = None
) -> Package:
    obj = Package(name=name, slug=slug, description=description)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def get_collections_for_package(session: AsyncSession, package_id: int) -> list[Collection]:
    result = await session.execute(
        select(Collection)
        .join(PackageCollection, PackageCollection.collection_id == Collection.id)
        .where(PackageCollection.package_id == package_id)
    )
    return list(result.scalars().all())


async def get_package_ids_for_collection(session: AsyncSession, collection_id: int) -> set[int]:
    """Return the set of package IDs that contain the given collection."""
    result = await session.execute(
        select(PackageCollection.package_id).where(PackageCollection.collection_id == collection_id)
    )
    return {cast(int, row) for row in result.scalars().all()}


async def get_package_ids_for_dataset(session: AsyncSession, dataset_id: int) -> set[int]:
    """Return the set of package IDs that contain the given dataset's collection."""
    from src.models.dataset import Dataset  # local import to avoid circular

    dataset_subq = select(Dataset.collection_id).where(Dataset.id == dataset_id).scalar_subquery()
    result = await session.execute(
        select(PackageCollection.package_id).where(PackageCollection.collection_id == dataset_subq)
    )
    return {cast(int, row) for row in result.scalars().all()}


async def get_accessible_ids(session: AsyncSession, user: CurrentUser) -> set[int]:
    """Return the set of package IDs accessible to the given user.

    A package is accessible if it is public, or if the user's org has an active
    subscription to it AND the user belongs to a group that has been granted access.
    """
    public_q = select(Package.id).where(Package.visibility == PackageVisibility.public)

    if user.org_id is None:
        result = await session.execute(public_q)
        return {id_ for id_ in result.scalars().all() if id_ is not None}

    org_id_subq = (
        select(Organisation.id).where(Organisation.clerk_org_id == user.org_id).scalar_subquery()
    )
    user_id_subq = select(User.id).where(User.clerk_id == user.clerk_id).scalar_subquery()
    today = date_type.today()

    private_q = (
        select(Package.id)
        .join(OrgSubscription, OrgSubscription.package_id == Package.id)
        .join(GroupPackage, GroupPackage.package_id == Package.id)
        .join(
            Group,
            (Group.id == GroupPackage.group_id) & (Group.org_id == OrgSubscription.org_id),
        )
        .join(
            GroupMembership,
            (GroupMembership.group_id == Group.id) & (GroupMembership.user_id == user_id_subq),
        )
        .where(
            Package.visibility == PackageVisibility.private,
            OrgSubscription.org_id == org_id_subq,
            OrgSubscription.start_date <= today,
            (OrgSubscription.end_date.is_(None)) | (OrgSubscription.end_date >= today),
        )
        .distinct()
    )

    combined = union(public_q, private_q)
    result = await session.execute(combined)
    return {id_ for id_ in result.scalars().all() if id_ is not None}


async def get_org_subscribed_packages(session: AsyncSession, org_id: int) -> list[Package]:
    """Return all packages visible to an org: public packages plus active private subscriptions."""
    today = date_type.today()

    public_pkgs = list(
        (
            await session.execute(
                select(Package).where(Package.visibility == PackageVisibility.public)
            )
        )
        .scalars()
        .all()
    )
    private_pkgs = list(
        (
            await session.execute(
                select(Package)
                .join(OrgSubscription, OrgSubscription.package_id == Package.id)
                .where(
                    Package.visibility == PackageVisibility.private,
                    OrgSubscription.org_id == org_id,
                    OrgSubscription.start_date <= today,
                    (OrgSubscription.end_date.is_(None)) | (OrgSubscription.end_date >= today),
                )
            )
        )
        .scalars()
        .all()
    )
    seen = {p.id for p in public_pkgs}
    return public_pkgs + [p for p in private_pkgs if p.id not in seen]
