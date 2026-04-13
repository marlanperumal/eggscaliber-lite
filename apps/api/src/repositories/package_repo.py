from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.collection import Collection
from src.models.package import Package


async def get_all(session: AsyncSession) -> list[Package]:
    return (await session.execute(select(Package))).scalars().all()


async def get_by_id(session: AsyncSession, package_id: int) -> Package | None:
    return (
        (await session.execute(select(Package).where(Package.id == package_id))).scalars().first()
    )


async def get_collections_for_package(session: AsyncSession, package_id: int) -> list[Collection]:
    return (
        (await session.execute(select(Collection).where(Collection.package_id == package_id)))
        .scalars()
        .all()
    )
