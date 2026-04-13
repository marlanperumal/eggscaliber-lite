# Test Audit Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply all findings from the April 2026 test audit — add missing coverage for high-risk code paths, remove one redundant test, add a shared fixture, and rename tests to match project naming conventions.

**Architecture:** All changes are confined to `apps/api/tests/`. No production code changes. Each task is independently testable and committable. The production code already exists, so the TDD loop is: write test → run to verify it passes (not fails first).

**Tech Stack:** pytest, FastAPI TestClient, SQLAlchemy (transaction-rollback isolation), real Postgres test DB.

---

## File Map

| File | Changes |
|---|---|
| `apps/api/tests/conftest.py` | Add `bare_dataset` fixture (Package → Collection → Dataset) |
| `apps/api/tests/test_crosstab_service.py` | Add `aggregate_nested` test, `value_field` measure tests, `apply_filters` multi-response test; rename one test |
| `apps/api/tests/test_analytics_routes.py` | Add trend-not-found, stacked-row-limit, nested-col-limit, trend-with-breakdown tests; rename two tests |
| `apps/api/tests/test_workers.py` | Delete `test_factory_returns_jsonb_worker_explicitly`; update to use `bare_dataset` fixture |
| `apps/api/tests/test_field_tree.py` | Update to use `bare_dataset` fixture |

---

### Task 1: Add `aggregate_nested` happy-path unit test

**Files:**
- Modify: `apps/api/tests/test_crosstab_service.py`

- [ ] **Step 1: Add the test**

Append to `apps/api/tests/test_crosstab_service.py`:

```python
def test_aggregate_nested_two_row_fields_computes_four_part_key_and_cell_values():
    data = [
        {"region": "North", "channel": "TV", "gender": "Female"},
        {"region": "North", "channel": "TV", "gender": "Male"},
        {"region": "North", "channel": "Radio", "gender": "Female"},
        {"region": "South", "channel": "TV", "gender": "Female"},
    ]
    row_fields = [
        _fm("region", FieldType.categorical, ["North", "South"]),
        _fm("channel", FieldType.categorical, ["TV", "Radio"]),
    ]
    col_fields = [_fm("gender", FieldType.categorical, ["Female", "Male"])]
    from src.services.crosstab_service import aggregate_nested

    rows = aggregate_nested(data, row_fields, col_fields, MEASURE_COUNT)

    # Keys are [outer_field_key, outer_level, inner_field_key, inner_level]
    keys = [r["key"] for r in rows]
    assert ["region", "North", "channel", "TV"] in keys
    assert ["region", "North", "channel", "Radio"] in keys
    assert ["region", "South", "channel", "TV"] in keys

    north_tv = next(r for r in rows if r["key"] == ["region", "North", "channel", "TV"])
    assert north_tv["values"]["Female"] == 1.0
    assert north_tv["values"]["Male"] == 1.0
    assert north_tv["values"]["Total"] == 2.0

    north_radio = next(r for r in rows if r["key"] == ["region", "North", "channel", "Radio"])
    assert north_radio["values"]["Female"] == 1.0
    assert north_radio["values"]["Male"] == 0.0
    assert north_radio["values"]["Total"] == 1.0
```

- [ ] **Step 2: Run the test**

```bash
just test-api tests/test_crosstab_service.py::test_aggregate_nested_two_row_fields_computes_four_part_key_and_cell_values -v
```

Expected: PASSED

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): add aggregate_nested happy-path unit test

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/api/tests/test_crosstab_service.py
git commit -F /tmp/commit-msg.txt
```

---

### Task 2: Add `value_field` measure tests

**Files:**
- Modify: `apps/api/tests/test_crosstab_service.py`

- [ ] **Step 1: Add two tests**

Append to `apps/api/tests/test_crosstab_service.py`:

```python
def test_aggregate_stacked_value_field_sum_measure_sums_values_per_level():
    data = [
        {"brand_rating": "Good", "nps": 8.0},
        {"brand_rating": "Good", "nps": 6.0},
        {"brand_rating": "Poor", "nps": 3.0},
    ]
    measure = {"type": "value_field", "field_key": "nps", "aggregation": "sum", "display": "n"}
    row_fields = [_fm("brand_rating", FieldType.ordinal, ["Good", "Poor"])]
    rows = aggregate_stacked(data, row_fields, [], measure)

    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good["values"]["Total"] == pytest.approx(14.0)

    poor = next(r for r in rows if r["key"] == ["brand_rating", "Poor"])
    assert poor["values"]["Total"] == pytest.approx(3.0)


def test_aggregate_stacked_value_field_mean_measure_averages_values_per_level():
    data = [
        {"brand_rating": "Good", "nps": 8.0},
        {"brand_rating": "Good", "nps": 6.0},
        {"brand_rating": "Poor", "nps": 3.0},
    ]
    measure = {"type": "value_field", "field_key": "nps", "aggregation": "mean", "display": "n"}
    row_fields = [_fm("brand_rating", FieldType.ordinal, ["Good", "Poor"])]
    rows = aggregate_stacked(data, row_fields, [], measure)

    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good["values"]["Total"] == pytest.approx(7.0)

    poor = next(r for r in rows if r["key"] == ["brand_rating", "Poor"])
    assert poor["values"]["Total"] == pytest.approx(3.0)
```

- [ ] **Step 2: Run the tests**

```bash
just test-api tests/test_crosstab_service.py::test_aggregate_stacked_value_field_sum_measure_sums_values_per_level tests/test_crosstab_service.py::test_aggregate_stacked_value_field_mean_measure_averages_values_per_level -v
```

Expected: both PASSED

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): add value_field measure sum and mean unit tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/api/tests/test_crosstab_service.py
git commit -F /tmp/commit-msg.txt
```

---

### Task 3: Add `apply_filters` multi-response test

**Files:**
- Modify: `apps/api/tests/test_crosstab_service.py`

- [ ] **Step 1: Add the test**

Append to `apps/api/tests/test_crosstab_service.py`:

```python
def test_apply_filters_multi_response_keeps_rows_containing_any_selected_level():
    data = [
        {"tags": ["fun", "reliable"], "brand_rating": "Good"},
        {"tags": ["reliable"], "brand_rating": "Good"},
        {"tags": ["fun"], "brand_rating": "Poor"},
        {"tags": ["expensive"], "brand_rating": "Poor"},
    ]
    filters = [{"field_key": "tags", "levels": ["fun"], "value_range": None}]
    field_metas = {"tags": {"field_type": FieldType.multi_response}}
    result = apply_filters(data, filters, field_metas)

    assert len(result) == 2
    assert all("fun" in r["tags"] for r in result)
```

- [ ] **Step 2: Run the test**

```bash
just test-api tests/test_crosstab_service.py::test_apply_filters_multi_response_keeps_rows_containing_any_selected_level -v
```

Expected: PASSED

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): add apply_filters multi-response coverage

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/api/tests/test_crosstab_service.py
git commit -F /tmp/commit-msg.txt
```

---

### Task 4: Add analytics route validation and trend error tests

**Files:**
- Modify: `apps/api/tests/test_analytics_routes.py`

- [ ] **Step 1: Add four tests**

Append to `apps/api/tests/test_analytics_routes.py`:

```python
def test_crosstab_stacked_row_limit_exceeded_returns_422(client):
    resp = client.post(
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


def test_crosstab_nested_col_limit_exceeded_returns_422(client, db):
    ds = _seed_crosstab_fixture(db)
    resp = client.post(
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


def test_trend_with_nonexistent_collection_returns_404(client):
    resp = client.post(
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


def test_trend_with_breakdown_returns_breakdown_level_columns(client, db):
    col = _seed_trend_fixture(db)
    resp = client.post(
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
    # Each row's values dict should contain breakdown-level keys ("Aware", "Not Aware") + "Total"
    for row in data["rows"]:
        assert "Aware" in row["values"]
        assert "Not Aware" in row["values"]
        assert "Total" in row["values"]
```

- [ ] **Step 2: Run all four tests**

```bash
just test-api tests/test_analytics_routes.py::test_crosstab_stacked_row_limit_exceeded_returns_422 tests/test_analytics_routes.py::test_crosstab_nested_col_limit_exceeded_returns_422 tests/test_analytics_routes.py::test_trend_with_nonexistent_collection_returns_404 tests/test_analytics_routes.py::test_trend_with_breakdown_returns_breakdown_level_columns -v
```

Expected: all four PASSED

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): add missing analytics route validation and trend error tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/api/tests/test_analytics_routes.py
git commit -F /tmp/commit-msg.txt
```

---

### Task 5: Remove low-signal `test_factory_returns_jsonb_worker_explicitly`

**Files:**
- Modify: `apps/api/tests/test_workers.py`

- [ ] **Step 1: Delete the redundant test**

Remove the entire `test_factory_returns_jsonb_worker_explicitly` function from `apps/api/tests/test_workers.py` (the last function in the file):

```python
def test_factory_returns_jsonb_worker_explicitly(db):
    ds = _seed_worker_dataset(db)
    ds.worker_type = WorkerType.jsonb_response
    worker = WorkerFactory.for_dataset(ds, db)
    assert isinstance(worker, JsonbResponseWorker)
```

- [ ] **Step 2: Verify remaining tests still pass**

```bash
just test-api tests/test_workers.py -v
```

Expected: 5 tests PASSED (the explicitly test no longer appears)

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): remove redundant worker factory test

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/api/tests/test_workers.py
git commit -F /tmp/commit-msg.txt
```

---

### Task 6: Add shared `bare_dataset` fixture and update `test_field_tree` and `test_workers`

**Files:**
- Modify: `apps/api/tests/conftest.py`
- Modify: `apps/api/tests/test_field_tree.py`
- Modify: `apps/api/tests/test_workers.py`

- [ ] **Step 1: Add fixture to conftest**

Append to `apps/api/tests/conftest.py`:

```python
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.package import Package


@pytest.fixture
def bare_dataset(db):
    """Minimal Package → Collection → Dataset chain. Tests can add fields/responses on top."""
    pkg = Package(name="Test Package", slug="test-pkg-fixture")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)

    col = Collection(
        name="Test Collection",
        slug="test-col-fixture",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    db.flush()
    db.refresh(col)

    ds = Dataset(name="Test Dataset", slug="test-ds-fixture", collection_id=col.id, sort_order=0)
    db.add(ds)
    db.flush()
    db.refresh(ds)
    return ds
```

- [ ] **Step 2: Refactor `test_field_tree.py` to use the fixture**

Replace the `_seed_dataset` helper function and all its call sites in `apps/api/tests/test_field_tree.py`. Remove the entire `_seed_dataset` function definition, then replace every `_seed_dataset(db)` call with `bare_dataset`. The function signatures for each test that currently takes `(db)` will instead take `(bare_dataset)` (the fixture provides the `Dataset` directly).

The file's test functions change from:

```python
def test_get_field_tree_empty_dataset(db):
    ds = _seed_dataset(db)
    ...
```

to:

```python
def test_get_field_tree_empty_dataset(bare_dataset):
    ds = bare_dataset
    ...
```

Apply this substitution for all seven tests in the file:
- `test_get_field_tree_empty_dataset`
- `test_get_field_tree_returns_groups_and_fields`
- `test_get_field_tree_nested_groups`
- `test_get_field_tree_excludes_identifier_and_weight`
- `test_get_weight_fields`
- `test_get_field_metas`
- `test_get_field_tree_endpoint_not_found` — this one does NOT use `_seed_dataset`; leave its signature (`client`) unchanged
- `test_get_field_tree_endpoint_returns_tree` — uses `_seed_dataset(db)`, so update signature to `(client, bare_dataset)` and replace `ds = _seed_dataset(db)` with `ds = bare_dataset`
- `test_get_weight_fields_endpoint` — same pattern
- `test_get_weight_fields_endpoint_not_found` — uses only `client`, no dataset; leave unchanged

After the edit the full file should look like this:

```python
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.level import Level
from src.repositories import analytics_repo


def test_get_field_tree_empty_dataset(bare_dataset):
    ds = bare_dataset
    tree = analytics_repo.get_field_tree(ds._sa_instance_state.session, ds.id)
    assert tree["groups"] == []
    assert tree["ungrouped_fields"] == []
```

Wait — the `bare_dataset` fixture provides a `Dataset`, but the test also needs the `db` session to add more objects. For tests that add objects to the DB, the signature needs both. Let me re-think.

The right approach: use `bare_dataset` as the dataset source, but keep `db` in scope for tests that add additional records. The `bare_dataset` fixture already depends on `db` (function-scoped), so requesting both in the same test is safe — pytest shares the same `db` instance.

Final signature rules:
- Tests that only read the dataset (e.g. `test_get_field_tree_empty_dataset`): `(bare_dataset, db)` — `db` needed to pass to repo calls; `bare_dataset` for the dataset id. Actually the repo calls use `db` directly, so we still need `db`. So all tests keep `db`, and just replace `_seed_dataset(db)` with `bare_dataset`.

The full refactored `test_field_tree.py`:

```python
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.level import Level
from src.repositories import analytics_repo


def test_get_field_tree_empty_dataset(db, bare_dataset):
    tree = analytics_repo.get_field_tree(db, bare_dataset.id)
    assert tree["groups"] == []
    assert tree["ungrouped_fields"] == []


def test_get_field_tree_returns_groups_and_fields(db, bare_dataset):
    grp = FieldGroup(name="Brand", slug="brand", sort_order=0, dataset_id=bare_dataset.id)
    db.add(grp)
    db.flush()
    db.refresh(grp)
    f1 = Field(
        field_key="brand_rating",
        display_name="Brand Rating",
        field_type=FieldType.ordinal,
        dataset_id=bare_dataset.id,
        group_id=grp.id,
    )
    f2 = Field(
        field_key="gender",
        display_name="Gender",
        field_type=FieldType.categorical,
        dataset_id=bare_dataset.id,
    )
    db.add_all([f1, f2])
    db.flush()

    tree = analytics_repo.get_field_tree(db, bare_dataset.id)
    assert len(tree["groups"]) == 1
    assert tree["groups"][0]["name"] == "Brand"
    assert len(tree["groups"][0]["fields"]) == 1
    assert tree["groups"][0]["fields"][0]["field_key"] == "brand_rating"
    assert len(tree["ungrouped_fields"]) == 1
    assert tree["ungrouped_fields"][0]["field_key"] == "gender"


def test_get_field_tree_nested_groups(db, bare_dataset):
    parent = FieldGroup(name="Parent", slug="parent", sort_order=0, dataset_id=bare_dataset.id)
    db.add(parent)
    db.flush()
    db.refresh(parent)
    child = FieldGroup(
        name="Child", slug="child", sort_order=0, dataset_id=bare_dataset.id, parent_id=parent.id
    )
    db.add(child)
    db.flush()
    db.refresh(child)
    db.add(
        Field(
            field_key="f1",
            display_name="F1",
            field_type=FieldType.categorical,
            dataset_id=bare_dataset.id,
            group_id=child.id,
        )
    )
    db.flush()

    tree = analytics_repo.get_field_tree(db, bare_dataset.id)
    assert len(tree["groups"]) == 1
    assert tree["groups"][0]["name"] == "Parent"
    assert len(tree["groups"][0]["children"]) == 1
    assert tree["groups"][0]["children"][0]["name"] == "Child"
    assert len(tree["groups"][0]["children"][0]["fields"]) == 1


def test_get_field_tree_excludes_identifier_and_weight(db, bare_dataset):
    db.add(
        Field(
            field_key="rid",
            display_name="ID",
            field_type=FieldType.identifier,
            dataset_id=bare_dataset.id,
        )
    )
    db.add(
        Field(
            field_key="wt",
            display_name="Weight",
            field_type=FieldType.weight,
            dataset_id=bare_dataset.id,
        )
    )
    db.flush()
    tree = analytics_repo.get_field_tree(db, bare_dataset.id)
    all_keys = [f["field_key"] for f in tree["ungrouped_fields"]]
    assert "rid" not in all_keys
    assert "wt" not in all_keys


def test_get_weight_fields(db, bare_dataset):
    db.add(
        Field(
            field_key="pw",
            display_name="Panel Weight",
            field_type=FieldType.weight,
            dataset_id=bare_dataset.id,
        )
    )
    db.add(
        Field(
            field_key="brand_rating",
            display_name="Brand Rating",
            field_type=FieldType.ordinal,
            dataset_id=bare_dataset.id,
        )
    )
    db.flush()
    weights = analytics_repo.get_weight_fields(db, bare_dataset.id)
    assert len(weights) == 1
    assert weights[0].field_key == "pw"


def test_get_field_metas(db, bare_dataset):
    from src.models.level import Level

    f = Field(
        field_key="brand_rating",
        display_name="Brand Rating",
        field_type=FieldType.ordinal,
        dataset_id=bare_dataset.id,
    )
    db.add(f)
    db.flush()
    db.refresh(f)
    db.add(Level(value="good", display_label="Good", sort_order=0, field_id=f.id))
    db.add(Level(value="poor", display_label="Poor", sort_order=1, field_id=f.id))
    db.flush()

    metas = analytics_repo.get_field_metas(db, bare_dataset.id, ["brand_rating"])
    assert "brand_rating" in metas
    assert metas["brand_rating"]["field_type"] == FieldType.ordinal
    assert metas["brand_rating"]["levels"] == ["good", "poor"]


# ─── Route tests ─────────────────────────────────────────────────────────────


def test_get_field_tree_endpoint_not_found(client):
    resp = client.get("/api/v1/datasets/99999/field-tree")
    assert resp.status_code == 404


def test_get_field_tree_endpoint_returns_tree(client, db, bare_dataset):
    grp = FieldGroup(name="Brand", slug="brand", sort_order=0, dataset_id=bare_dataset.id)
    db.add(grp)
    db.flush()
    db.refresh(grp)
    db.add(
        Field(
            field_key="brand_rating",
            display_name="Brand Rating",
            field_type=FieldType.ordinal,
            dataset_id=bare_dataset.id,
            group_id=grp.id,
        )
    )
    db.flush()

    resp = client.get(f"/api/v1/datasets/{bare_dataset.id}/field-tree")
    assert resp.status_code == 200
    data = resp.json()
    assert "groups" in data
    assert "ungrouped_fields" in data
    assert data["groups"][0]["name"] == "Brand"


def test_get_weight_fields_endpoint(client, db, bare_dataset):
    db.add(
        Field(
            field_key="pw",
            display_name="Panel Weight",
            field_type=FieldType.weight,
            dataset_id=bare_dataset.id,
        )
    )
    db.flush()

    resp = client.get(f"/api/v1/datasets/{bare_dataset.id}/weight-fields")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["field_key"] == "pw"


def test_get_weight_fields_endpoint_not_found(client):
    resp = client.get("/api/v1/datasets/99999/weight-fields")
    assert resp.status_code == 404
```

- [ ] **Step 3: Refactor `test_workers.py` to use the fixture**

In `apps/api/tests/test_workers.py`, remove `_seed_worker_dataset` and update all tests that called it. The worker tests need responses, which `bare_dataset` doesn't include, so add the responses inline in a `worker_dataset` fixture local to this file:

```python
import pytest
from src.models.response import Response
from src.workers.factory import WorkerFactory
from src.workers.jsonb_response import JsonbResponseWorker


@pytest.fixture
def worker_dataset(bare_dataset, db):
    """bare_dataset + 3 responses for worker tests."""
    for payload in [
        {"gender": "Male", "age_group": "18-34"},
        {"gender": "Female", "age_group": "35-54"},
        {"gender": "Male", "age_group": "18-34"},
    ]:
        db.add(Response(dataset_id=bare_dataset.id, payload=payload))
    db.flush()
    return bare_dataset


def test_jsonb_worker_fetch_all_rows(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(worker_dataset.id, field_keys=[], filters={}))
    assert len(rows) == 3


def test_jsonb_worker_fetch_with_field_keys(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(worker_dataset.id, field_keys=["gender"], filters={}))
    assert all(set(r.keys()) == {"gender"} for r in rows)


def test_jsonb_worker_fetch_with_filter(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(worker_dataset.id, field_keys=[], filters={"gender": "Male"}))
    assert len(rows) == 2
    assert all(r["gender"] == "Male" for r in rows)


def test_jsonb_worker_count(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    assert worker.count(worker_dataset.id, filters={}) == 3
    assert worker.count(worker_dataset.id, filters={"gender": "Female"}) == 1


def test_factory_returns_jsonb_worker_for_default(worker_dataset, db):
    worker = WorkerFactory.for_dataset(worker_dataset, db)
    assert isinstance(worker, JsonbResponseWorker)
```

- [ ] **Step 4: Run full test suite to confirm nothing broken**

```bash
just test-api
```

Expected: all tests PASSED (same count as before minus the deleted test, plus the fixture refactor keeping parity)

- [ ] **Step 5: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): add bare_dataset fixture and refactor field_tree + worker tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/api/tests/conftest.py apps/api/tests/test_field_tree.py apps/api/tests/test_workers.py
git commit -F /tmp/commit-msg.txt
```

---

### Task 7: Rename tests to follow naming convention

**Files:**
- Modify: `apps/api/tests/test_analytics_routes.py`
- Modify: `apps/api/tests/test_crosstab_service.py`

- [ ] **Step 1: Rename in `test_analytics_routes.py`**

Apply these renames:

| Old name | New name |
|---|---|
| `test_trend_returns_rows` | `test_trend_count_measure_returns_per_wave_per_level_rows` |
| `test_crosstab_returns_rows` | `test_crosstab_count_measure_returns_cell_values_per_level` |

- [ ] **Step 2: Rename in `test_crosstab_service.py`**

| Old name | New name |
|---|---|
| `test_aggregate_stacked_count_single_row_single_col` | `test_aggregate_stacked_single_row_and_col_computes_count_per_level_and_total` |

- [ ] **Step 3: Run the full suite to confirm no collection errors**

```bash
just test-api
```

Expected: all tests PASSED

- [ ] **Step 4: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): rename tests to follow subject-condition-outcome convention

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add apps/api/tests/test_analytics_routes.py apps/api/tests/test_crosstab_service.py
git commit -F /tmp/commit-msg.txt
```
