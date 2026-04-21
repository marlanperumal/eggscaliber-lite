import re

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import PackageNotFoundError
from src.models.package import CollectionSummary, PackageRead, PackageWithCollections
from src.models.scope import ScopeCollection, ScopeDataset, ScopePackage
from src.orm import pk
from src.repositories import dataset_repo, package_repo


def _slugify(name: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


async def create_package(
    session: AsyncSession,
    name: str,
    slug: str | None = None,
    description: str | None = None,
) -> PackageRead:
    resolved_slug = slug or _slugify(name)
    pkg = await package_repo.create_package(
        session, name=name, slug=resolved_slug, description=description
    )
    return PackageRead.model_validate(pkg.model_dump())


async def get_scope(session: AsyncSession) -> list[ScopePackage]:
    """Return all packages with their collections and datasets in 3 queries."""
    from sqlalchemy import select as sa_select

    from src.models.collection import Collection
    from src.models.group import PackageCollection

    packages = await package_repo.get_all(session)
    if not packages:
        return []

    pkg_ids = [p.id for p in packages if p.id is not None]

    rows = list(
        (
            await session.execute(
                sa_select(PackageCollection.package_id, Collection)
                .join(Collection, Collection.id == PackageCollection.collection_id)
                .where(PackageCollection.package_id.in_(pkg_ids))
            )
        ).all()
    )

    col_ids = [r.Collection.id for r in rows if r.Collection.id is not None]
    datasets = await dataset_repo.get_all_for_collections(session, col_ids)

    datasets_by_col: dict[int | None, list[ScopeDataset]] = {}
    for d in datasets:
        datasets_by_col.setdefault(d.collection_id, []).append(ScopeDataset(id=pk(d), name=d.name))

    collections_by_pkg: dict[int | None, list[ScopeCollection]] = {}
    for row in rows:
        c = row.Collection
        collections_by_pkg.setdefault(row.package_id, []).append(
            ScopeCollection(id=pk(c), name=c.name, datasets=datasets_by_col.get(c.id, []))
        )

    return [
        ScopePackage(id=pk(p), name=p.name, collections=collections_by_pkg.get(p.id, []))
        for p in packages
    ]


async def get_with_collections(session: AsyncSession, package_id: int) -> PackageWithCollections:
    """Raises PackageNotFoundError if package_id does not exist."""
    pkg = await package_repo.get_by_id(session, package_id)
    if pkg is None:
        raise PackageNotFoundError(package_id)
    collections = await package_repo.get_collections_for_package(session, package_id)
    return PackageWithCollections.model_validate(
        {
            **pkg.model_dump(),
            "collections": [CollectionSummary.model_validate(c.model_dump()) for c in collections],
        }
    )
