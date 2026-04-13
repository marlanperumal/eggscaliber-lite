from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import PackageNotFoundError
from src.models.package import PackageWithCollections
from src.repositories import package_repo


async def get_with_collections(session: AsyncSession, package_id: int) -> PackageWithCollections:
    """Raises PackageNotFoundError if package_id does not exist."""
    pkg = await package_repo.get_by_id(session, package_id)
    if pkg is None:
        raise PackageNotFoundError(package_id)
    collections = await package_repo.get_collections_for_package(session, package_id)
    return PackageWithCollections(**pkg.model_dump(), collections=collections)
