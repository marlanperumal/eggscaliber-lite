import re
from datetime import date
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import PackageCollectionNotFoundError, PackageNotFoundError
from src.models.collection import CollectionRead
from src.models.group import OrgSubscriptionRead, PackageCollectionDetail, PackageCollectionScope
from src.models.package import PackageCreate, PackageRead, PackageVisibility
from src.models.user import OrganisationRead
from src.repositories import admin_repo, collection_repo, package_repo


async def list_orgs(session: AsyncSession) -> list[OrganisationRead]:
    orgs = await admin_repo.list_orgs(session)
    return [
        OrganisationRead(
            id=cast(int, o.id),
            clerk_org_id=o.clerk_org_id,
            name=o.name,
            created_at=o.created_at,
        )
        for o in orgs
    ]


async def list_subscriptions(session: AsyncSession, org_id: int) -> list[OrgSubscriptionRead]:
    subs = await admin_repo.list_subscriptions(session, org_id)
    return [
        OrgSubscriptionRead(
            id=cast(int, s.id),
            org_id=s.org_id,
            package_id=s.package_id,
            start_date=s.start_date,
            end_date=s.end_date,
            created_at=s.created_at,
        )
        for s in subs
    ]


async def create_subscription(
    session: AsyncSession,
    *,
    org_id: int,
    package_id: int,
    start_date: date,
    end_date: date | None,
) -> OrgSubscriptionRead:
    sub = await admin_repo.create_subscription(
        session,
        org_id=org_id,
        package_id=package_id,
        start_date=start_date,
        end_date=end_date,
    )
    return OrgSubscriptionRead(
        id=cast(int, sub.id),
        org_id=sub.org_id,
        package_id=sub.package_id,
        start_date=sub.start_date,
        end_date=sub.end_date,
        created_at=sub.created_at,
    )


async def delete_subscription(session: AsyncSession, org_id: int, package_id: int) -> None:
    await admin_repo.delete_subscription(session, org_id, package_id)


async def update_package_visibility(
    session: AsyncSession, package_id: int, visibility: PackageVisibility
) -> PackageRead:
    pkg = await admin_repo.update_package_visibility(session, package_id, visibility)
    if pkg is None:
        raise PackageNotFoundError(package_id)
    return PackageRead(
        id=cast(int, pkg.id),
        name=pkg.name,
        slug=pkg.slug,
        description=pkg.description,
        visibility=pkg.visibility,
        created_at=pkg.created_at,
    )


async def list_packages(session: AsyncSession) -> list[PackageRead]:
    pkgs = await package_repo.get_all(session)
    return [PackageRead.model_validate(p.model_dump()) for p in pkgs]


def _slugify(name: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


async def create_package(session: AsyncSession, body: PackageCreate) -> PackageRead:
    slug = body.slug or _slugify(body.name)
    pkg = await package_repo.create_package(
        session, name=body.name, slug=slug, description=body.description
    )
    return PackageRead.model_validate(pkg.model_dump())


async def list_collections(session: AsyncSession) -> list[CollectionRead]:
    cols = await collection_repo.get_all(session)
    return [CollectionRead.model_validate(c.model_dump()) for c in cols]


async def list_package_collections(
    session: AsyncSession, package_id: int
) -> list[PackageCollectionDetail]:
    rows = await admin_repo.get_package_collections(session, package_id)
    result = []
    for pc, col, ds_ids in rows:
        result.append(
            PackageCollectionDetail(
                package_id=pc.package_id,
                collection_id=pc.collection_id,
                scope=pc.scope,
                collection_name=col.name if col else "",
                collection_slug=col.slug if col else "",
                collection_type=str(col.collection_type) if col else "",
                dataset_ids=ds_ids,
            )
        )
    return result


async def add_collection_to_package(
    session: AsyncSession,
    *,
    package_id: int,
    collection_id: int,
    scope: PackageCollectionScope,
) -> PackageCollectionDetail:
    pc = await admin_repo.add_collection_to_package(
        session, package_id=package_id, collection_id=collection_id, scope=scope
    )
    col = await collection_repo.get_by_id(session, collection_id)
    return PackageCollectionDetail(
        package_id=pc.package_id,
        collection_id=pc.collection_id,
        scope=pc.scope,
        collection_name=col.name if col else "",
        collection_slug=col.slug if col else "",
        collection_type=str(col.collection_type) if col else "",
        dataset_ids=[],
    )


async def update_collection_scope(
    session: AsyncSession,
    *,
    package_id: int,
    collection_id: int,
    scope: PackageCollectionScope,
) -> PackageCollectionDetail:
    from src.models.group import PackageCollectionDataset

    pc = await admin_repo.update_collection_scope(
        session, package_id=package_id, collection_id=collection_id, scope=scope
    )
    if pc is None:
        raise PackageCollectionNotFoundError(package_id, collection_id)
    col = await collection_repo.get_by_id(session, collection_id)
    ds_ids = list(
        (
            await session.execute(
                select(PackageCollectionDataset.dataset_id).where(
                    PackageCollectionDataset.package_id == package_id,
                    PackageCollectionDataset.collection_id == collection_id,
                )
            )
        )
        .scalars()
        .all()
    )
    return PackageCollectionDetail(
        package_id=pc.package_id,
        collection_id=pc.collection_id,
        scope=pc.scope,
        collection_name=col.name if col else "",
        collection_slug=col.slug if col else "",
        collection_type=str(col.collection_type) if col else "",
        dataset_ids=ds_ids,
    )


async def remove_collection_from_package(
    session: AsyncSession, *, package_id: int, collection_id: int
) -> None:
    await admin_repo.remove_collection_from_package(
        session, package_id=package_id, collection_id=collection_id
    )


async def add_dataset_inclusion(
    session: AsyncSession, *, package_id: int, collection_id: int, dataset_id: int
) -> None:
    await admin_repo.add_dataset_inclusion(
        session, package_id=package_id, collection_id=collection_id, dataset_id=dataset_id
    )


async def remove_dataset_inclusion(
    session: AsyncSession, *, package_id: int, collection_id: int, dataset_id: int
) -> None:
    await admin_repo.remove_dataset_inclusion(
        session, package_id=package_id, collection_id=collection_id, dataset_id=dataset_id
    )
