from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.package import Package


async def test_scope_empty(client):
    resp = await client.get("/api/v1/scope")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_scope_returns_full_hierarchy(client, db):
    pkg = Package(name="Brand Suite", slug="brand-suite")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    col = Collection(
        name="Brand Tracker",
        slug="brand-tracker",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    ds1 = Dataset(name="Wave 1", slug="wave-1", collection_id=col.id, sort_order=0)
    ds2 = Dataset(name="Wave 2", slug="wave-2", collection_id=col.id, sort_order=1)
    db.add_all([ds1, ds2])
    await db.flush()

    resp = await client.get("/api/v1/scope")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Brand Suite"
    assert len(data[0]["collections"]) == 1
    assert data[0]["collections"][0]["name"] == "Brand Tracker"
    datasets = data[0]["collections"][0]["datasets"]
    assert len(datasets) == 2
    assert [d["name"] for d in datasets] == ["Wave 1", "Wave 2"]


async def test_scope_package_with_no_collections(client, db):
    db.add(Package(name="Empty Package", slug="empty-pkg"))
    await db.flush()

    resp = await client.get("/api/v1/scope")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["collections"] == []


async def test_scope_does_not_expose_internal_fields(client, db):
    pkg = Package(name="Brand Suite", slug="brand-suite")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="Tracker",
        slug="tracker",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    db.add(Dataset(name="Wave 1", slug="wave-1", collection_id=col.id, sort_order=0))
    await db.flush()

    resp = await client.get("/api/v1/scope")
    pkg_data = resp.json()[0]
    assert "slug" not in pkg_data
    assert "created_at" not in pkg_data
    assert "description" not in pkg_data
    col_data = pkg_data["collections"][0]
    assert "slug" not in col_data
    assert "collection_type" not in col_data
    ds_data = col_data["datasets"][0]
    assert "slug" not in ds_data
    assert "sort_order" not in ds_data
