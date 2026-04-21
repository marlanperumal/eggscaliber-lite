from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.group import PackageCollection


async def get_all(session: AsyncSession) -> list[Collection]:
    result = await session.execute(select(Collection))
    return list(result.scalars().all())


async def get_all_for_packages(session: AsyncSession, package_ids: list[int]) -> list[Collection]:
    if not package_ids:
        return []
    result = await session.execute(
        select(Collection)
        .join(PackageCollection, PackageCollection.collection_id == Collection.id)
        .where(PackageCollection.package_id.in_(package_ids))
    )
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, collection_id: int) -> Collection | None:
    return (
        (await session.execute(select(Collection).where(Collection.id == collection_id)))
        .scalars()
        .first()
    )


async def create_collection(
    session: AsyncSession,
    name: str,
    slug: str,
    package_id: int,
    description: str | None = None,
    collection_type: CollectionType = CollectionType.generic,
) -> Collection:
    obj = Collection(
        name=name,
        slug=slug,
        description=description,
        collection_type=collection_type,
    )
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    pc = PackageCollection(package_id=package_id, collection_id=obj.id)
    session.add(pc)
    await session.flush()
    return obj


async def get_datasets_for_collection(session: AsyncSession, collection_id: int) -> list[Dataset]:
    return list(
        (
            await session.execute(
                select(Dataset)
                .where(Dataset.collection_id == collection_id)
                .order_by(Dataset.sort_order)
            )
        )
        .scalars()
        .all()
    )
