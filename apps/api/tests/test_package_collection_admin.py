from typing import cast

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from src.auth import CurrentUser, get_current_user
from src.main import app
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.group import PackageCollection, PackageCollectionScope
from src.models.package import Package


@pytest.fixture(autouse=True)
def as_superuser(client):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        clerk_id="super", email="super@example.com", org_id=None, is_superuser=True
    )
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest_asyncio.fixture
async def pc_package(db: AsyncSession):
    """A standalone package for package-collection tests."""
    pkg = Package(name="PC Test Package", slug="pc-test-pkg-fixture")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    return pkg


@pytest_asyncio.fixture
async def pc_collection(db: AsyncSession):
    """A standalone collection for package-collection tests (no pre-linked package)."""
    col = Collection(
        name="PC Test Collection",
        slug="pc-test-col-fixture",
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    return col


@pytest_asyncio.fixture
async def pc_dataset(db: AsyncSession, pc_collection):
    """A dataset belonging to pc_collection."""
    ds = Dataset(
        name="PC Test Dataset",
        slug="pc-test-ds-fixture",
        collection_id=cast(int, pc_collection.id),
        sort_order=0,
    )
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return ds


@pytest_asyncio.fixture
async def seed_package_collection(db: AsyncSession, pc_package, pc_collection):
    """A PackageCollection row linking pc_package + pc_collection with scope=all."""
    pc = PackageCollection(
        package_id=cast(int, pc_package.id),
        collection_id=cast(int, pc_collection.id),
        scope=PackageCollectionScope.all,
    )
    db.add(pc)
    await db.flush()
    await db.refresh(pc)
    return pc


@pytest_asyncio.fixture
async def seed_package_collection_selected(db: AsyncSession, pc_package, pc_collection):
    """A PackageCollection row linking pc_package + pc_collection with scope=selected."""
    pc = PackageCollection(
        package_id=cast(int, pc_package.id),
        collection_id=cast(int, pc_collection.id),
        scope=PackageCollectionScope.selected,
    )
    db.add(pc)
    await db.flush()
    await db.refresh(pc)
    return pc


async def test_list_package_collections_empty(client: AsyncClient, pc_package):
    response = await client.get(f"/api/v1/admin/packages/{pc_package.id}/collections")
    assert response.status_code == 200
    assert response.json() == []


async def test_add_collection_to_package(client: AsyncClient, pc_package, pc_collection):
    response = await client.post(
        f"/api/v1/admin/packages/{pc_package.id}/collections",
        json={"collection_id": pc_collection.id, "scope": "all"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["collection_id"] == pc_collection.id
    assert data["scope"] == "all"


async def test_update_collection_scope(
    client: AsyncClient, pc_package, pc_collection, seed_package_collection
):
    response = await client.patch(
        f"/api/v1/admin/packages/{pc_package.id}/collections/{pc_collection.id}",
        json={"scope": "selected"},
    )
    assert response.status_code == 200
    assert response.json()["scope"] == "selected"

    list_resp = await client.get(f"/api/v1/admin/packages/{pc_package.id}/collections")
    assert list_resp.status_code == 200
    row = next(c for c in list_resp.json() if c["collection_id"] == pc_collection.id)
    assert row["scope"] == "selected"


async def test_remove_collection_from_package(
    client: AsyncClient, pc_package, pc_collection, seed_package_collection
):
    response = await client.delete(
        f"/api/v1/admin/packages/{pc_package.id}/collections/{pc_collection.id}"
    )
    assert response.status_code == 204
    list_response = await client.get(f"/api/v1/admin/packages/{pc_package.id}/collections")
    ids = [c["collection_id"] for c in list_response.json()]
    assert pc_collection.id not in ids


async def test_add_collection_requires_superuser(client: AsyncClient, pc_package, pc_collection):
    """Non-superuser cannot add a collection to a package (403)."""
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        clerk_id="regular", email="regular@example.com", org_id=None, is_superuser=False
    )
    response = await client.post(
        f"/api/v1/admin/packages/{pc_package.id}/collections",
        json={"collection_id": pc_collection.id, "scope": "all"},
    )
    assert response.status_code == 403


async def test_add_and_remove_dataset_inclusion(
    client: AsyncClient,
    pc_package,
    pc_collection,
    pc_dataset,
    seed_package_collection_selected,
):
    add_resp = await client.post(
        f"/api/v1/admin/packages/{pc_package.id}/collections/{pc_collection.id}/datasets",
        json={"dataset_id": pc_dataset.id},
    )
    assert add_resp.status_code == 201

    detail_resp = await client.get(f"/api/v1/admin/packages/{pc_package.id}/collections")
    detail = next(c for c in detail_resp.json() if c["collection_id"] == pc_collection.id)
    assert pc_dataset.id in detail["dataset_ids"]

    del_resp = await client.delete(
        f"/api/v1/admin/packages/{pc_package.id}/collections/{pc_collection.id}/datasets/{pc_dataset.id}"
    )
    assert del_resp.status_code == 204
