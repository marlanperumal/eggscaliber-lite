# Analytics Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first end-to-end analytics experience — cross-tab and trending analysis with a field tree, query builder UI, and table + chart output, feature-flagged behind `analytics-engine`.

**Architecture:** FastAPI 3-layer backend (routes → services → repositories) with two new analytics endpoints and two dataset sub-endpoints. Python-side aggregation using the existing `DataWorker` abstraction. Next.js frontend with a 3-column resizable layout, URL-persisted query state, and Recharts for visualisation.

**Tech Stack:** FastAPI, SQLModel, Alembic, PostgreSQL, Next.js 16 App Router, openapi-fetch, react-resizable-panels, Recharts, PostHog feature flags.

---

## File Structure

### New backend files
- `apps/api/src/models/field_group.py` — FieldGroup SQLModel (table + read)
- `apps/api/src/repositories/analytics_repo.py` — field tree, weight fields, field metadata for analytics
- `apps/api/src/services/crosstab_service.py` — fetch + filter + aggregate for cross-tab
- `apps/api/src/services/trend_service.py` — fetch + aggregate across collection datasets
- `apps/api/src/routes/analytics.py` — request/response schemas + POST /crosstab, POST /trend

### Modified backend files
- `apps/api/src/models/field.py` — add `identifier`/`weight` FieldType values; add `group_id` FK
- `apps/api/src/routes/datasets.py` — add GET /field-tree, GET /weight-fields
- `apps/api/src/main.py` — include analytics router
- `apps/api/scripts/seed.py` — FieldGroup records + identifier/weight fields

### Backend test files
- `apps/api/tests/test_field_tree.py`
- `apps/api/tests/test_crosstab_service.py`
- `apps/api/tests/test_analytics_routes.py`

### New frontend files
- `apps/web/src/lib/api.ts` — openapi-fetch client
- `apps/web/src/app/analytics/page.tsx` — feature-flagged page
- `apps/web/src/app/analytics/analytics-types.ts` — TypeScript query config types
- `apps/web/src/app/analytics/useAnalyticsState.ts` — URL searchParams state hook
- `apps/web/src/app/analytics/AnalyticsLayout.tsx` — 3-column resizable + collapsible panels
- `apps/web/src/app/analytics/FieldTreePanel.tsx` — recursive field tree with search
- `apps/web/src/app/analytics/QueryBuilderPanel.tsx` — analysis config UI
- `apps/web/src/app/analytics/ResultsPanel.tsx` — chart + table wrapper
- `apps/web/src/app/analytics/AnalyticsTable.tsx` — pivot table renderer
- `apps/web/src/app/analytics/AnalyticsChart.tsx` — Recharts chart component

---

## Task 1: FieldGroup model + Field modifications

**Files:**
- Create: `apps/api/src/models/field_group.py`
- Modify: `apps/api/src/models/field.py`

- [ ] **Step 1: Create FieldGroup model**

```python
# apps/api/src/models/field_group.py
from datetime import UTC, datetime

from sqlmodel import Field as sql_field
from sqlmodel import SQLModel


class FieldGroupBase(SQLModel):
    name: str
    slug: str
    sort_order: int = 0
    dataset_id: int = sql_field(foreign_key="dataset.id")
    parent_id: int | None = sql_field(default=None, foreign_key="fieldgroup.id")


class FieldGroup(FieldGroupBase, table=True):
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(default_factory=lambda: datetime.now(UTC))


class FieldGroupRead(FieldGroupBase):
    id: int
    created_at: datetime
```

- [ ] **Step 2: Extend FieldType enum and add group_id to Field**

In `apps/api/src/models/field.py`, change:

```python
class FieldType(StrEnum):
    numeric = "numeric"
    ordinal = "ordinal"
    categorical = "categorical"
    multi_response = "multi_response"
    identifier = "identifier"
    weight = "weight"
```

Add `group_id` to `FieldBase`:

```python
class FieldBase(SQLModel):
    field_key: str
    display_name: str
    field_type: FieldType
    sort_order: int = 0
    is_filterable: bool = True
    dataset_id: int = sql_field(foreign_key="dataset.id")
    group_id: int | None = sql_field(default=None, foreign_key="fieldgroup.id")
```

- [ ] **Step 3: Commit**

```
feat(api): add FieldGroup model and extend FieldType with identifier/weight
```

---

## Task 2: Database migration + FieldGroup seed data

**Files:**
- Create: `apps/api/migrations/versions/<hash>_add_analytics_schema.py` (auto-generated)
- Modify: `apps/api/scripts/seed.py`

- [ ] **Step 1: Generate migration**

```bash
just db-migration "add_analytics_schema"
```

- [ ] **Step 2: Edit the generated migration**

Alembic autogenerate will create the `fieldgroup` table and add `group_id` to `field`, but **will not detect enum changes**. Open the generated file and add these lines at the top of `upgrade()`, before the `op.create_table` call:

```python
op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'identifier'")
op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'weight'")
```

The downgrade should drop the `group_id` column and `fieldgroup` table but cannot remove enum values from PostgreSQL — that is acceptable.

- [ ] **Step 3: Apply migration**

```bash
just db-migrate
```

Expected: `Running upgrade ... -> <hash>, add_analytics_schema`

- [ ] **Step 4: Run migration tests**

```bash
just test-api -k migration
```

Expected: PASS

- [ ] **Step 5: Add FieldGroup seed data**

In `apps/api/scripts/seed.py`, after the block that creates fields, add a helper and call it inside the Brand Tracker, Customer Satisfaction, and Market Share sections.

Insert after the `seed_brand_tracker` fields block:

```python
def _make_field_group(db, dataset_id, name, slug, sort_order, parent_id=None):
    fg = FieldGroup(
        name=name, slug=slug, sort_order=sort_order,
        dataset_id=dataset_id, parent_id=parent_id,
    )
    db.add(fg)
    db.flush()
    db.refresh(fg)
    return fg
```

Then for each wave dataset in Brand Tracker:

```python
# FieldGroups for brand tracker waves
for ds in brand_tracker_datasets:
    brand_grp = _make_field_group(db, ds.id, "Brand Perception", "brand-perception", 0)
    demo_grp  = _make_field_group(db, ds.id, "Demographics", "demographics", 1)
    # Assign group_id on the fields already created
    for f in db.execute(select(Field).where(Field.dataset_id == ds.id)).scalars():
        if f.field_key in ("brand_awareness", "brand_rating", "media_used"):
            f.group_id = brand_grp.id
        elif f.field_key in ("age_group", "gender"):
            f.group_id = demo_grp.id
    db.flush()
```

Also add `respondent_id` (identifier) and `panel_weight` (weight) fields to Brand Tracker seed:

```python
Field(field_key="respondent_id", display_name="Respondent ID",
      field_type=FieldType.identifier, sort_order=99, is_filterable=False,
      dataset_id=ds.id),
Field(field_key="panel_weight", display_name="Panel Weight",
      field_type=FieldType.weight, sort_order=100, is_filterable=False,
      dataset_id=ds.id),
```

And add `respondent_id`/`panel_weight` to each response payload in Brand Tracker:

```python
payload = {
    "respondent_id": str(uuid.uuid4()),
    "panel_weight": round(random.uniform(0.5, 1.5), 4),
    # ... existing fields ...
}
```

Add `import uuid` at the top of seed.py.

Remember to add `from src.models.field_group import FieldGroup` to seed.py imports.

- [ ] **Step 6: Run seed to verify**

```bash
just db-reset
```

Expected: no errors, seed runs cleanly.

- [ ] **Step 7: Commit**

```
feat(api): add FieldGroup migration and seed data with identifier/weight fields
```

---

## Task 3: analytics_repo — field metadata + field tree

**Files:**
- Create: `apps/api/src/repositories/analytics_repo.py`
- Create: `apps/api/tests/test_field_tree.py`

- [ ] **Step 1: Write failing tests**

```python
# apps/api/tests/test_field_tree.py
from src.models.dataset import Dataset, WorkerType
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.collection import Collection, CollectionType
from src.models.package import Package
from src.repositories import analytics_repo


def _seed_dataset(db):
    pkg = Package(name="P", slug="p"); db.add(pkg); db.flush(); db.refresh(pkg)
    col = Collection(name="C", slug="c", package_id=pkg.id,
                     collection_type=CollectionType.survey)
    db.add(col); db.flush(); db.refresh(col)
    ds = Dataset(name="D", slug="d", collection_id=col.id,
                 worker_type=WorkerType.jsonb_response, sort_order=0)
    db.add(ds); db.flush(); db.refresh(ds)
    return ds


def test_get_field_tree_empty_dataset(db):
    ds = _seed_dataset(db)
    tree = analytics_repo.get_field_tree(db, ds.id)
    assert tree["groups"] == []
    assert tree["ungrouped_fields"] == []


def test_get_field_tree_returns_groups_and_fields(db):
    ds = _seed_dataset(db)
    grp = FieldGroup(name="Brand", slug="brand", sort_order=0, dataset_id=ds.id)
    db.add(grp); db.flush(); db.refresh(grp)
    f1 = Field(field_key="brand_rating", display_name="Brand Rating",
               field_type=FieldType.ordinal, dataset_id=ds.id, group_id=grp.id)
    f2 = Field(field_key="gender", display_name="Gender",
               field_type=FieldType.categorical, dataset_id=ds.id)
    db.add_all([f1, f2]); db.flush()

    tree = analytics_repo.get_field_tree(db, ds.id)
    assert len(tree["groups"]) == 1
    assert tree["groups"][0]["name"] == "Brand"
    assert len(tree["groups"][0]["fields"]) == 1
    assert tree["groups"][0]["fields"][0]["field_key"] == "brand_rating"
    assert len(tree["ungrouped_fields"]) == 1
    assert tree["ungrouped_fields"][0]["field_key"] == "gender"


def test_get_field_tree_excludes_identifier_and_weight(db):
    ds = _seed_dataset(db)
    db.add(Field(field_key="rid", display_name="ID",
                 field_type=FieldType.identifier, dataset_id=ds.id))
    db.add(Field(field_key="wt", display_name="Weight",
                 field_type=FieldType.weight, dataset_id=ds.id))
    db.flush()
    tree = analytics_repo.get_field_tree(db, ds.id)
    all_keys = [f["field_key"] for f in tree["ungrouped_fields"]]
    assert "rid" not in all_keys
    assert "wt" not in all_keys


def test_get_weight_fields(db):
    ds = _seed_dataset(db)
    db.add(Field(field_key="pw", display_name="Panel Weight",
                 field_type=FieldType.weight, dataset_id=ds.id))
    db.add(Field(field_key="brand_rating", display_name="Brand Rating",
                 field_type=FieldType.ordinal, dataset_id=ds.id))
    db.flush()
    weights = analytics_repo.get_weight_fields(db, ds.id)
    assert len(weights) == 1
    assert weights[0].field_key == "pw"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
just test-api -k test_field_tree
```

Expected: ImportError or AttributeError — `analytics_repo` does not exist yet.

- [ ] **Step 3: Implement analytics_repo**

```python
# apps/api/src/repositories/analytics_repo.py
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.level import Level

_EXCLUDED_TYPES = {FieldType.identifier, FieldType.weight}


def get_dataset(session: Session, dataset_id: int) -> Dataset | None:
    return session.execute(
        select(Dataset).where(Dataset.id == dataset_id)
    ).scalars().first()


def get_weight_fields(session: Session, dataset_id: int) -> list[Field]:
    return session.execute(
        select(Field).where(
            Field.dataset_id == dataset_id,
            Field.field_type == FieldType.weight,
        ).order_by(Field.sort_order)
    ).scalars().all()


def get_field_tree(session: Session, dataset_id: int) -> dict:
    groups = session.execute(
        select(FieldGroup).where(FieldGroup.dataset_id == dataset_id)
        .order_by(FieldGroup.sort_order)
    ).scalars().all()

    fields = session.execute(
        select(Field).where(
            Field.dataset_id == dataset_id,
            Field.field_type.notin_(_EXCLUDED_TYPES),
        ).order_by(Field.sort_order)
    ).scalars().all()

    levels_by_field: dict[int, list] = {}
    for f in fields:
        lvls = session.execute(
            select(Level).where(Level.field_id == f.id).order_by(Level.sort_order)
        ).scalars().all()
        levels_by_field[f.id] = [
            {"value": lv.value, "display_label": lv.display_label, "sort_order": lv.sort_order}
            for lv in lvls
        ]

    def _field_out(f: Field) -> dict:
        return {
            "id": f.id,
            "field_key": f.field_key,
            "display_name": f.display_name,
            "field_type": f.field_type,
            "is_filterable": f.is_filterable,
            "levels": levels_by_field.get(f.id, []),
        }

    def _build_group(g: FieldGroup) -> dict:
        children = [_build_group(c) for c in groups if c.parent_id == g.id]
        group_fields = [_field_out(f) for f in fields if f.group_id == g.id]
        return {
            "id": g.id,
            "name": g.name,
            "slug": g.slug,
            "sort_order": g.sort_order,
            "parent_id": g.parent_id,
            "children": children,
            "fields": group_fields,
        }

    roots = [_build_group(g) for g in groups if g.parent_id is None]
    ungrouped = [_field_out(f) for f in fields if f.group_id is None]
    return {"groups": roots, "ungrouped_fields": ungrouped}


def get_field_metas(session: Session, dataset_id: int, field_keys: list[str]) -> dict:
    """Return {field_key: {field_type, levels: [str]}} for the given keys."""
    fields = session.execute(
        select(Field).where(
            Field.dataset_id == dataset_id,
            Field.field_key.in_(field_keys),
        )
    ).scalars().all()

    result = {}
    for f in fields:
        lvls = session.execute(
            select(Level).where(Level.field_id == f.id).order_by(Level.sort_order)
        ).scalars().all()
        result[f.field_key] = {
            "field_key": f.field_key,
            "display_name": f.display_name,
            "field_type": f.field_type,
            "levels": [lv.value for lv in lvls],
        }
    return result
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
just test-api -k test_field_tree
```

Expected: 4 PASS

- [ ] **Step 5: Commit**

```
feat(api): add analytics_repo with field tree and weight field queries
```

---

## Task 4: GET /datasets/{id}/field-tree and /weight-fields endpoints

**Files:**
- Modify: `apps/api/src/routes/datasets.py`
- Modify: `apps/api/tests/test_field_tree.py` (add route tests)

- [ ] **Step 1: Write failing route tests**

Append to `apps/api/tests/test_field_tree.py`:

```python
def test_get_field_tree_endpoint_not_found(client):
    resp = client.get("/api/v1/datasets/99999/field-tree")
    assert resp.status_code == 404


def test_get_field_tree_endpoint_returns_tree(client, db):
    ds = _seed_dataset(db)
    grp = FieldGroup(name="Brand", slug="brand", sort_order=0, dataset_id=ds.id)
    db.add(grp); db.flush(); db.refresh(grp)
    db.add(Field(field_key="brand_rating", display_name="Brand Rating",
                 field_type=FieldType.ordinal, dataset_id=ds.id, group_id=grp.id))
    db.flush()

    resp = client.get(f"/api/v1/datasets/{ds.id}/field-tree")
    assert resp.status_code == 200
    data = resp.json()
    assert "groups" in data
    assert "ungrouped_fields" in data
    assert data["groups"][0]["name"] == "Brand"


def test_get_weight_fields_endpoint(client, db):
    ds = _seed_dataset(db)
    db.add(Field(field_key="pw", display_name="Panel Weight",
                 field_type=FieldType.weight, dataset_id=ds.id))
    db.flush()

    resp = client.get(f"/api/v1/datasets/{ds.id}/weight-fields")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["field_key"] == "pw"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
just test-api -k "field_tree_endpoint or weight_fields_endpoint"
```

Expected: 404 — endpoints don't exist yet.

- [ ] **Step 3: Add endpoints to datasets.py**

```python
from src.repositories import analytics_repo

@router.get("/datasets/{dataset_id}/field-tree")
def get_field_tree(dataset_id: int, session: Session = Depends(get_session)):
    ds = dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return analytics_repo.get_field_tree(session, dataset_id)


class WeightFieldOut(SQLModel):
    id: int
    field_key: str
    display_name: str


@router.get("/datasets/{dataset_id}/weight-fields", response_model=list[WeightFieldOut])
def get_weight_fields(dataset_id: int, session: Session = Depends(get_session)):
    ds = dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return analytics_repo.get_weight_fields(session, dataset_id)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
just test-api -k test_field_tree
```

Expected: all PASS

- [ ] **Step 5: Regenerate shared types**

```bash
just generate-types
```

- [ ] **Step 6: Commit**

```
feat(api): add field-tree and weight-fields dataset endpoints
```

---

## Task 5: CrosstabService — stacked aggregation

**Files:**
- Create: `apps/api/src/services/crosstab_service.py`
- Create: `apps/api/tests/test_crosstab_service.py`

- [ ] **Step 1: Write failing tests for stacked count aggregation**

```python
# apps/api/tests/test_crosstab_service.py
import pytest
from src.services.crosstab_service import (
    aggregate_stacked,
    apply_filters,
    apply_display,
)
from src.models.field import FieldType


def _fm(field_key, field_type=FieldType.categorical, levels=None):
    return {
        "field_key": field_key,
        "field_type": field_type,
        "levels": levels or [],
        "display_name": field_key,
    }


DATA = [
    {"brand_rating": "Good", "gender": "Female"},
    {"brand_rating": "Good", "gender": "Male"},
    {"brand_rating": "Good", "gender": "Female"},
    {"brand_rating": "Poor", "gender": "Male"},
    {"brand_rating": "Poor", "gender": "Female"},
]

MEASURE_COUNT = {"type": "count", "field_key": None, "aggregation": None, "display": "n"}


def test_aggregate_stacked_count_single_row_single_col():
    row_fields = [_fm("brand_rating", FieldType.ordinal, ["Good", "Poor"])]
    col_fields = [_fm("gender", FieldType.categorical, ["Female", "Male"])]
    rows = aggregate_stacked(DATA, row_fields, col_fields, MEASURE_COUNT)

    assert len(rows) == 2
    good_row = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good_row["values"]["Female"] == 2.0
    assert good_row["values"]["Male"] == 1.0
    assert good_row["values"]["Total"] == 3.0

    poor_row = next(r for r in rows if r["key"] == ["brand_rating", "Poor"])
    assert poor_row["values"]["Female"] == 1.0
    assert poor_row["values"]["Male"] == 1.0
    assert poor_row["values"]["Total"] == 2.0


def test_aggregate_stacked_no_col_field():
    row_fields = [_fm("brand_rating", FieldType.ordinal, ["Good", "Poor"])]
    rows = aggregate_stacked(DATA, row_fields, [], MEASURE_COUNT)
    assert len(rows) == 2
    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good["values"] == {"Total": 3.0}


def test_aggregate_stacked_multi_response_row():
    data = [
        {"tags": ["fun", "reliable"], "gender": "Female"},
        {"tags": ["fun"], "gender": "Male"},
        {"tags": ["reliable"], "gender": "Female"},
    ]
    row_fields = [_fm("tags", FieldType.multi_response, ["fun", "reliable"])]
    col_fields = [_fm("gender", FieldType.categorical, ["Female", "Male"])]
    rows = aggregate_stacked(data, row_fields, col_fields, MEASURE_COUNT)
    fun_row = next(r for r in rows if r["key"] == ["tags", "fun"])
    assert fun_row["values"]["Female"] == 1.0
    assert fun_row["values"]["Male"] == 1.0
    assert fun_row["values"]["Total"] == 2.0


def test_apply_display_pct_col():
    raw = [
        {"key": ["brand_rating", "Good"], "values": {"Female": 2.0, "Male": 1.0, "Total": 3.0}},
        {"key": ["brand_rating", "Poor"], "values": {"Female": 1.0, "Male": 1.0, "Total": 2.0}},
    ]
    result = apply_display(raw, "pct_col")
    good = next(r for r in result if r["key"] == ["brand_rating", "Good"])
    # Female col total = 3, Good/Female = 2 → 66.7%
    assert good["values"]["Female"] == pytest.approx(66.7, abs=0.1)
    # Total col total = 5, Good/Total = 3 → 60.0%
    assert good["values"]["Total"] == pytest.approx(60.0, abs=0.1)


def test_apply_display_pct_row():
    raw = [
        {"key": ["brand_rating", "Good"], "values": {"Female": 2.0, "Male": 1.0, "Total": 3.0}},
    ]
    result = apply_display(raw, "pct_row")
    good = result[0]
    assert good["values"]["Female"] == pytest.approx(66.7, abs=0.1)
    assert good["values"]["Male"] == pytest.approx(33.3, abs=0.1)
    assert good["values"]["Total"] == pytest.approx(100.0, abs=0.1)


def test_apply_filters_levels():
    data = [
        {"gender": "Female", "brand_rating": "Good"},
        {"gender": "Male", "brand_rating": "Good"},
        {"gender": "Female", "brand_rating": "Poor"},
    ]
    filters = [{"field_key": "gender", "levels": ["Female"], "value_range": None}]
    field_metas = {"gender": {"field_type": FieldType.categorical}}
    result = apply_filters(data, filters, field_metas)
    assert len(result) == 2
    assert all(r["gender"] == "Female" for r in result)


def test_apply_filters_range():
    data = [{"nps": 5}, {"nps": 8}, {"nps": 2}]
    filters = [{"field_key": "nps", "levels": None, "value_range": [4, 9]}]
    field_metas = {"nps": {"field_type": FieldType.numeric}}
    result = apply_filters(data, filters, field_metas)
    assert len(result) == 2


def test_aggregate_stacked_weighted():
    data = [
        {"brand_rating": "Good", "gender": "Female", "pw": 1.5},
        {"brand_rating": "Good", "gender": "Male", "pw": 0.8},
        {"brand_rating": "Poor", "gender": "Female", "pw": 1.2},
    ]
    measure = {"type": "weighted", "field_key": "pw", "aggregation": None, "display": "n"}
    row_fields = [_fm("brand_rating", FieldType.ordinal, ["Good", "Poor"])]
    col_fields = [_fm("gender", FieldType.categorical, ["Female", "Male"])]
    rows = aggregate_stacked(data, row_fields, col_fields, measure)
    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good["values"]["Female"] == pytest.approx(1.5)
    assert good["values"]["Male"] == pytest.approx(0.8)
    assert good["values"]["Total"] == pytest.approx(2.3)
```

- [ ] **Step 2: Run to verify failures**

```bash
just test-api -k test_crosstab
```

Expected: ImportError — module not found.

- [ ] **Step 3: Implement crosstab_service.py**

```python
# apps/api/src/services/crosstab_service.py
from typing import Any

from src.models.field import FieldType


def _value_matches(row: dict, field_key: str, field_type: FieldType, level: str) -> bool:
    val = row.get(field_key)
    if field_type == FieldType.multi_response:
        return isinstance(val, list) and level in val
    return str(val) == str(level)


def _compute_measure(rows: list[dict], measure: dict) -> float:
    if measure["type"] == "count":
        return float(len(rows))
    if measure["type"] == "weighted":
        wk = measure["field_key"]
        return sum(float(r.get(wk, 0) or 0) for r in rows)
    if measure["type"] == "value_field":
        vk = measure["field_key"]
        vals = [float(r[vk]) for r in rows if r.get(vk) is not None]
        if not vals:
            return 0.0
        return sum(vals) if measure["aggregation"] == "sum" else sum(vals) / len(vals)
    return 0.0


def aggregate_stacked(
    data: list[dict],
    row_fields: list[dict],
    col_fields: list[dict],
    measure: dict,
) -> list[dict]:
    result = []
    for rf in row_fields:
        for level in rf["levels"]:
            row_data = [r for r in data if _value_matches(r, rf["field_key"], rf["field_type"], level)]
            values: dict[str, float] = {}
            for cf in col_fields:
                for col_level in cf["levels"]:
                    col_key = col_level if len(col_fields) == 1 else f"{cf['field_key']}|{col_level}"
                    col_data = [r for r in row_data if _value_matches(r, cf["field_key"], cf["field_type"], col_level)]
                    values[col_key] = _compute_measure(col_data, measure)
            values["Total"] = _compute_measure(row_data, measure)
            result.append({"key": [rf["field_key"], level], "values": values})
    return result


def aggregate_nested(
    data: list[dict],
    row_fields: list[dict],
    col_fields: list[dict],
    measure: dict,
) -> list[dict]:
    """Two-level nested rows: key = [outer_key, outer_level, inner_key, inner_level]."""
    if len(row_fields) < 2:
        return aggregate_stacked(data, row_fields, col_fields, measure)
    outer, inner = row_fields[0], row_fields[1]
    result = []
    for outer_level in outer["levels"]:
        outer_data = [r for r in data if _value_matches(r, outer["field_key"], outer["field_type"], outer_level)]
        for inner_level in inner["levels"]:
            inner_data = [r for r in outer_data if _value_matches(r, inner["field_key"], inner["field_type"], inner_level)]
            values: dict[str, float] = {}
            for cf in col_fields:
                for col_level in cf["levels"]:
                    col_key = col_level if len(col_fields) == 1 else f"{cf['field_key']}|{col_level}"
                    col_data = [r for r in inner_data if _value_matches(r, cf["field_key"], cf["field_type"], col_level)]
                    values[col_key] = _compute_measure(col_data, measure)
            values["Total"] = _compute_measure(inner_data, measure)
            result.append({
                "key": [outer["field_key"], outer_level, inner["field_key"], inner_level],
                "values": values,
            })
    return result


def apply_filters(data: list[dict], filters: list[dict], field_metas: dict) -> list[dict]:
    for f in filters:
        fk = f["field_key"]
        ft = field_metas.get(fk, {}).get("field_type", FieldType.categorical)
        levels = f.get("levels")
        value_range = f.get("value_range")

        if levels and ft == FieldType.multi_response:
            data = [r for r in data if any(lv in (r.get(fk) or []) for lv in levels)]
        elif levels:
            data = [r for r in data if str(r.get(fk, "")) in levels]
        elif value_range:
            lo, hi = value_range
            data = [r for r in data if r.get(fk) is not None and lo <= float(r[fk]) <= hi]
    return data


def apply_display(rows: list[dict], display: str) -> list[dict]:
    if display == "n":
        return rows
    col_keys = set()
    for row in rows:
        col_keys.update(row["values"].keys())

    if display == "pct_col":
        col_totals = {k: sum(r["values"].get(k, 0) for r in rows) for k in col_keys}
        for row in rows:
            for k in col_keys:
                total = col_totals[k]
                row["values"][k] = round(row["values"][k] / total * 100, 1) if total else 0.0

    elif display == "pct_row":
        for row in rows:
            row_total = row["values"].get("Total", sum(row["values"].values()))
            for k in row["values"]:
                row["values"][k] = round(row["values"][k] / row_total * 100, 1) if row_total else 0.0

    return rows
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
just test-api -k test_crosstab
```

Expected: all PASS

- [ ] **Step 5: Commit**

```
feat(api): implement CrosstabService aggregation (stacked, nested, filters, display)
```

---

## Task 6: POST /api/v1/analytics/crosstab route

**Files:**
- Create: `apps/api/src/routes/analytics.py`
- Modify: `apps/api/src/main.py`
- Create: `apps/api/tests/test_analytics_routes.py`

- [ ] **Step 1: Write failing integration tests**

```python
# apps/api/tests/test_analytics_routes.py
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset, WorkerType
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response


def _seed_crosstab_fixture(db):
    pkg = Package(name="P", slug="p"); db.add(pkg); db.flush(); db.refresh(pkg)
    col = Collection(name="C", slug="c", package_id=pkg.id,
                     collection_type=CollectionType.survey)
    db.add(col); db.flush(); db.refresh(col)
    ds = Dataset(name="Wave 1", slug="w1", collection_id=col.id,
                 worker_type=WorkerType.jsonb_response, sort_order=0)
    db.add(ds); db.flush(); db.refresh(ds)

    brand_field = Field(field_key="brand_rating", display_name="Brand Rating",
                        field_type=FieldType.ordinal, dataset_id=ds.id)
    gender_field = Field(field_key="gender", display_name="Gender",
                         field_type=FieldType.categorical, dataset_id=ds.id)
    db.add_all([brand_field, gender_field]); db.flush(); db.refresh(brand_field); db.refresh(gender_field)

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
    resp = client.post("/api/v1/analytics/crosstab", json={
        "dataset_id": ds.id,
        "rows": [{"field_key": "brand_rating"}],
        "row_mode": "stacked",
        "columns": [{"field_key": "gender"}],
        "col_mode": "stacked",
        "filters": [],
        "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
    })
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
    resp = client.post("/api/v1/analytics/crosstab", json={
        "dataset_id": 99999,
        "rows": [{"field_key": "x"}],
        "row_mode": "stacked",
        "columns": [],
        "col_mode": "stacked",
        "filters": [],
        "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
    })
    assert resp.status_code == 404


def test_crosstab_nested_row_limit(client, db):
    ds = _seed_crosstab_fixture(db)
    resp = client.post("/api/v1/analytics/crosstab", json={
        "dataset_id": ds.id,
        "rows": [{"field_key": "brand_rating"}, {"field_key": "gender"}, {"field_key": "extra"}],
        "row_mode": "nested",
        "columns": [],
        "col_mode": "stacked",
        "filters": [],
        "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
    })
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
just test-api -k test_crosstab_returns or test_crosstab_dataset or test_crosstab_nested
```

Expected: 404 — route not found.

- [ ] **Step 3: Create routes/analytics.py**

```python
# apps/api/src/routes/analytics.py
from typing import Any, Literal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlmodel import SQLModel

from src.database import get_session
from src.repositories import analytics_repo
from src.services import crosstab_service, trend_service
from src.workers.factory import WorkerFactory


router = APIRouter(tags=["analytics"])


class FieldSelection(SQLModel):
    field_key: str


class FilterSpec(SQLModel):
    field_key: str
    levels: list[str] | None = None
    value_range: tuple[float, float] | None = None


class MeasureSpec(SQLModel):
    type: Literal["count", "weighted", "value_field"]
    field_key: str | None = None
    aggregation: Literal["sum", "mean"] | None = None
    display: Literal["pct_col", "pct_row", "n"] = "n"


class CrosstabRequest(SQLModel):
    dataset_id: int
    rows: list[FieldSelection]
    row_mode: Literal["stacked", "nested"] = "stacked"
    columns: list[FieldSelection] = []
    col_mode: Literal["stacked", "nested"] = "stacked"
    filters: list[FilterSpec] = []
    measure: MeasureSpec


class MetaField(SQLModel):
    field_key: str
    display_name: str


class CrosstabMeta(SQLModel):
    mode: str = "crosstab"
    row_fields: list[MetaField]
    col_fields: list[MetaField]
    row_mode: str
    col_mode: str
    measure: MeasureSpec
    dataset_name: str
    base_n: int


class ResultRow(SQLModel):
    key: list[str]
    values: dict[str, float]


class CrosstabResponse(SQLModel):
    meta: CrosstabMeta
    rows: list[ResultRow]


@router.post("/analytics/crosstab", response_model=CrosstabResponse)
def run_crosstab(request: CrosstabRequest, session: Session = Depends(get_session)):
    # Validate limits
    if request.row_mode == "nested" and len(request.rows) > 2:
        raise HTTPException(422, "Nested row mode supports at most 2 fields")
    if request.row_mode == "stacked" and len(request.rows) > 5:
        raise HTTPException(422, "Stacked row mode supports at most 5 fields")
    if request.col_mode == "nested" and len(request.columns) > 2:
        raise HTTPException(422, "Nested col mode supports at most 2 fields")

    dataset = analytics_repo.get_dataset(session, request.dataset_id)
    if dataset is None:
        raise HTTPException(404, "Dataset not found")

    # Gather all field keys needed
    row_keys = [f.field_key for f in request.rows]
    col_keys = [f.field_key for f in request.columns]
    filter_keys = [f.field_key for f in request.filters]
    extra_keys = []
    if request.measure.type in ("weighted", "value_field") and request.measure.field_key:
        extra_keys.append(request.measure.field_key)
    all_keys = list(set(row_keys + col_keys + filter_keys + extra_keys))

    field_metas = analytics_repo.get_field_metas(session, request.dataset_id, all_keys)

    # Fetch data
    worker = WorkerFactory.for_dataset(dataset)
    data = list(worker.fetch(request.dataset_id, all_keys, {}))

    # Filter
    filters_raw = [f.model_dump() for f in request.filters]
    data = crosstab_service.apply_filters(data, filters_raw, field_metas)
    base_n = len(data)

    # Aggregate
    row_metas = [field_metas[k] for k in row_keys if k in field_metas]
    col_metas = [field_metas[k] for k in col_keys if k in field_metas]
    measure_dict = request.measure.model_dump()

    if request.row_mode == "nested" and len(row_metas) >= 2:
        raw_rows = crosstab_service.aggregate_nested(data, row_metas, col_metas, measure_dict)
    else:
        raw_rows = crosstab_service.aggregate_stacked(data, row_metas, col_metas, measure_dict)

    result_rows = crosstab_service.apply_display(raw_rows, request.measure.display)

    meta = CrosstabMeta(
        row_fields=[MetaField(field_key=m["field_key"], display_name=m["display_name"])
                    for m in row_metas],
        col_fields=[MetaField(field_key=m["field_key"], display_name=m["display_name"])
                    for m in col_metas],
        row_mode=request.row_mode,
        col_mode=request.col_mode,
        measure=request.measure,
        dataset_name=dataset.name,
        base_n=base_n,
    )
    return CrosstabResponse(meta=meta, rows=[ResultRow(**r) for r in result_rows])
```

- [ ] **Step 4: Register router in main.py**

```python
from src.routes import analytics, collections, datasets, health, packages, sentry

app.include_router(analytics.router, prefix="/api/v1")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
just test-api -k test_analytics_routes
```

Expected: all PASS

- [ ] **Step 6: Regenerate shared types**

```bash
just generate-types
```

- [ ] **Step 7: Commit**

```
feat(api): add POST /analytics/crosstab endpoint
```

---

## Task 7: TrendService + POST /api/v1/analytics/trend

**Files:**
- Create: `apps/api/src/services/trend_service.py`
- Modify: `apps/api/src/routes/analytics.py`
- Modify: `apps/api/tests/test_analytics_routes.py`

- [ ] **Step 1: Write failing tests**

Append to `apps/api/tests/test_analytics_routes.py`:

```python
from src.models.collection import Collection, CollectionType

def _seed_trend_fixture(db):
    pkg = Package(name="P2", slug="p2"); db.add(pkg); db.flush(); db.refresh(pkg)
    col = Collection(name="Brand Tracker", slug="bt", package_id=pkg.id,
                     collection_type=CollectionType.survey)
    db.add(col); db.flush(); db.refresh(col)

    ds1 = Dataset(name="Wave 1", slug="w1", collection_id=col.id,
                  worker_type=WorkerType.jsonb_response, sort_order=0)
    ds2 = Dataset(name="Wave 2", slug="w2", collection_id=col.id,
                  worker_type=WorkerType.jsonb_response, sort_order=1)
    db.add_all([ds1, ds2]); db.flush()
    db.refresh(ds1); db.refresh(ds2)

    for ds in [ds1, ds2]:
        f = Field(field_key="brand_awareness", display_name="Brand Awareness",
                  field_type=FieldType.categorical, dataset_id=ds.id)
        db.add(f); db.flush(); db.refresh(f)
        for val in ["Aware", "Not Aware"]:
            db.add(Level(field_id=f.id, value=val, display_label=val, sort_order=0))
        db.add(Response(dataset_id=ds.id, payload={"brand_awareness": "Aware"}))
        db.add(Response(dataset_id=ds.id, payload={"brand_awareness": "Not Aware"}))
        db.add(Response(dataset_id=ds.id, payload={"brand_awareness": "Aware"}))
    db.flush()
    return col


def test_trend_returns_rows(client, db):
    col = _seed_trend_fixture(db)
    resp = client.post("/api/v1/analytics/trend", json={
        "collection_id": col.id,
        "fields": [{"field_key": "brand_awareness"}],
        "breakdown": None,
        "filters": [],
        "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
    })
    assert resp.status_code == 200
    data = resp.json()
    keys = [r["key"] for r in data["rows"]]
    assert ["Wave 1", "brand_awareness", "Aware"] in keys
    assert ["Wave 2", "brand_awareness", "Aware"] in keys
    aware_w1 = next(r for r in data["rows"] if r["key"] == ["Wave 1", "brand_awareness", "Aware"])
    assert aware_w1["values"]["Total"] == 2.0
```

- [ ] **Step 2: Run to verify failure**

```bash
just test-api -k test_trend
```

Expected: 404

- [ ] **Step 3: Implement trend_service.py**

```python
# apps/api/src/services/trend_service.py
from src.models.field import FieldType
from src.services.crosstab_service import (
    _compute_measure,
    _value_matches,
    apply_filters,
    apply_display,
)


def run_trend(
    datasets_data: list[dict],  # [{dataset, data: list[dict], field_metas: dict}]
    field_keys: list[str],
    breakdown_key: str | None,
    field_metas_by_key: dict,
    measure: dict,
) -> list[dict]:
    """
    Returns ResultRow-shaped dicts with key = [dataset_name, field_key, level].
    If breakdown_key is set, col keys are breakdown levels; else just "Total".
    """
    result = []
    for entry in datasets_data:
        ds_name = entry["dataset_name"]
        data = entry["data"]
        for fk in field_keys:
            fm = field_metas_by_key.get(fk)
            if fm is None:
                continue
            for level in fm["levels"]:
                row_data = [r for r in data if _value_matches(r, fk, fm["field_type"], level)]
                values: dict[str, float] = {}
                if breakdown_key:
                    bm = field_metas_by_key.get(breakdown_key)
                    if bm:
                        for bl in bm["levels"]:
                            bd = [r for r in row_data
                                  if _value_matches(r, breakdown_key, bm["field_type"], bl)]
                            values[bl] = _compute_measure(bd, measure)
                values["Total"] = _compute_measure(row_data, measure)
                result.append({"key": [ds_name, fk, level], "values": values})
    return result
```

- [ ] **Step 4: Add TrendRequest schema and route to analytics.py**

```python
from src.repositories import collection_repo
from src.services import trend_service

class TrendRequest(SQLModel):
    collection_id: int
    fields: list[FieldSelection]
    breakdown: FieldSelection | None = None
    filters: list[FilterSpec] = []
    measure: MeasureSpec


class TrendMeta(SQLModel):
    mode: str = "trend"
    fields: list[MetaField]
    breakdown: MetaField | None
    measure: MeasureSpec
    collection_name: str


class TrendResponse(SQLModel):
    meta: TrendMeta
    rows: list[ResultRow]


@router.post("/analytics/trend", response_model=TrendResponse)
def run_trend(request: TrendRequest, session: Session = Depends(get_session)):
    col = collection_repo.get_by_id(session, request.collection_id)
    if col is None:
        raise HTTPException(404, "Collection not found")

    datasets = collection_repo.get_datasets_for_collection(session, request.collection_id)
    field_keys = [f.field_key for f in request.fields]
    breakdown_key = request.breakdown.field_key if request.breakdown else None
    filter_keys = [f.field_key for f in request.filters]
    all_keys = list(set(field_keys + ([breakdown_key] if breakdown_key else []) + filter_keys))

    # Build unified field metas across all datasets (use first dataset's definition)
    field_metas: dict = {}
    for ds in datasets:
        for k, v in analytics_repo.get_field_metas(session, ds.id, all_keys).items():
            if k not in field_metas:
                field_metas[k] = v

    measure_dict = request.measure.model_dump()
    datasets_data = []
    for ds in datasets:
        worker = WorkerFactory.for_dataset(ds)
        data = list(worker.fetch(ds.id, all_keys, {}))
        data = crosstab_service.apply_filters(data, [f.model_dump() for f in request.filters], field_metas)
        datasets_data.append({"dataset_name": ds.name, "data": data})

    raw_rows = trend_service.run_trend(
        datasets_data, field_keys, breakdown_key, field_metas, measure_dict
    )
    result_rows = crosstab_service.apply_display(raw_rows, request.measure.display)

    meta = TrendMeta(
        fields=[MetaField(field_key=k, display_name=field_metas[k]["display_name"])
                for k in field_keys if k in field_metas],
        breakdown=MetaField(field_key=breakdown_key,
                            display_name=field_metas[breakdown_key]["display_name"])
                  if breakdown_key and breakdown_key in field_metas else None,
        measure=request.measure,
        collection_name=col.name,
    )
    return TrendResponse(meta=meta, rows=[ResultRow(**r) for r in result_rows])
```

Add the missing import at the top of `analytics.py`: `from src.repositories import collection_repo`

- [ ] **Step 5: Run tests**

```bash
just test-api -k test_trend
```

Expected: PASS

- [ ] **Step 6: Run full test suite**

```bash
just test-api
```

Expected: all PASS

- [ ] **Step 7: Regenerate types**

```bash
just generate-types
```

- [ ] **Step 8: Commit**

```
feat(api): add TrendService and POST /analytics/trend endpoint
```

---

## Task 8: Frontend dependencies + API client

**Files:**
- Modify: `apps/web/package.json` (via pnpm)
- Create: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Check latest versions**

```bash
npm show recharts version
npm show react-resizable-panels version
```

Note the versions printed.

- [ ] **Step 2: Fetch Recharts docs for installed version**

Use the context7 MCP or WebFetch to read the Recharts docs for the version found in Step 1 before writing any chart integration code. Pay attention to `BarChart`, `LineChart`, `ComposedChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `Tooltip`, `Legend` API.

- [ ] **Step 3: Install libraries**

```bash
pnpm --filter web add recharts react-resizable-panels
```

- [ ] **Step 4: Create API client**

```typescript
// apps/web/src/lib/api.ts
import createClient from "openapi-fetch"
import type { paths } from "@eggscaliber/shared"

export const api = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
})
```

- [ ] **Step 5: Commit**

```
feat(web): add recharts, react-resizable-panels, and openapi-fetch client
```

---

## Task 9: Analytics page + feature flag gate

**Files:**
- Create: `apps/web/src/app/analytics/page.tsx`
- Create: `apps/web/src/app/analytics/analytics-types.ts`

- [ ] **Step 1: Create analytics-types.ts**

```typescript
// apps/web/src/app/analytics/analytics-types.ts
export type AnalysisMode = "crosstab" | "trend"
export type RowColMode = "stacked" | "nested"
export type MeasureType = "count" | "weighted" | "value_field"
export type DisplayType = "n" | "pct_col" | "pct_row"
export type ChartType = "grouped_bar" | "stacked_bar" | "stacked_bar_100" | "line"
export type ViewMode = "chart_only" | "table_only" | "stacked" | "side_by_side"

export interface FieldSelection {
  field_key: string
  display_name?: string
}

export interface FilterSpec {
  field_key: string
  display_name?: string
  levels?: string[]
  value_range?: [number, number]
}

export interface MeasureSpec {
  type: MeasureType
  field_key: string | null
  aggregation: "sum" | "mean" | null
  display: DisplayType
}

export interface QueryConfig {
  mode: AnalysisMode
  dataset_id: number | null
  collection_id: number | null
  rows: FieldSelection[]
  row_mode: RowColMode
  columns: FieldSelection[]
  col_mode: RowColMode
  breakdown: FieldSelection | null
  filters: FilterSpec[]
  measure: MeasureSpec
}

export interface ResultRow {
  key: string[]
  values: Record<string, number>
}

export interface AnalyticsResult {
  meta: {
    mode: string
    row_fields?: { field_key: string; display_name: string }[]
    col_fields?: { field_key: string; display_name: string }[]
    row_mode?: string
    col_mode?: string
    fields?: { field_key: string; display_name: string }[]
    breakdown?: { field_key: string; display_name: string } | null
    measure: MeasureSpec
    dataset_name?: string
    collection_name?: string
    base_n?: number
  }
  rows: ResultRow[]
}
```

- [ ] **Step 2: Create analytics page with feature flag gate**

```typescript
// apps/web/src/app/analytics/page.tsx
"use client"
import { notFound } from "next/navigation"
import { useFeatureFlag } from "@posthog/next"
import { AnalyticsLayout } from "./AnalyticsLayout"

export default function AnalyticsPage() {
  const showAnalytics = useFeatureFlag("analytics-engine")
  if (showAnalytics === false) notFound()
  if (showAnalytics === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }
  return <AnalyticsLayout />
}
```

- [ ] **Step 3: Commit**

```
feat(web): add /analytics page with analytics-engine feature flag gate
```

---

## Task 10: 3-column resizable + collapsible layout

**Files:**
- Create: `apps/web/src/app/analytics/AnalyticsLayout.tsx`

- [ ] **Step 1: Fetch react-resizable-panels docs**

```bash
npm show react-resizable-panels version
```

Then use context7 or WebFetch to read the react-resizable-panels docs for that version. Focus on `PanelGroup`, `Panel`, `PanelResizeHandle` API, and how to collapse panels programmatically.

- [ ] **Step 2: Create AnalyticsLayout**

```typescript
// apps/web/src/app/analytics/AnalyticsLayout.tsx
"use client"
import { useRef, useState, useCallback } from "react"
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels"
import { FieldTreePanel } from "./FieldTreePanel"
import { QueryBuilderPanel } from "./QueryBuilderPanel"
import { ResultsPanel } from "./ResultsPanel"
import type { AnalyticsResult, QueryConfig } from "./analytics-types"

const DEFAULT_SIZES = [20, 25, 55] // percentages
const STORAGE_KEY = "analytics-panel-sizes"

function loadSizes(): number[] {
  if (typeof window === "undefined") return DEFAULT_SIZES
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_SIZES
  } catch {
    return DEFAULT_SIZES
  }
}

export function AnalyticsLayout() {
  const [result, setResult] = useState<AnalyticsResult | null>(null)
  const [query, setQuery] = useState<QueryConfig | null>(null)
  const [treeCollapsed, setTreeCollapsed] = useState(false)
  const [builderCollapsed, setBuilderCollapsed] = useState(false)
  const treeRef = useRef<ImperativePanelHandle>(null)
  const builderRef = useRef<ImperativePanelHandle>(null)

  const handleLayout = useCallback((sizes: number[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes))
  }, [])

  const toggleTree = () => {
    if (treeCollapsed) { treeRef.current?.expand(); setTreeCollapsed(false) }
    else { treeRef.current?.collapse(); setTreeCollapsed(true) }
  }

  const toggleBuilder = () => {
    if (builderCollapsed) { builderRef.current?.expand(); setBuilderCollapsed(false) }
    else { builderRef.current?.collapse(); setBuilderCollapsed(true) }
  }

  const resetLayout = () => {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-lg font-semibold">Analytics</h1>
        <button onClick={resetLayout} className="text-muted-foreground text-xs hover:underline">
          Restore default layout
        </button>
      </div>
      <PanelGroup direction="horizontal" className="flex-1" onLayout={handleLayout}>
        <Panel
          ref={treeRef}
          defaultSize={loadSizes()[0]}
          minSize={3}
          collapsible
          collapsedSize={3}
          onCollapse={() => setTreeCollapsed(true)}
          onExpand={() => setTreeCollapsed(false)}
        >
          {treeCollapsed ? (
            <CollapsedStrip label="Fields" onClick={toggleTree} />
          ) : (
            <FieldTreePanel onCollapse={toggleTree} query={query} onQueryChange={setQuery} />
          )}
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
        <Panel
          ref={builderRef}
          defaultSize={loadSizes()[1]}
          minSize={3}
          collapsible
          collapsedSize={3}
          onCollapse={() => setBuilderCollapsed(true)}
          onExpand={() => setBuilderCollapsed(false)}
        >
          {builderCollapsed ? (
            <CollapsedStrip label="Query" onClick={toggleBuilder} />
          ) : (
            <QueryBuilderPanel
              onCollapse={toggleBuilder}
              query={query}
              onQueryChange={setQuery}
              onResult={setResult}
            />
          )}
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
        <Panel defaultSize={loadSizes()[2]} minSize={20}>
          <ResultsPanel result={result} query={query} />
        </Panel>
      </PanelGroup>
    </div>
  )
}

function CollapsedStrip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-full w-full cursor-pointer items-center justify-center bg-muted/30 hover:bg-muted/60 transition-colors"
    >
      <span
        className="text-muted-foreground text-xs font-medium tracking-widest"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        {label}
      </span>
    </button>
  )
}
```

- [ ] **Step 3: Create stub components so the page compiles**

Create minimal stubs for FieldTreePanel, QueryBuilderPanel, ResultsPanel so TypeScript doesn't error — they'll be filled in later tasks.

```typescript
// apps/web/src/app/analytics/FieldTreePanel.tsx
"use client"
import type { QueryConfig } from "./analytics-types"
export function FieldTreePanel(_: {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig) => void
}) { return <div className="p-4 text-sm text-muted-foreground">Field tree coming soon</div> }
```

```typescript
// apps/web/src/app/analytics/QueryBuilderPanel.tsx
"use client"
import type { AnalyticsResult, QueryConfig } from "./analytics-types"
export function QueryBuilderPanel(_: {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig) => void
  onResult: (r: AnalyticsResult) => void
}) { return <div className="p-4 text-sm text-muted-foreground">Query builder coming soon</div> }
```

```typescript
// apps/web/src/app/analytics/ResultsPanel.tsx
"use client"
import type { AnalyticsResult, QueryConfig } from "./analytics-types"
export function ResultsPanel(_: {
  result: AnalyticsResult | null
  query: QueryConfig | null
}) { return <div className="p-4 text-sm text-muted-foreground">Results will appear here</div> }
```

- [ ] **Step 4: Run typecheck**

```bash
just typecheck
```

Expected: PASS (or only pre-existing errors)

- [ ] **Step 5: Start dev server and verify layout renders**

```bash
just dev
```

Navigate to `http://localhost:3000/analytics` — expect the 3-column layout to render (since PostHog flag is not set in dev, the page will hit `notFound()` unless the flag is enabled in your PostHog project or you temporarily remove the flag check for local development).

To test locally without PostHog, temporarily comment out the flag check in `page.tsx`, verify the layout renders, then restore it.

- [ ] **Step 6: Commit**

```
feat(web): add 3-column resizable/collapsible analytics layout
```

---

## Task 11: Field tree panel

**Files:**
- Modify: `apps/web/src/app/analytics/FieldTreePanel.tsx`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// apps/web/src/app/analytics/FieldTreePanel.tsx
"use client"
import { useEffect, useState, useCallback } from "react"
import { ChevronRight, ChevronDown, X } from "lucide-react"
import { api } from "@/lib/api"
import type { QueryConfig } from "./analytics-types"

interface FieldLevel { value: string; display_label: string; sort_order: number }
interface FieldNode {
  id: number; field_key: string; display_name: string
  field_type: string; is_filterable: boolean; levels: FieldLevel[]
}
interface GroupNode {
  id: number; name: string; slug: string; sort_order: number
  parent_id: number | null; children: GroupNode[]; fields: FieldNode[]
}
interface FieldTree { groups: GroupNode[]; ungrouped_fields: FieldNode[] }

interface Props {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
}

export function FieldTreePanel({ onCollapse, query, onQueryChange }: Props) {
  const [tree, setTree] = useState<FieldTree | null>(null)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!query?.dataset_id) { setTree(null); return }
    api.GET("/api/v1/datasets/{dataset_id}/field-tree", {
      params: { path: { dataset_id: query.dataset_id } },
    }).then(({ data }) => {
      if (data) {
        setTree(data as FieldTree)
        // Auto-expand all root groups
        setExpanded(new Set((data as FieldTree).groups.map((g: GroupNode) => g.id)))
      }
    })
  }, [query?.dataset_id])

  const toggleGroup = (id: number) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const addToRows = useCallback((field: FieldNode) => {
    onQueryChange(prev => {
      const base = prev ?? emptyQuery()
      if (base.rows.some(r => r.field_key === field.field_key)) return base
      return { ...base, rows: [...base.rows, { field_key: field.field_key, display_name: field.display_name }] }
    })
  }, [onQueryChange])

  const q = search.toLowerCase()
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q)

  const renderField = (f: FieldNode) => {
    if (!matchesSearch(f.display_name)) return null
    return (
      <div key={f.field_key} className="flex items-center gap-1 py-0.5 pl-4 hover:bg-muted/50 rounded cursor-pointer group"
           onClick={() => addToRows(f)}>
        <span className="flex-1 text-sm">{f.display_name}</span>
        <span className="text-muted-foreground text-xs opacity-0 group-hover:opacity-100">+ rows</span>
      </div>
    )
  }

  const renderGroup = (g: GroupNode, depth = 0): React.ReactNode => {
    const childFields = g.fields.filter(f => matchesSearch(f.display_name))
    const childGroups = g.children.filter(c =>
      matchesSearch(c.name) || c.fields.some(f => matchesSearch(f.display_name))
    )
    if (!matchesSearch(g.name) && childFields.length === 0 && childGroups.length === 0) return null
    const isOpen = expanded.has(g.id) || (!!q && (childFields.length > 0 || childGroups.length > 0))
    return (
      <div key={g.id}>
        <button
          className="flex w-full items-center gap-1 py-1 hover:bg-muted/50 rounded text-left"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => toggleGroup(g.id)}
        >
          {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          <span className="text-sm font-medium">{g.name}</span>
        </button>
        {isOpen && (
          <div>
            {childGroups.map(c => renderGroup(c, depth + 1))}
            {childFields.map(renderField)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Fields</span>
        <button onClick={onCollapse} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-3 py-2">
        <input
          type="search"
          placeholder="Search fields…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        {!query?.dataset_id && (
          <p className="px-3 py-4 text-sm text-muted-foreground">Select a dataset to see fields.</p>
        )}
        {tree && (
          <>
            {tree.groups.map(g => renderGroup(g))}
            {tree.ungrouped_fields.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ungrouped</p>
                {tree.ungrouped_fields.map(renderField)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function emptyQuery(): QueryConfig {
  return {
    mode: "crosstab", dataset_id: null, collection_id: null,
    rows: [], row_mode: "stacked", columns: [], col_mode: "stacked",
    breakdown: null, filters: [], measure: { type: "count", field_key: null, aggregation: null, display: "n" },
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
just typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```
feat(web): implement field tree panel with search and field selection
```

---

## Task 12: Query builder panel

**Files:**
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.tsx`
- Create: `apps/web/src/app/analytics/useAnalyticsState.ts`

- [ ] **Step 1: Create useAnalyticsState hook**

```typescript
// apps/web/src/app/analytics/useAnalyticsState.ts
"use client"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"
import type { QueryConfig } from "./analytics-types"

const DEFAULT_QUERY: QueryConfig = {
  mode: "crosstab",
  dataset_id: null,
  collection_id: null,
  rows: [],
  row_mode: "stacked",
  columns: [],
  col_mode: "stacked",
  breakdown: null,
  filters: [],
  measure: { type: "count", field_key: null, aggregation: null, display: "n" },
}

export function useAnalyticsState() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query: QueryConfig = (() => {
    const raw = searchParams.get("q")
    if (!raw) return DEFAULT_QUERY
    try { return { ...DEFAULT_QUERY, ...JSON.parse(decodeURIComponent(raw)) } }
    catch { return DEFAULT_QUERY }
  })()

  const setQuery = useCallback((updater: QueryConfig | ((prev: QueryConfig) => QueryConfig)) => {
    const next = typeof updater === "function" ? updater(query) : updater
    const params = new URLSearchParams(searchParams.toString())
    params.set("q", encodeURIComponent(JSON.stringify(next)))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [query, router, pathname, searchParams])

  return { query, setQuery }
}
```

- [ ] **Step 2: Replace QueryBuilderPanel stub with full implementation**

```typescript
// apps/web/src/app/analytics/QueryBuilderPanel.tsx
"use client"
import { useState } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import type { AnalyticsResult, FieldSelection, QueryConfig, MeasureType, DisplayType } from "./analytics-types"

interface Props {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
  onResult: (r: AnalyticsResult) => void
}

export function QueryBuilderPanel({ onCollapse, query, onQueryChange, onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = query ?? emptyQuery()
  const set = (patch: Partial<QueryConfig>) => onQueryChange({ ...q, ...patch })

  const removeRow = (fk: string) => set({ rows: q.rows.filter(r => r.field_key !== fk) })
  const removeCol = (fk: string) => set({ columns: q.columns.filter(c => c.field_key !== fk) })
  const removeFilter = (fk: string) => set({ filters: q.filters.filter(f => f.field_key !== fk) })

  const run = async () => {
    if (q.mode === "crosstab" && !q.dataset_id) { setError("Select a dataset first"); return }
    if (q.mode === "trend" && !q.collection_id) { setError("Select a collection first"); return }
    setLoading(true); setError(null)
    try {
      if (q.mode === "crosstab") {
        const { data, error: apiError } = await api.POST("/api/v1/analytics/crosstab", {
          body: {
            dataset_id: q.dataset_id!,
            rows: q.rows,
            row_mode: q.row_mode,
            columns: q.columns,
            col_mode: q.col_mode,
            filters: q.filters as any,
            measure: q.measure as any,
          },
        })
        if (apiError) throw new Error(JSON.stringify(apiError))
        onResult(data as AnalyticsResult)
      } else {
        const { data, error: apiError } = await api.POST("/api/v1/analytics/trend", {
          body: {
            collection_id: q.collection_id!,
            fields: q.rows,
            breakdown: q.breakdown ?? undefined,
            filters: q.filters as any,
            measure: q.measure as any,
          },
        })
        if (apiError) throw new Error(JSON.stringify(apiError))
        onResult(data as AnalyticsResult)
      }
    } catch (e: any) {
      setError(e.message ?? "Request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col border-r">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Query Builder</span>
        <button onClick={onCollapse}><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Analysis type tabs */}
        <div className="flex gap-1 rounded border p-0.5">
          {(["crosstab", "trend"] as const).map(m => (
            <button key={m} onClick={() => set({ mode: m })}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                q.mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}>
              {m === "crosstab" ? "Cross-tab" : "Trending"}
            </button>
          ))}
        </div>

        {/* Rows zone */}
        <Zone label={q.mode === "trend" ? "Fields" : "Rows"}
              fields={q.rows} onRemove={removeRow}
              mode={q.row_mode}
              onModeChange={m => set({ row_mode: m })}
              showModeSelector={q.rows.length >= 2 && q.mode === "crosstab"} />

        {/* Columns zone (crosstab only) */}
        {q.mode === "crosstab" && (
          <Zone label="Columns" fields={q.columns} onRemove={removeCol}
                mode={q.col_mode} onModeChange={m => set({ col_mode: m })}
                showModeSelector={q.columns.length >= 2} />
        )}

        {/* Breakdown (trend only) */}
        {q.mode === "trend" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Break down by</label>
            {q.breakdown ? (
              <div className="mt-1 flex items-center gap-1 rounded border px-2 py-1">
                <span className="flex-1 text-sm">{q.breakdown.field_key}</span>
                <button onClick={() => set({ breakdown: null })}><Trash2 className="h-3 w-3" /></button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Drag a field here from the field tree.</p>
            )}
          </div>
        )}

        {/* Filters zone */}
        {q.filters.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filters</label>
            <div className="mt-1 space-y-1">
              {q.filters.map(f => (
                <div key={f.field_key} className="flex items-center gap-1 rounded border px-2 py-1">
                  <span className="flex-1 text-sm">{f.display_name ?? f.field_key}</span>
                  {f.levels && <span className="text-xs text-muted-foreground">{f.levels.join(", ")}</span>}
                  <button onClick={() => removeFilter(f.field_key)}><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground italic">
              {q.filters.map(f => {
                if (f.value_range) return `${f.field_key} ${f.value_range[0]}–${f.value_range[1]}`
                return `${f.field_key} is ${f.levels?.join(" or ") ?? "…"}`
              }).join(") and (")}
            </p>
          </div>
        )}

        {/* Measure */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Measure</label>
          <div className="mt-1 flex gap-1 rounded border p-0.5">
            {(["count", "weighted", "value_field"] as MeasureType[]).map(t => (
              <button key={t}
                onClick={() => set({ measure: { ...q.measure, type: t } })}
                className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                  q.measure.type === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}>
                {t === "count" ? "Count" : t === "weighted" ? "Weighted" : "Value"}
              </button>
            ))}
          </div>
          {/* Display format */}
          <div className="mt-2 flex gap-1 rounded border p-0.5">
            {(["n", "pct_col", "pct_row"] as DisplayType[]).map(d => (
              <button key={d}
                onClick={() => set({ measure: { ...q.measure, display: d } })}
                className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                  q.measure.display === d ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"
                }`}>
                {d === "n" ? "N" : d === "pct_col" ? "% Col" : "% Row"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Run button */}
      <div className="border-t p-3">
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        <button onClick={run} disabled={loading}
          className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors">
          {loading ? "Running…" : "Run"}
        </button>
      </div>
    </div>
  )
}

function Zone({ label, fields, onRemove, mode, onModeChange, showModeSelector }: {
  label: string
  fields: FieldSelection[]
  onRemove: (fk: string) => void
  mode: "stacked" | "nested"
  onModeChange: (m: "stacked" | "nested") => void
  showModeSelector: boolean
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="mt-1 min-h-[40px] rounded border p-1 space-y-1">
        {fields.length === 0 && (
          <p className="px-1 py-1 text-xs text-muted-foreground">Drag fields here from the field tree.</p>
        )}
        {fields.map(f => (
          <div key={f.field_key} className="flex items-center gap-1 rounded bg-muted/50 px-2 py-1">
            <span className="flex-1 text-xs">{f.display_name ?? f.field_key}</span>
            <button onClick={() => onRemove(f.field_key)}><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
      {showModeSelector && (
        <div className="mt-1 flex gap-1">
          {(["stacked", "nested"] as const).map(m => (
            <button key={m} onClick={() => onModeChange(m)}
              className={`rounded px-2 py-0.5 text-xs border transition-colors ${
                mode === m ? "bg-muted font-medium" : "hover:bg-muted/50"
              }`}>
              {m === "stacked" ? "Stacked ↕" : "Nested →"}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function emptyQuery(): QueryConfig {
  return {
    mode: "crosstab", dataset_id: null, collection_id: null,
    rows: [], row_mode: "stacked", columns: [], col_mode: "stacked",
    breakdown: null, filters: [],
    measure: { type: "count", field_key: null, aggregation: null, display: "n" },
  }
}
```

- [ ] **Step 3: Run typecheck**

```bash
just typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```
feat(web): implement query builder panel with field zones, measure, and run button
```

---

## Task 13: Results panel — table and chart

**Files:**
- Modify: `apps/web/src/app/analytics/ResultsPanel.tsx`
- Create: `apps/web/src/app/analytics/AnalyticsTable.tsx`
- Create: `apps/web/src/app/analytics/AnalyticsChart.tsx`

- [ ] **Step 1: Create AnalyticsTable**

```typescript
// apps/web/src/app/analytics/AnalyticsTable.tsx
import type { AnalyticsResult } from "./analytics-types"

interface Props { result: AnalyticsResult }

export function AnalyticsTable({ result }: Props) {
  const { meta, rows } = result
  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">No data.</p>

  // Derive column keys from first row
  const colKeys = Object.keys(rows[0].values)
  const isTrend = meta.mode === "trend"
  const isNested = (meta.row_mode === "nested" && rows[0]?.key.length === 4) || false

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-muted/50">
            {isNested ? (
              <>
                <th className="px-3 py-2 text-left font-medium">
                  {meta.row_fields?.[0]?.display_name ?? ""}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {meta.row_fields?.[1]?.display_name ?? ""}
                </th>
              </>
            ) : isTrend ? (
              <>
                <th className="px-3 py-2 text-left font-medium">Wave</th>
                <th className="px-3 py-2 text-left font-medium">Field</th>
                <th className="px-3 py-2 text-left font-medium">Level</th>
              </>
            ) : (
              <th className="px-3 py-2 text-left font-medium">
                {meta.row_fields?.[0]?.display_name ?? ""}
              </th>
            )}
            {colKeys.map(k => (
              <th key={k} className="px-3 py-2 text-right font-medium">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isNewSection =
              i > 0 && !isNested && !isTrend && row.key[0] !== rows[i - 1].key[0]
            return (
              <tr key={i} className={`border-b hover:bg-muted/30 ${isNewSection ? "border-t-2 border-t-border" : ""}`}>
                {isNested ? (
                  <>
                    <td className="px-3 py-1">{row.key[1]}</td>
                    <td className="px-3 py-1">{row.key[3]}</td>
                  </>
                ) : isTrend ? (
                  <>
                    <td className="px-3 py-1">{row.key[0]}</td>
                    <td className="px-3 py-1">{row.key[1]}</td>
                    <td className="px-3 py-1">{row.key[2]}</td>
                  </>
                ) : (
                  <td className="px-3 py-1">{row.key[1]}</td>
                )}
                {colKeys.map(k => (
                  <td key={k} className="px-3 py-1 text-right tabular-nums">
                    {row.values[k]?.toFixed(1) ?? "—"}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create AnalyticsChart**

Before writing this step, verify the Recharts API from the docs fetched in Task 8. The code below targets Recharts 2.x:

```typescript
// apps/web/src/app/analytics/AnalyticsChart.tsx
"use client"
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts"
import type { AnalyticsResult, ChartType } from "./analytics-types"

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
]

interface Props {
  result: AnalyticsResult
  chartType: ChartType
}

export function AnalyticsChart({ result, chartType }: Props) {
  const { rows } = result
  if (rows.length === 0) return null

  const seriesKeys = Object.keys(rows[0].values).filter(k => k !== "Total")
  const isTrend = result.meta.mode === "trend"

  if (isTrend) {
    // Line chart: x = wave, one line per (field × level)
    const datasets = [...new Set(rows.map(r => r.key[0]))]
    const series = [...new Set(rows.map(r => `${r.key[1]} — ${r.key[2]}`))]
    const chartData = datasets.map(ds => {
      const entry: Record<string, string | number> = { name: ds }
      series.forEach(s => {
        const row = rows.find(r => r.key[0] === ds && `${r.key[1]} — ${r.key[2]}` === s)
        entry[s] = row?.values["Total"] ?? 0
      })
      return entry
    })
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]}
                  dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // Bar charts: x = row levels, series = col levels
  const xKeys = [...new Set(rows.map(r => r.key[1]))]
  const chartData = xKeys.map(xk => {
    const entry: Record<string, string | number> = { name: xk }
    seriesKeys.forEach(sk => {
      const row = rows.find(r => r.key[1] === xk)
      entry[sk] = row?.values[sk] ?? 0
    })
    return entry
  })

  const stacked = chartType !== "grouped_bar"
  const stackId = stacked ? "stack" : undefined
  const normalized = chartType === "stacked_bar_100"

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis domain={normalized ? [0, 100] : undefined} />
        <Tooltip />
        <Legend />
        {seriesKeys.map((sk, i) => (
          <Bar key={sk} dataKey={sk} stackId={stackId}
               fill={COLORS[i % COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Replace ResultsPanel stub**

```typescript
// apps/web/src/app/analytics/ResultsPanel.tsx
"use client"
import { useState } from "react"
import { BarChart2, LineChart, Table2, LayoutTemplate } from "lucide-react"
import { AnalyticsTable } from "./AnalyticsTable"
import { AnalyticsChart } from "./AnalyticsChart"
import type { AnalyticsResult, ChartType, QueryConfig, ViewMode } from "./analytics-types"

interface Props {
  result: AnalyticsResult | null
  query: QueryConfig | null
}

export function ResultsPanel({ result, query }: Props) {
  const [chartType, setChartType] = useState<ChartType>("grouped_bar")
  const [viewMode, setViewMode] = useState<ViewMode>("stacked")

  const isTrend = query?.mode === "trend"

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Configure a query and press Run.</p>
      </div>
    )
  }

  const showChart = viewMode !== "table_only"
  const showTable = viewMode !== "chart_only"

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div>
          <p className="text-sm font-medium">
            {result.meta.dataset_name ?? result.meta.collection_name}
          </p>
          <p className="text-xs text-muted-foreground">
            n = {result.meta.base_n ?? "—"} · {result.meta.measure.type} · {result.meta.measure.display}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Chart type */}
          <div className="flex gap-1">
            {([
              ["grouped_bar", "Grouped"], ["stacked_bar", "Stacked"],
              ["stacked_bar_100", "100%"], ["line", "Line"]
            ] as [ChartType, string][]).map(([ct, label]) => (
              <button key={ct}
                disabled={ct === "line" && !isTrend}
                onClick={() => setChartType(ct)}
                title={label}
                className={`rounded px-2 py-1 text-xs border transition-colors disabled:opacity-30 ${
                  chartType === ct ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}>
                {label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-border" />
          {/* View mode */}
          <div className="flex gap-1">
            {([
              ["chart_only", "Chart"], ["stacked", "Both"], ["table_only", "Table"]
            ] as [ViewMode, string][]).map(([vm, label]) => (
              <button key={vm} onClick={() => setViewMode(vm)}
                className={`rounded px-2 py-1 text-xs border transition-colors ${
                  viewMode === vm ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`flex flex-1 overflow-hidden ${viewMode === "side_by_side" ? "flex-row" : "flex-col"}`}>
        {showChart && (
          <div className={`p-4 ${viewMode === "stacked" ? "border-b" : "flex-1 border-r"}`}>
            <AnalyticsChart result={result} chartType={chartType} />
          </div>
        )}
        {showTable && (
          <div className="flex-1 overflow-auto">
            <AnalyticsTable result={result} />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run typecheck**

```bash
just typecheck
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
just test
```

Expected: all PASS

- [ ] **Step 6: Commit**

```
feat(web): add results panel with pivot table and Recharts bar/line charts
```

---

## Task 14: Wire up dataset/collection pickers in query builder

**Files:**
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.tsx`

The query builder needs a dataset/collection dropdown to set `query.dataset_id` / `query.collection_id`. Without this, users can't load field trees or run queries.

- [ ] **Step 1: Add scope pickers to QueryBuilderPanel**

Insert after the mode tabs, before the Rows zone:

```typescript
// Inside QueryBuilderPanel, add this ScopePicker component at the bottom of the file:
function ScopePicker({ query, onSet }: {
  query: QueryConfig,
  onSet: (patch: Partial<QueryConfig>) => void
}) {
  const [packages, setPackages] = useState<{ id: number; name: string; collections: { id: number; name: string; datasets: { id: number; name: string }[] }[] }[]>([])

  useEffect(() => {
    // Fetch packages with collections; then datasets
    api.GET("/api/v1/packages").then(async ({ data }) => {
      if (!data) return
      const withCollections = await Promise.all(
        (data as { id: number; name: string }[]).map(async pkg => {
          const { data: pkgData } = await api.GET("/api/v1/packages/{package_id}", {
            params: { path: { package_id: pkg.id } }
          })
          return pkgData
        })
      )
      // For each collection, we need datasets — fetch via dataset endpoint
      setPackages(withCollections.filter(Boolean) as any)
    })
  }, [])

  if (query.mode === "crosstab") {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dataset</label>
        <select
          className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
          value={query.dataset_id ?? ""}
          onChange={e => onSet({ dataset_id: Number(e.target.value) || null })}
        >
          <option value="">Select dataset…</option>
          {packages.map(pkg =>
            (pkg as any).collections?.map((col: any) =>
              col.datasets?.map((ds: any) => (
                <option key={ds.id} value={ds.id}>{pkg.name} › {col.name} › {ds.name}</option>
              ))
            )
          )}
        </select>
      </div>
    )
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Collection</label>
      <select
        className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
        value={query.collection_id ?? ""}
        onChange={e => onSet({ collection_id: Number(e.target.value) || null })}
      >
        <option value="">Select collection…</option>
        {packages.map(pkg =>
          (pkg as any).collections?.map((col: any) => (
            <option key={col.id} value={col.id}>{pkg.name} › {col.name}</option>
          ))
        )}
      </select>
    </div>
  )
}
```

Note: the current `GET /api/v1/packages/{id}` endpoint returns `collections` but not `datasets` within collections. You will need to also call `GET /api/v1/collections/{id}` which should return datasets. If that endpoint doesn't exist yet, use `GET /api/v1/datasets` filtered by collection — or add a `datasets` array to the collection endpoint. Check what's available with `just api` and inspect the OpenAPI spec at `http://localhost:8000/docs` before deciding.

Add `<ScopePicker query={q} onSet={set} />` in the JSX, between the mode tabs and the Rows zone.

- [ ] **Step 2: Run typecheck**

```bash
just typecheck
```

- [ ] **Step 3: Start dev server and manually test full flow**

```bash
just dev
```

With the `analytics-engine` flag enabled (or flag check temporarily removed):
1. Navigate to `/analytics`
2. Select a dataset (Brand Tracker Wave 1)
3. Field tree should populate
4. Drag/click a field into Rows
5. Drag a field into Columns
6. Press Run
7. Verify results appear in the Results panel as both table and chart

- [ ] **Step 4: Commit**

```
feat(web): add dataset/collection scope pickers and wire up analytics flow
```

---

## Self-Review

**1. Spec coverage check:**

| Spec requirement | Task |
|---|---|
| FieldGroup table (adjacency list, no depth cap) | Task 1–2 |
| Field.group_id nullable FK | Task 1–2 |
| identifier + weight field types | Task 1–2 |
| POST /analytics/crosstab | Task 6 |
| POST /analytics/trend | Task 7 |
| GET /datasets/{id}/field-tree | Task 4 |
| GET /datasets/{id}/weight-fields | Task 4 |
| Stacked row/col aggregation | Task 5 |
| Nested row aggregation (max 2) | Task 5 (aggregate_nested) |
| Stacked max 5 fields | Task 6 (validation) |
| Filter: OR within field, AND between | Task 5 (apply_filters) |
| Numeric range filter | Task 5 |
| multi_response array containment | Task 5 (_value_matches) |
| Weighted + value_field measures | Task 5 (_compute_measure) |
| pct_col / pct_row / n display | Task 5 (apply_display) |
| CrosstabService 3-layer architecture | Tasks 5–6 |
| TrendService | Task 7 |
| Trending key = [dataset_name, field_key, level] | Task 7 |
| PostHog analytics-engine flag | Task 9 |
| 3-column resizable layout | Task 10 |
| Collapsible panels (VS Code style) | Task 10 |
| Panel widths → localStorage | Task 10 |
| Restore default layout | Task 10 |
| Field tree with search | Task 11 |
| multi_response as branch nodes (selectable) | Task 11 (renders as regular field, levels shown as children for filters) |
| Analysis type tabs | Task 12 |
| Rows/columns zones with stacked/nested selector | Task 12 |
| Measure section (count/weighted/value) | Task 12 |
| Run button | Task 12 |
| Chart type icons (grouped/stacked/100%/line) | Task 13 |
| View mode icons (chart/table/both) | Task 13 |
| Pivot table (single field, stacked, nested) | Task 13 |
| Line chart (trending only) | Task 13 |
| Dataset/collection picker | Task 14 |
| FieldGroup seed data | Task 2 |
| identifier + weight in seed | Task 2 |
| URL searchParams for query state | Task 12 (useAnalyticsState — created but not wired into QueryBuilderPanel) |

**Gap identified:** `useAnalyticsState` is created in Task 12 but `QueryBuilderPanel` maintains its own local `query` state via props rather than using the hook. The `page.tsx` should use `useAnalyticsState` and pass `query`/`setQuery` down, so the query is persisted to URL and bookmarkable. This should be wired up in Task 14 or as an additional step.

**Fix:** In `AnalyticsLayout.tsx`, replace the `useState<QueryConfig | null>` with a call to `useAnalyticsState()` so panel width and query state are both persisted correctly. Pass `query` and `setQuery` through the existing props interface — the components already accept `query` and `onQueryChange`.

**2. Placeholder scan:** No TBD or TODO patterns found in implementation steps. Task 14 step 1 notes a conditional about the collections/datasets API that the implementer must resolve at runtime — this is acceptable since it depends on real runtime behaviour that can't be predetermined.

**3. Type consistency check:**
- `FilterSpec.value_range` used consistently (not `range`)
- `_compute_measure` called with `measure: dict` consistently
- `FieldMeta` returned by `get_field_metas` as `dict` with keys `field_key`, `display_name`, `field_type`, `levels` — matches usage in crosstab_service and analytics.py route
- `ResultRow` defined in route file matches `AnalyticsResult.rows` in frontend types
- `apply_filters` takes `filters: list[dict]` (raw dicts via `.model_dump()`) — consistent with calls in route handler
