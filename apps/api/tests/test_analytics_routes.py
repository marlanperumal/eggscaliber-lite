from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset, WorkerType
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response


async def _seed_trend_fixture(db):
    pkg = Package(name="P2", slug="p2")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="Brand Tracker",
        slug="bt",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    ds1 = Dataset(
        name="Wave 1",
        slug="w1-trend",
        collection_id=col.id,
        worker_type=WorkerType.jsonb_response,
        sort_order=0,
    )
    ds2 = Dataset(
        name="Wave 2",
        slug="w2-trend",
        collection_id=col.id,
        worker_type=WorkerType.jsonb_response,
        sort_order=1,
    )
    db.add_all([ds1, ds2])
    await db.flush()
    await db.refresh(ds1)
    await db.refresh(ds2)

    for ds in [ds1, ds2]:
        f = Field(
            field_key="brand_awareness",
            display_name="Brand Awareness",
            field_type=FieldType.categorical,
            dataset_id=ds.id,
        )
        db.add(f)
        await db.flush()
        await db.refresh(f)
        for val in ["Aware", "Not Aware"]:
            db.add(Level(field_id=f.id, value=val, display_label=val, sort_order=0))
        db.add(Response(dataset_id=ds.id, payload={"brand_awareness": "Aware"}))
        db.add(Response(dataset_id=ds.id, payload={"brand_awareness": "Not Aware"}))
        db.add(Response(dataset_id=ds.id, payload={"brand_awareness": "Aware"}))
    await db.flush()
    return col


async def test_trend_count_measure_returns_per_wave_per_level_rows(client, db):
    col = await _seed_trend_fixture(db)
    resp = await client.post(
        "/api/v1/analytics/trend",
        json={
            "collection_id": col.id,
            "fields": [{"field_key": "brand_awareness"}],
            "breakdown": None,
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
    keys = [r["key"] for r in data["rows"]]
    assert ["Wave 1", "brand_awareness", "Aware"] in keys
    assert ["Wave 2", "brand_awareness", "Aware"] in keys
    aware_w1 = next(r for r in data["rows"] if r["key"] == ["Wave 1", "brand_awareness", "Aware"])
    assert aware_w1["values"]["Total"] == 2.0
    assert all(set(r["values"].keys()) == {"Total"} for r in data["rows"])


async def _seed_crosstab_fixture(db):
    pkg = Package(name="P", slug="p")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(name="C", slug="c", package_id=pkg.id, collection_type=CollectionType.survey)
    db.add(col)
    await db.flush()
    await db.refresh(col)
    ds = Dataset(
        name="Wave 1",
        slug="w1",
        collection_id=col.id,
        worker_type=WorkerType.jsonb_response,
        sort_order=0,
    )
    db.add(ds)
    await db.flush()
    await db.refresh(ds)

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
    await db.flush()
    await db.refresh(brand_field)
    await db.refresh(gender_field)

    for val in ["Good", "Poor"]:
        db.add(Level(field_id=brand_field.id, value=val, display_label=val, sort_order=0))
    for val in ["Female", "Male"]:
        db.add(Level(field_id=gender_field.id, value=val, display_label=val, sort_order=0))
    await db.flush()

    db.add(Response(dataset_id=ds.id, payload={"brand_rating": "Good", "gender": "Female"}))
    db.add(Response(dataset_id=ds.id, payload={"brand_rating": "Good", "gender": "Male"}))
    db.add(Response(dataset_id=ds.id, payload={"brand_rating": "Poor", "gender": "Female"}))
    await db.flush()
    return ds


async def test_crosstab_count_measure_returns_cell_values_per_level(client, db):
    ds = await _seed_crosstab_fixture(db)
    resp = await client.post(
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


async def test_crosstab_dataset_not_found(client):
    resp = await client.post(
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


async def test_crosstab_nested_row_mode_at_limit_passes_validation(client):
    # Exactly 2 rows in nested mode is at the allowed limit — validation must pass.
    # Uses a nonexistent dataset so we get 404, not 422.
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": 99999,
            "rows": [{"field_key": "f1"}, {"field_key": "f2"}],
            "row_mode": "nested",
            "columns": [],
            "col_mode": "stacked",
            "filters": [],
            "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
        },
    )
    assert resp.status_code == 404


async def test_crosstab_stacked_row_mode_at_limit_passes_validation(client):
    # Exactly 5 rows in stacked mode is at the allowed limit — validation must pass.
    # Uses a nonexistent dataset so we get 404, not 422.
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": 99999,
            "rows": [
                {"field_key": "f1"},
                {"field_key": "f2"},
                {"field_key": "f3"},
                {"field_key": "f4"},
                {"field_key": "f5"},
            ],
            "row_mode": "stacked",
            "columns": [],
            "col_mode": "stacked",
            "filters": [],
            "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
        },
    )
    assert resp.status_code == 404


async def test_crosstab_nested_row_limit(client, db):
    ds = await _seed_crosstab_fixture(db)
    resp = await client.post(
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


async def test_crosstab_stacked_row_limit_exceeded_returns_422(client):
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": 1,
            "rows": [
                {"field_key": "f1"},
                {"field_key": "f2"},
                {"field_key": "f3"},
                {"field_key": "f4"},
                {"field_key": "f5"},
                {"field_key": "f6"},
            ],
            "row_mode": "stacked",
            "columns": [],
            "col_mode": "stacked",
            "filters": [],
            "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
        },
    )
    assert resp.status_code == 422


async def test_crosstab_nested_col_mode_at_limit_passes_validation(client):
    # Exactly 2 cols in nested mode is at the allowed limit — validation must pass.
    # Uses a nonexistent dataset so we get 404, not 422.
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": 99999,
            "rows": [{"field_key": "f1"}],
            "row_mode": "stacked",
            "columns": [{"field_key": "c1"}, {"field_key": "c2"}],
            "col_mode": "nested",
            "filters": [],
            "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
        },
    )
    assert resp.status_code == 404


async def test_crosstab_nested_col_limit_exceeded_returns_422(client, db):
    ds = await _seed_crosstab_fixture(db)
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": ds.id,
            "rows": [{"field_key": "brand_rating"}],
            "row_mode": "stacked",
            "columns": [
                {"field_key": "brand_rating"},
                {"field_key": "gender"},
                {"field_key": "extra"},
            ],
            "col_mode": "nested",
            "filters": [],
            "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
        },
    )
    assert resp.status_code == 422


async def test_trend_with_nonexistent_collection_returns_404(client):
    resp = await client.post(
        "/api/v1/analytics/trend",
        json={
            "collection_id": 99999,
            "fields": [{"field_key": "brand_awareness"}],
            "breakdown": None,
            "filters": [],
            "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
        },
    )
    assert resp.status_code == 404


async def test_trend_with_breakdown_returns_breakdown_level_columns(client, db):
    col = await _seed_trend_fixture(db)
    resp = await client.post(
        "/api/v1/analytics/trend",
        json={
            "collection_id": col.id,
            "fields": [{"field_key": "brand_awareness"}],
            "breakdown": {"field_key": "brand_awareness"},
            "filters": [],
            "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    for row in data["rows"]:
        assert "Aware" in row["values"]
        assert "Not Aware" in row["values"]
        assert "Total" in row["values"]
