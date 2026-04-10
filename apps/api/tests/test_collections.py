from datetime import date

from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.package import Package


def _seed_collection(db):
    pkg = Package(name="P", slug="p-col-test")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)

    col = Collection(
        name="Brand Tracker",
        slug="brand-tracker-col-test",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    db.flush()
    db.refresh(col)

    for i, wave_name in enumerate(["Wave 1", "Wave 2"], start=1):
        ds = Dataset(
            name=wave_name,
            slug=f"wave-{i}-col-test",
            collection_id=col.id,
            sort_order=i,
            collected_at=date(2026, i, 1),
        )
        db.add(ds)
    db.flush()
    return col


def test_get_collection_not_found(client):
    response = client.get("/api/v1/collections/99999")
    assert response.status_code == 404


def test_get_collection_with_datasets(client, db):
    col = _seed_collection(db)

    response = client.get(f"/api/v1/collections/{col.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Brand Tracker"
    assert data["collection_type"] == "survey"
    assert len(data["datasets"]) == 2
    sort_orders = [d["sort_order"] for d in data["datasets"]]
    assert sort_orders == sorted(sort_orders)
