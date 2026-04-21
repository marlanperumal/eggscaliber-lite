from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.group import (
    OrgSubscription,
    PackageCollection,
    PackageCollectionDataset,
    PackageCollectionScope,
)
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation


async def list_orgs(session: AsyncSession) -> list[Organisation]:
    result = await session.execute(select(Organisation))
    return list(result.scalars().all())


async def get_org_by_id(session: AsyncSession, org_id: int) -> Organisation | None:
    return await session.get(Organisation, org_id)


async def list_subscriptions(session: AsyncSession, org_id: int) -> list[OrgSubscription]:
    result = await session.execute(select(OrgSubscription).where(OrgSubscription.org_id == org_id))
    return list(result.scalars().all())


async def create_subscription(
    session: AsyncSession,
    *,
    org_id: int,
    package_id: int,
    start_date: date,
    end_date: date | None = None,
) -> OrgSubscription:
    sub = OrgSubscription(
        org_id=org_id,
        package_id=package_id,
        start_date=start_date,
        end_date=end_date,
    )
    session.add(sub)
    await session.flush()
    await session.refresh(sub)
    return sub


async def delete_subscription(session: AsyncSession, org_id: int, package_id: int) -> None:
    await session.execute(
        delete(OrgSubscription).where(
            OrgSubscription.org_id == org_id,
            OrgSubscription.package_id == package_id,
        )
    )
    await session.flush()


async def update_package_visibility(
    session: AsyncSession, package_id: int, visibility: PackageVisibility
) -> Package | None:
    pkg = await session.get(Package, package_id)
    if pkg is None:
        return None
    pkg.visibility = visibility
    await session.flush()
    await session.refresh(pkg)
    return pkg


async def get_package_collections(session: AsyncSession, package_id: int) -> list[tuple]:
    from src.models.collection import Collection

    pcs = list(
        (
            await session.execute(
                select(PackageCollection).where(PackageCollection.package_id == package_id)
            )
        )
        .scalars()
        .all()
    )
    result = []
    for pc in pcs:
        col = await session.get(Collection, pc.collection_id)
        ds_ids = list(
            (
                await session.execute(
                    select(PackageCollectionDataset.dataset_id).where(
                        PackageCollectionDataset.package_id == package_id,
                        PackageCollectionDataset.collection_id == pc.collection_id,
                    )
                )
            )
            .scalars()
            .all()
        )
        result.append((pc, col, ds_ids))
    return result


async def add_collection_to_package(
    session: AsyncSession,
    *,
    package_id: int,
    collection_id: int,
    scope: PackageCollectionScope,
) -> PackageCollection:
    pc = PackageCollection(
        package_id=package_id,
        collection_id=collection_id,
        scope=scope,
    )
    session.add(pc)
    await session.flush()
    await session.refresh(pc)
    return pc


async def update_collection_scope(
    session: AsyncSession,
    *,
    package_id: int,
    collection_id: int,
    scope: PackageCollectionScope,
) -> PackageCollection | None:
    pc = await session.get(PackageCollection, (package_id, collection_id))
    if pc is None:
        return None
    pc.scope = scope
    await session.flush()
    await session.refresh(pc)
    return pc


async def remove_collection_from_package(
    session: AsyncSession, *, package_id: int, collection_id: int
) -> None:
    await session.execute(
        delete(PackageCollection).where(
            PackageCollection.package_id == package_id,
            PackageCollection.collection_id == collection_id,
        )
    )
    await session.flush()


async def add_dataset_inclusion(
    session: AsyncSession,
    *,
    package_id: int,
    collection_id: int,
    dataset_id: int,
) -> None:
    pcd = PackageCollectionDataset(
        package_id=package_id,
        collection_id=collection_id,
        dataset_id=dataset_id,
    )
    session.add(pcd)
    await session.flush()


async def remove_dataset_inclusion(
    session: AsyncSession,
    *,
    package_id: int,
    collection_id: int,
    dataset_id: int,
) -> None:
    await session.execute(
        delete(PackageCollectionDataset).where(
            PackageCollectionDataset.package_id == package_id,
            PackageCollectionDataset.collection_id == collection_id,
            PackageCollectionDataset.dataset_id == dataset_id,
        )
    )
    await session.flush()
