from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response


async def _seed_dataset(db):
    pkg = Package(name="P", slug="p-ds-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    col = Collection(
        name="C", slug="c-ds-test", package_id=pkg.id, collection_type=CollectionType.survey
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    ds = Dataset(name="Wave 1", slug="wave-1-ds-test", collection_id=col.id, sort_order=1)
    db.add(ds)
    await db.flush()
    await db.refresh(ds)

    f = Field(
        field_key="gender",
        display_name="Gender",
        field_type=FieldType.categorical,
        dataset_id=ds.id,
    )
    db.add(f)
    await db.flush()
    await db.refresh(f)

    for i, (val, label) in enumerate([("male", "Male"), ("female", "Female")]):
        db.add(Level(value=val, display_label=label, sort_order=i, field_id=f.id))

    db.add(Response(dataset_id=ds.id, payload={"gender": "male"}))
    db.add(Response(dataset_id=ds.id, payload={"gender": "female"}))
    await db.flush()
    return ds


async def test_get_dataset_not_found(client):
    response = await client.get("/api/v1/datasets/99999")
    assert response.status_code == 404


async def test_get_dataset_with_fields_and_levels(client, db):
    ds = await _seed_dataset(db)
    response = await client.get(f"/api/v1/datasets/{ds.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Wave 1"
    assert len(data["fields"]) == 1
    field = data["fields"][0]
    assert field["field_key"] == "gender"
    assert field["field_type"] == "categorical"
    assert len(field["levels"]) == 2
    level_values = {lv["value"] for lv in field["levels"]}
    assert level_values == {"male", "female"}


async def test_get_dataset_responses_paginated(client, db):
    ds = await _seed_dataset(db)
    response = await client.get(f"/api/v1/datasets/{ds.id}/responses")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["page"] == 1


async def test_get_dataset_responses_page_2_returns_correct_slice(client, db):
    ds = await _seed_dataset(db)
    # page_size=1 with 2 total responses: page 2 should return 1 item
    response = await client.get(f"/api/v1/datasets/{ds.id}/responses?page=2&page_size=1")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["page"] == 2
    assert data["page_size"] == 1
    assert len(data["items"]) == 1


async def test_get_dataset_responses_page_size_limits_items(client, db):
    ds = await _seed_dataset(db)
    response = await client.get(f"/api/v1/datasets/{ds.id}/responses?page=1&page_size=1")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["page"] == 1
    assert data["page_size"] == 1
    assert len(data["items"]) == 1


async def test_get_dataset_responses_not_found(client):
    response = await client.get("/api/v1/datasets/99999/responses")
    assert response.status_code == 404


async def test_get_dataset_field_tree_not_found(client):
    response = await client.get("/api/v1/datasets/99999/field-tree")
    assert response.status_code == 404


async def test_get_dataset_weight_fields_not_found(client):
    response = await client.get("/api/v1/datasets/99999/weight-fields")
    assert response.status_code == 404
