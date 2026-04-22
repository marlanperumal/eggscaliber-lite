"""Tests that MCP tool service calls enforce accessible_ids filtering.

We pass an explicit restricted accessible_ids set (as the middleware would in prod
mode) and assert that packages/collections/datasets outside the set are excluded.
This complements test_mcp_tools.py, which only covers the dev-mode all-access path.
"""

from typing import cast

import pytest
from src.errors import DatasetNotFoundError
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.group import PackageCollection
from src.models.package import Package
from src.services import dataset_service, package_service


async def _make_pkg_with_dataset(
    db, *, pkg_name: str, pkg_slug: str
) -> tuple[Package, Collection, Dataset]:
    pkg = Package(name=pkg_name, slug=pkg_slug)
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    col = Collection(
        name=f"{pkg_name} Col",
        slug=f"{pkg_slug}-col",
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    db.add(
        PackageCollection(
            package_id=cast(int, pkg.id),
            collection_id=cast(int, col.id),
        )
    )
    await db.flush()

    ds = Dataset(
        name=f"{pkg_name} DS",
        slug=f"{pkg_slug}-ds",
        collection_id=cast(int, col.id),
        sort_order=0,
    )
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return pkg, col, ds


async def test_list_packages_excludes_unentitled_packages(db):
    entitled, _, _ = await _make_pkg_with_dataset(db, pkg_name="Entitled", pkg_slug="entitled-pkg")
    await _make_pkg_with_dataset(db, pkg_name="Forbidden", pkg_slug="forbidden-pkg")

    accessible_ids = {cast(int, entitled.id)}
    result = await package_service.list_packages(db, accessible_ids)

    names = [p.name for p in result]
    assert "Entitled" in names
    assert "Forbidden" not in names


async def test_list_datasets_excludes_collections_in_unentitled_packages(db):
    entitled, entitled_col, _ = await _make_pkg_with_dataset(
        db, pkg_name="Entitled", pkg_slug="entitled-pkg-2"
    )
    _, forbidden_col, _ = await _make_pkg_with_dataset(
        db, pkg_name="Forbidden", pkg_slug="forbidden-pkg-2"
    )

    accessible_ids = {cast(int, entitled.id)}

    # Datasets in the entitled collection are returned.
    entitled_page = await dataset_service.list_datasets(
        db,
        collection_id=cast(int, entitled_col.id),
        accessible_ids=accessible_ids,
    )
    assert entitled_page.total >= 1
    assert any(item.name == "Entitled DS" for item in entitled_page.items)

    # Datasets in a collection belonging to a forbidden package are filtered out
    # (service returns an empty page rather than raising — the access filter is
    # applied at the repository level via accessible_package_ids).
    forbidden_page = await dataset_service.list_datasets(
        db,
        collection_id=cast(int, forbidden_col.id),
        accessible_ids=accessible_ids,
    )
    assert forbidden_page.total == 0
    assert forbidden_page.items == []


async def test_describe_dataset_rejects_unentitled_dataset(db):
    entitled, _, _ = await _make_pkg_with_dataset(
        db, pkg_name="Entitled", pkg_slug="entitled-pkg-3"
    )
    _, _, forbidden_ds = await _make_pkg_with_dataset(
        db, pkg_name="Forbidden", pkg_slug="forbidden-pkg-3"
    )

    accessible_ids = {cast(int, entitled.id)}

    with pytest.raises(DatasetNotFoundError):
        await dataset_service.get_with_fields(db, cast(int, forbidden_ds.id), accessible_ids)
