from datetime import date

from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.package import Package


async def _seed_collection(db):
    pkg = Package(name="P", slug="p-col-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    col = Collection(
        name="Brand Tracker",
        slug="brand-tracker-col-test",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    for i, wave_name in enumerate(["Wave 1", "Wave 2"], start=1):
        ds = Dataset(
            name=wave_name,
            slug=f"wave-{i}-col-test",
            collection_id=col.id,
            sort_order=i,
            collected_at=date(2026, i, 1),
        )
        db.add(ds)
    await db.flush()
    return col


async def test_get_collection_consistency_not_found(client):
    response = await client.get("/api/v1/collections/99999/consistency")
    assert response.status_code == 404


async def test_create_collection(client, db):
    pkg = Package(name="Pkg", slug="pkg-col-create-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    response = await client.post(
        "/api/v1/collections",
        json={"name": "New Collection", "slug": "new-collection", "package_id": pkg.id},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New Collection"
    assert data["package_id"] == pkg.id
    assert data["id"] is not None


async def test_create_collection_slug_auto_generated(client, db):
    pkg = Package(name="Pkg2", slug="pkg2-col-create-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    response = await client.post(
        "/api/v1/collections",
        json={"name": "Auto Slug Collection", "package_id": pkg.id},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["slug"] == "auto-slug-collection"


async def test_create_collection_invalid_package(client):
    response = await client.post(
        "/api/v1/collections",
        json={"name": "Bad Col", "package_id": 99999},
    )
    assert response.status_code == 404


async def test_get_collection_with_datasets(client, db):
    col = await _seed_collection(db)

    response = await client.get(f"/api/v1/collections/{col.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Brand Tracker"
    assert data["collection_type"] == "survey"
    assert len(data["datasets"]) == 2
    sort_orders = [d["sort_order"] for d in data["datasets"]]
    assert sort_orders == sorted(sort_orders)


async def test_get_collection_not_found_returns_error_code(client):
    response = await client.get("/api/v1/collections/99999")
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "collection_not_found"
    assert body["status"] == 404
