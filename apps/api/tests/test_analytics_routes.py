from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset, WorkerType
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response


def _seed_crosstab_fixture(db):
    pkg = Package(name="P", slug="p")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)
    col = Collection(name="C", slug="c", package_id=pkg.id, collection_type=CollectionType.survey)
    db.add(col)
    db.flush()
    db.refresh(col)
    ds = Dataset(
        name="Wave 1",
        slug="w1",
        collection_id=col.id,
        worker_type=WorkerType.jsonb_response,
        sort_order=0,
    )
    db.add(ds)
    db.flush()
    db.refresh(ds)

    brand_field = Field(
        field_key="brand_rating",
        display_name="Brand Rating",
        field_type=FieldType.ordinal,
        dataset_id=ds.id,
    )
    gender_field = Field(
        field_key="gender",
        display_name="Gender",
        field_type=FieldType.categorical,
        dataset_id=ds.id,
    )
    db.add_all([brand_field, gender_field])
    db.flush()
    db.refresh(brand_field)
    db.refresh(gender_field)

    for val in ["Good", "Poor"]:
        db.add(Level(field_id=brand_field.id, value=val, display_label=val, sort_order=0))
    for val in ["Female", "Male"]:
        db.add(Level(field_id=gender_field.id, value=val, display_label=val, sort_order=0))
    db.flush()

    db.add(Response(dataset_id=ds.id, payload={"brand_rating": "Good", "gender": "Female"}))
    db.add(Response(dataset_id=ds.id, payload={"brand_rating": "Good", "gender": "Male"}))
    db.add(Response(dataset_id=ds.id, payload={"brand_rating": "Poor", "gender": "Female"}))
    db.flush()
    return ds


def test_crosstab_returns_rows(client, db):
    ds = _seed_crosstab_fixture(db)
    resp = client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": ds.id,
            "rows": [{"field_key": "brand_rating"}],
            "row_mode": "stacked",
            "columns": [{"field_key": "gender"}],
            "col_mode": "stacked",
            "filters": [],
            "measure": {
                "type": "count",
                "field_key": None,
                "aggregation": None,
                "display": "n",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["meta"]["base_n"] == 3
    assert data["meta"]["dataset_name"] == "Wave 1"
    rows = data["rows"]
    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good["values"]["Female"] == 1.0
    assert good["values"]["Male"] == 1.0
    assert good["values"]["Total"] == 2.0


def test_crosstab_dataset_not_found(client):
    resp = client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": 99999,
            "rows": [{"field_key": "x"}],
            "row_mode": "stacked",
            "columns": [],
            "col_mode": "stacked",
            "filters": [],
            "measure": {
                "type": "count",
                "field_key": None,
                "aggregation": None,
                "display": "n",
            },
        },
    )
    assert resp.status_code == 404


def test_crosstab_nested_row_limit(client, db):
    ds = _seed_crosstab_fixture(db)
    resp = client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": ds.id,
            "rows": [
                {"field_key": "brand_rating"},
                {"field_key": "gender"},
                {"field_key": "extra"},
            ],
            "row_mode": "nested",
            "columns": [],
            "col_mode": "stacked",
            "filters": [],
            "measure": {
                "type": "count",
                "field_key": None,
                "aggregation": None,
                "display": "n",
            },
        },
    )
    assert resp.status_code == 422
