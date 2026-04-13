from src.models.collection import Collection, CollectionType
from src.models.package import Package


async def _make_package(db, name="Test Package", slug="test-package"):
    pkg = Package(name=name, slug=slug)
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    return pkg


async def test_list_packages_empty(client):
    response = await client.get("/api/v1/packages")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_packages_returns_packages(client, db):
    await _make_package(db, "Brand Suite", "brand-suite")
    await _make_package(db, "Tracking Studies", "tracking-studies")

    response = await client.get("/api/v1/packages")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    slugs = {p["slug"] for p in data}
    assert slugs == {"brand-suite", "tracking-studies"}


async def test_get_package_not_found(client):
    response = await client.get("/api/v1/packages/99999")
    assert response.status_code == 404


async def test_get_package_with_collections(client, db):
    pkg = await _make_package(db)
    col = Collection(
        name="Brand Tracker",
        slug="brand-tracker",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()

    response = await client.get(f"/api/v1/packages/{pkg.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Package"
    assert len(data["collections"]) == 1
    assert data["collections"][0]["name"] == "Brand Tracker"
    assert data["collections"][0]["collection_type"] == "survey"
