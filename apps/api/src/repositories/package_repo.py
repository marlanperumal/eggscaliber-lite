from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.collection import Collection
from src.models.group import PackageCollection
from src.models.package import Package


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
