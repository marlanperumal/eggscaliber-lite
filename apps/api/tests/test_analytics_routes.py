import pytest
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset, WorkerType
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response


async def _seed_measure_fixture(db):
    """Dataset with brand_rating (ordinal), gender (categorical), weight (weight), nps (numeric)."""
    pkg = Package(name="PM", slug="pm-measure")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(name="CM", slug="cm-measure", collection_type=CollectionType.survey)
    db.add(col)
    await db.flush()
    await db.refresh(col)
    ds = Dataset(
        name="Wave 1",
        slug="w1-measure",
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
    weight_field = Field(
        field_key="pw",
        display_name="Panel Weight",
        field_type=FieldType.weight,
        dataset_id=ds.id,
    )
    nps_field = Field(
        field_key="nps",
        display_name="NPS Score",
        field_type=FieldType.numeric,
        dataset_id=ds.id,
    )
    db.add_all([brand_field, weight_field, nps_field])
    await db.flush()
    await db.refresh(brand_field)

    for val in ["Good", "Poor"]:
        db.add(Level(field_id=brand_field.id, value=val, display_label=val, sort_order=0))
    await db.flush()

    db.add(Response(dataset_id=ds.id, payload={"brand_rating": "Good", "pw": 2.0, "nps": 8.0}))
    db.add(Response(dataset_id=ds.id, payload={"brand_rating": "Good", "pw": 1.0, "nps": 6.0}))
    db.add(Response(dataset_id=ds.id, payload={"brand_rating": "Poor", "pw": 1.5, "nps": 3.0}))
    await db.flush()
    return ds


async def _seed_trend_fixture(db):
    pkg = Package(name="P2", slug="p2")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="Brand Tracker",
        slug="bt",
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
    col = Collection(name="C", slug="c", collection_type=CollectionType.survey)
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


@pytest.mark.parametrize(
    "rows,row_mode,columns,col_mode",
    [
        ([{"field_key": "f1"}, {"field_key": "f2"}], "nested", [], "stacked"),
        ([{"field_key": f"f{i}"} for i in range(1, 6)], "stacked", [], "stacked"),
        ([{"field_key": "f1"}], "stacked", [{"field_key": "c1"}, {"field_key": "c2"}], "nested"),
    ],
)
async def test_crosstab_at_field_limit_passes_validation(client, rows, row_mode, columns, col_mode):
    # At-limit requests must pass validation and reach the DB layer (404, not 422).
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": 99999,
            "rows": rows,
            "row_mode": row_mode,
            "columns": columns,
            "col_mode": col_mode,
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


async def test_crosstab_nested_row_mode_returns_four_part_key(client, db):
    ds = await _seed_crosstab_fixture(db)
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": ds.id,
            "rows": [{"field_key": "brand_rating"}, {"field_key": "gender"}],
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
    assert resp.status_code == 200
    data = resp.json()
    keys = [r["key"] for r in data["rows"]]
    # Nested mode produces 4-part keys: [field1, level1, field2, level2]
    assert all(len(k) == 4 for k in keys)
    assert ["brand_rating", "Good", "gender", "Female"] in keys
    assert ["brand_rating", "Good", "gender", "Male"] in keys


async def test_crosstab_with_filters_reduces_base_n_and_row_counts(client, db):
    ds = await _seed_crosstab_fixture(db)
    # Seed has 3 responses: 2 Female, 1 Male. Filter to Female-only → base_n should be 2.
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": ds.id,
            "rows": [{"field_key": "brand_rating"}],
            "row_mode": "stacked",
            "columns": [],
            "col_mode": "stacked",
            "filters": [{"field_key": "gender", "levels": ["Female"], "value_range": None}],
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
    assert data["meta"]["base_n"] == 2
    good = next(r for r in data["rows"] if r["key"] == ["brand_rating", "Good"])
    poor = next(r for r in data["rows"] if r["key"] == ["brand_rating", "Poor"])
    assert good["values"]["Total"] == 1.0
    assert poor["values"]["Total"] == 1.0


async def test_trend_with_filters_reduces_results(client, db):
    col = await _seed_trend_fixture(db)
    # Seed has 3 responses per wave: 2 Aware, 1 Not Aware.
    # Filter to Aware-only → only Aware rows survive; Not Aware rows have 0 count.
    resp = await client.post(
        "/api/v1/analytics/trend",
        json={
            "collection_id": col.id,
            "fields": [{"field_key": "brand_awareness"}],
            "breakdown": None,
            "filters": [{"field_key": "brand_awareness", "levels": ["Aware"], "value_range": None}],
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
    aware_rows = [r for r in data["rows"] if r["key"][2] == "Aware"]
    not_aware_rows = [r for r in data["rows"] if r["key"][2] == "Not Aware"]
    # All Aware rows should have count 2 (only Aware responses survive the filter)
    assert all(r["values"]["Total"] == 2.0 for r in aware_rows)
    # Not Aware rows are still emitted (level exists in metadata) but have count 0
    assert all(r["values"]["Total"] == 0.0 for r in not_aware_rows)


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


async def test_crosstab_weighted_measure_sums_weights_per_level(client, db):
    # Seed: 2 Good responses (pw=2.0, pw=1.0), 1 Poor response (pw=1.5).
    # Weighted total for Good = 3.0, Poor = 1.5.
    ds = await _seed_measure_fixture(db)
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": ds.id,
            "rows": [{"field_key": "brand_rating"}],
            "row_mode": "stacked",
            "columns": [],
            "col_mode": "stacked",
            "filters": [],
            "measure": {
                "type": "weighted",
                "field_key": "pw",
                "aggregation": None,
                "display": "n",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    rows = data["rows"]
    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    poor = next(r for r in rows if r["key"] == ["brand_rating", "Poor"])
    assert good["values"]["Total"] == pytest.approx(3.0)
    assert poor["values"]["Total"] == pytest.approx(1.5)


async def test_crosstab_value_field_sum_measure_sums_numeric_field_per_level(client, db):
    # Seed: Good rows have nps 8.0 + 6.0 = 14.0; Poor row has nps 3.0.
    ds = await _seed_measure_fixture(db)
    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": ds.id,
            "rows": [{"field_key": "brand_rating"}],
            "row_mode": "stacked",
            "columns": [],
            "col_mode": "stacked",
            "filters": [],
            "measure": {
                "type": "value_field",
                "field_key": "nps",
                "aggregation": "sum",
                "display": "n",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    rows = data["rows"]
    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    poor = next(r for r in rows if r["key"] == ["brand_rating", "Poor"])
    assert good["values"]["Total"] == pytest.approx(14.0)
    assert poor["values"]["Total"] == pytest.approx(3.0)


async def test_crosstab_nested_col_mode_returns_composite_column_keys(client, db):
    # Two col fields in nested mode → column keys use "field_key|level" composite format.
    ds = await _seed_crosstab_fixture(db)
    # Add a region field to the existing fixture dataset so we have 2 col fields.
    region_field = Field(
        field_key="region",
        display_name="Region",
        field_type=FieldType.categorical,
        dataset_id=ds.id,
    )
    db.add(region_field)
    await db.flush()
    await db.refresh(region_field)
    for val in ["North", "South"]:
        db.add(Level(field_id=region_field.id, value=val, display_label=val, sort_order=0))
    # Patch existing responses to include region (they currently have brand_rating + gender).
    # Easier: add fresh responses that carry all three fields.
    db.add(
        Response(
            dataset_id=ds.id,
            payload={"brand_rating": "Good", "gender": "Female", "region": "North"},
        )
    )
    db.add(
        Response(
            dataset_id=ds.id,
            payload={"brand_rating": "Good", "gender": "Male", "region": "South"},
        )
    )
    await db.flush()

    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": ds.id,
            "rows": [{"field_key": "brand_rating"}],
            "row_mode": "stacked",
            "columns": [{"field_key": "gender"}, {"field_key": "region"}],
            "col_mode": "nested",
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
    rows = data["rows"]
    assert len(rows) > 0
    # With 2 col fields, values use composite "field_key|level" keys.
    sample_values = rows[0]["values"]
    col_keys = set(sample_values.keys()) - {"Total"}
    assert any("|" in k for k in col_keys), f"Expected composite keys but got: {col_keys}"
    assert "gender|Female" in sample_values or "gender|Male" in sample_values


async def test_crosstab_pct_col_display_returns_percentage_values(client, db):
    # Seed: 2 Good (Female + Male), 1 Poor (Female) → 3 Female total, 1 Male total, 3 Grand total.
    # pct_col for Good/Female = 1/2*100 = 50%, Good/Male = 1/1*100 = 100%, Good/Total = 2/3*100 ≈ 66.7%
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
                "display": "pct_col",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    rows = data["rows"]
    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    # pct_col: each cell divided by its column total × 100
    assert good["values"]["Female"] == pytest.approx(50.0, abs=0.1)
    assert good["values"]["Male"] == pytest.approx(100.0, abs=0.1)
    assert good["values"]["Total"] == pytest.approx(66.7, abs=0.1)


async def test_crosstab_pct_row_display_returns_percentage_values(client, db):
    # Seed: Good has Female=1, Male=1 (Total=2); Poor has Female=1, Male=0 (Total=1).
    # pct_row for Good: Female=50%, Male=50%, Total=100%
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
                "display": "pct_row",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    rows = data["rows"]
    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good["values"]["Female"] == pytest.approx(50.0, abs=0.1)
    assert good["values"]["Male"] == pytest.approx(50.0, abs=0.1)
    assert good["values"]["Total"] == pytest.approx(100.0, abs=0.1)
    poor = next(r for r in rows if r["key"] == ["brand_rating", "Poor"])
    assert poor["values"]["Female"] == pytest.approx(100.0, abs=0.1)
    assert poor["values"]["Total"] == pytest.approx(100.0, abs=0.1)


async def _seed_trend_weighted_fixture(db):
    """Collection with 2 datasets, each having brand_awareness (categorical) + pw (weight)."""
    pkg = Package(name="P3", slug="p3-tw")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="Weighted Tracker",
        slug="wt-tracker",
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    ds1 = Dataset(
        name="Wave 1",
        slug="w1-tw",
        collection_id=col.id,
        worker_type=WorkerType.jsonb_response,
        sort_order=0,
    )
    ds2 = Dataset(
        name="Wave 2",
        slug="w2-tw",
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
        pw = Field(
            field_key="pw",
            display_name="Panel Weight",
            field_type=FieldType.weight,
            dataset_id=ds.id,
        )
        db.add_all([f, pw])
        await db.flush()
        await db.refresh(f)
        for val in ["Aware", "Not Aware"]:
            db.add(Level(field_id=f.id, value=val, display_label=val, sort_order=0))
        # 2 Aware (pw=2.0, pw=1.0), 1 Not Aware (pw=1.5)
        db.add(Response(dataset_id=ds.id, payload={"brand_awareness": "Aware", "pw": 2.0}))
        db.add(Response(dataset_id=ds.id, payload={"brand_awareness": "Aware", "pw": 1.0}))
        db.add(Response(dataset_id=ds.id, payload={"brand_awareness": "Not Aware", "pw": 1.5}))
    await db.flush()
    return col


async def test_trend_weighted_measure_sums_weights_per_wave_per_level(client, db):
    # Each wave: Aware weighted total = 2.0+1.0 = 3.0, Not Aware = 1.5.
    col = await _seed_trend_weighted_fixture(db)
    resp = await client.post(
        "/api/v1/analytics/trend",
        json={
            "collection_id": col.id,
            "fields": [{"field_key": "brand_awareness"}],
            "breakdown": None,
            "filters": [],
            "measure": {
                "type": "weighted",
                "field_key": "pw",
                "aggregation": None,
                "display": "n",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    for wave in ["Wave 1", "Wave 2"]:
        aware = next(r for r in data["rows"] if r["key"] == [wave, "brand_awareness", "Aware"])
        not_aware = next(
            r for r in data["rows"] if r["key"] == [wave, "brand_awareness", "Not Aware"]
        )
        assert aware["values"]["Total"] == pytest.approx(3.0)
        assert not_aware["values"]["Total"] == pytest.approx(1.5)
