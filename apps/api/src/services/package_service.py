from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import PackageNotFoundError
from src.models.package import PackageWithCollections
from src.models.scope import ScopeCollection, ScopeDataset, ScopePackage
from src.repositories import collection_repo, dataset_repo, package_repo


async def get_scope(session: AsyncSession) -> list[ScopePackage]:
    """Return all packages with their collections and datasets in 3 queries."""
    packages = await package_repo.get_all(session)
    if not packages:
        return []

    collections = await collection_repo.get_all_for_packages(session, [p.id for p in packages])

    datasets = await dataset_repo.get_all_for_collections(session, [c.id for c in collections])

    datasets_by_col: dict[int, list[ScopeDataset]] = {}
    for d in datasets:
        datasets_by_col.setdefault(d.collection_id, []).append(ScopeDataset(id=d.id, name=d.name))

    collections_by_pkg: dict[int, list[ScopeCollection]] = {}
    for c in collections:
        collections_by_pkg.setdefault(c.package_id, []).append(
            ScopeCollection(id=c.id, name=c.name, datasets=datasets_by_col.get(c.id, []))
        )

    return [
        ScopePackage(id=p.id, name=p.name, collections=collections_by_pkg.get(p.id, []))
        for p in packages
    ]


async def get_with_collections(session: AsyncSession, package_id: int) -> PackageWithCollections:
    """Raises PackageNotFoundError if package_id does not exist."""
    pkg = await package_repo.get_by_id(session, package_id)
    if pkg is None:
        raise PackageNotFoundError(package_id)
    collections = await package_repo.get_collections_for_package(session, package_id)
    return PackageWithCollections(**pkg.model_dump(), collections=collections)
