from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response


def _seed_dataset(db):
    pkg = Package(name="P", slug="p-ds-test")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)

    col = Collection(
        name="C", slug="c-ds-test", package_id=pkg.id, collection_type=CollectionType.survey
    )
    db.add(col)
    db.flush()
    db.refresh(col)

    ds = Dataset(name="Wave 1", slug="wave-1-ds-test", collection_id=col.id, sort_order=1)
    db.add(ds)
    db.flush()
    db.refresh(ds)

    f = Field(
        field_key="gender",
        display_name="Gender",
        field_type=FieldType.categorical,
        dataset_id=ds.id,
    )
    db.add(f)
    db.flush()
    db.refresh(f)

    for i, (val, label) in enumerate([("male", "Male"), ("female", "Female")]):
        db.add(Level(value=val, display_label=label, sort_order=i, field_id=f.id))

    db.add(Response(dataset_id=ds.id, payload={"gender": "male"}))
    db.add(Response(dataset_id=ds.id, payload={"gender": "female"}))
    db.flush()
    return ds


def test_get_dataset_not_found(client):
    response = client.get("/api/v1/datasets/99999")
    assert response.status_code == 404


def test_get_dataset_with_fields_and_levels(client, db):
    ds = _seed_dataset(db)
    response = client.get(f"/api/v1/datasets/{ds.id}")
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


def test_get_dataset_responses_paginated(client, db):
    ds = _seed_dataset(db)
    response = client.get(f"/api/v1/datasets/{ds.id}/responses")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["page"] == 1
