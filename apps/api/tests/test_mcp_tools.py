"""Tests for external MCP tool logic.

We test the service calls that tools make, using the real DB fixtures.
Tools themselves call _get_accessible_package_ids → package_service → etc.
We verify that access filtering works correctly in dev mode (where
_get_accessible_package_ids returns None, granting access to all packages).
"""

from typing import cast

from src.auth import CurrentUser, _get_accessible_package_ids
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.group import PackageCollection
from src.models.package import Package
from src.services import dataset_service, package_service


async def _setup_accessible_package(db) -> tuple[Package, Collection, Dataset]:
    pkg = Package(name="Accessible Pkg", slug="accessible-pkg")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    col = Collection(name="Col A", slug="col-a", collection_type=CollectionType.survey)
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
        name="DS 2024",
        slug="ds-2024",
        collection_id=cast(int, col.id),
        sort_order=0,
    )
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return pkg, col, ds


async def test_list_packages_returns_accessible_packages(db):
    pkg, _, _ = await _setup_accessible_package(db)
    user = CurrentUser(clerk_id="dev_user", email="dev@example.com", org_id=None)
    accessible_ids = await _get_accessible_package_ids(user, db)
    result = await package_service.list_packages(db, accessible_ids)
    names = [p.name for p in result]
    assert pkg.name in names


async def test_list_datasets_in_collection(db):
    _, col, _ = await _setup_accessible_package(db)
    user = CurrentUser(clerk_id="dev_user", email="dev@example.com", org_id=None)
    accessible_ids = await _get_accessible_package_ids(user, db)
    page = await dataset_service.list_datasets(
        db,
        collection_id=cast(int, col.id),
        accessible_ids=accessible_ids,
    )
    assert page.total >= 1
    assert any(item.name == "DS 2024" for item in page.items)


async def test_describe_dataset_returns_metadata(db):
    _, _, ds = await _setup_accessible_package(db)
    user = CurrentUser(clerk_id="dev_user", email="dev@example.com", org_id=None)
    accessible_ids = await _get_accessible_package_ids(user, db)
    result = await dataset_service.get_with_fields(db, cast(int, ds.id), accessible_ids)
    assert result.name == "DS 2024"
