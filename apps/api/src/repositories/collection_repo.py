from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.collection import Collection
from src.models.dataset import Dataset


async def get_all_for_packages(session: AsyncSession, package_ids: list[int]) -> list[Collection]:
    if not package_ids:
        return []
    return list(
        (await session.execute(select(Collection).where(Collection.package_id.in_(package_ids))))
        .scalars()
        .all()
    )


async def get_by_id(session: AsyncSession, collection_id: int) -> Collection | None:
    return (
        (await session.execute(select(Collection).where(Collection.id == collection_id)))
        .scalars()
        .first()
    )


async def get_datasets_for_collection(session: AsyncSession, collection_id: int) -> list[Dataset]:
    return (
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
