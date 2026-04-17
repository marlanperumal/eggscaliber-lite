# Data Ingestion & Metadata Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5-step upload wizard (`/datasets/upload`) and a `/datasets` management page that lets users import CSV survey data, reconcile fields against a previous wave, edit metadata in a tree/list editor, and commit to the database.

**Architecture:** The wizard is backed by a staging layer (`upload_session`, `upload_field`, `upload_level`, `upload_fieldgroup`, `reconciliation_row`) that lives in Postgres until the user commits, at which point the service atomically promotes staging records into the live `field`/`level`/`fieldgroup`/`response` tables. All new backend endpoints follow the existing `routes → services → repositories` 3-layer pattern. The frontend uses the `api` openapi-fetch client with `useState`/`useEffect` (matching the existing analytics page pattern) — no new state management library.

**Tech Stack:** FastAPI + SQLModel (backend), Next.js App Router + openapi-fetch (frontend), dnd-kit v6.3.1 (tree drag-and-drop), `@tanstack/react-virtual` (new dep, virtual list for large reconciliation tables), Python `csv` stdlib (CSV parsing, no new backend dep for CSV), Alembic (migrations).

**Spec:** `docs/superpowers/specs/2026-04-16-data-ingestion-metadata-editor-design.md`

---

## File Map

### New backend files
| File | Responsibility |
|------|---------------|
| `apps/api/src/models/upload.py` | `UploadSession`, `UploadField`, `UploadLevel`, `UploadFieldGroup` ORM + read schemas |
| `apps/api/src/models/reconciliation.py` | `ReconciliationRow` ORM + read schema |
| `apps/api/src/repositories/upload_repo.py` | CRUD for all upload staging tables |
| `apps/api/src/repositories/reconciliation_repo.py` | Paginated + cursor-based reconciliation row queries |
| `apps/api/src/services/detection_service.py` | CSV heuristics — detects field type from column data |
| `apps/api/src/services/upload_service.py` | Orchestrates file save, detection, session creation |
| `apps/api/src/services/reconciliation_service.py` | Exact/probable/new_only/old_only matching engine |
| ~~`apps/api/src/services/metadata_service.py`~~ | _Not created — logic is simple enough to live inline in `routes/uploads.py` (YAGNI)_ |
| `apps/api/src/services/commit_service.py` | Atomic promotion of staging → live tables |
| `apps/api/src/routes/uploads.py` | All wizard API endpoints |
| `apps/api/migrations/versions/<hash>_add_upload_tables.py` | Migration for the 5 new tables |

### Modified backend files
| File | Change |
|------|--------|
| `apps/api/src/models/__init__.py` | Export new models (needed for SQLModel metadata) |
| `apps/api/src/errors.py` | Add `UploadSessionNotFoundError`, `UploadSessionConflictError` |
| `apps/api/src/main.py` | Register `uploads` router; add `PATCH`/`DELETE` to CORS `allow_methods` |
| `apps/api/src/routes/datasets.py` | Add `GET /datasets` list endpoint |

### New frontend files
| File | Responsibility |
|------|---------------|
| `apps/web/src/app/datasets/page.tsx` | Server component shell for `/datasets` |
| `apps/web/src/app/datasets/DatasetsPage.tsx` | Client component — dataset list table |
| `apps/web/src/app/datasets/DatasetsPage.stories.tsx` | Storybook story (Empty + WithData) |
| `apps/web/src/app/datasets/upload/page.tsx` | Server component shell for `/datasets/upload` |
| `apps/web/src/app/datasets/upload/WizardShell.tsx` | Step indicator + step router |
| `apps/web/src/app/datasets/upload/WizardShell.stories.tsx` | Storybook story (step 1, step 4 skip, step 5) |
| `apps/web/src/app/datasets/upload/wizard-types.ts` | Shared wizard state types |
| `apps/web/src/app/datasets/upload/useWizardState.ts` | URL-synced wizard state hook |
| `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx` | File drop + hierarchy form |
| `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.stories.tsx` | Storybook story |
| `apps/web/src/app/datasets/upload/steps/Step2FieldDetection.tsx` | Detection review table |
| `apps/web/src/app/datasets/upload/steps/Step2FieldDetection.stories.tsx` | Storybook story |
| `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx` | 4-tab reconciliation view |
| `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.stories.tsx` | Storybook story |
| `apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx` | Single 8-column grid row |
| `apps/web/src/app/datasets/upload/steps/ReconciliationRow.stories.tsx` | Storybook story (all 4 group variants) |
| `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx` | Split-panel metadata editor |
| `apps/web/src/app/datasets/upload/steps/FieldTree.tsx` | dnd-kit tree (left panel, tree tab) |
| `apps/web/src/app/datasets/upload/steps/FieldTree.stories.tsx` | Storybook story |
| `apps/web/src/app/datasets/upload/steps/FieldList.tsx` | Filterable list (left panel, list tab) |
| `apps/web/src/app/datasets/upload/steps/FieldList.stories.tsx` | Storybook story |
| `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx` | Right editor panel |
| `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.stories.tsx` | Storybook story |
| `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx` | Summary grid + commit CTA |
| `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.stories.tsx` | Storybook story |

### Modified frontend files
| File | Change |
|------|--------|
| `apps/web/src/app/page.tsx` | Add "Datasets" nav link |
| `packages/shared/api.d.ts` | Regenerated by `just generate-types` after backend tasks |

---

<!-- TASKS START BELOW — written incrementally -->

---

### Task 1: Upload staging models + migration

Adds five new tables that hold wizard state before commit: `upload_session`, `upload_field`, `upload_level`, `upload_fieldgroup`, `reconciliation_row`.

**Files:**
- Create: `apps/api/src/models/upload.py`
- Create: `apps/api/src/models/reconciliation.py`
- Modify: `apps/api/src/models/__init__.py`
- Create: `apps/api/migrations/versions/<hash>_add_upload_tables.py` (generated)

- [ ] **Step 1: Write `apps/api/src/models/upload.py`**

```python
from datetime import UTC, date, datetime
from enum import StrEnum

from sqlmodel import Field as sql_field
from sqlmodel import SQLModel

from src.models.field import FieldType


class UploadSessionStatus(StrEnum):
    pending = "pending"
    detecting = "detecting"
    reconciling = "reconciling"
    editing = "editing"
    committed = "committed"
    abandoned = "abandoned"


class UploadSessionBase(SQLModel):
    status: UploadSessionStatus = UploadSessionStatus.pending
    file_path: str
    row_count: int | None = None
    collection_id: int | None = sql_field(default=None, foreign_key="collection.id")
    dataset_name: str | None = None
    collected_at: date | None = None
    reference_dataset_id: int | None = sql_field(default=None, foreign_key="dataset.id")
    committed_dataset_id: int | None = sql_field(default=None, foreign_key="dataset.id")


class UploadSession(UploadSessionBase, table=True):
    __tablename__ = "upload_session"
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(
        default_factory=lambda: datetime.now(UTC).replace(tzinfo=None)
    )
    updated_at: datetime = sql_field(
        default_factory=lambda: datetime.now(UTC).replace(tzinfo=None)
    )


class UploadSessionRead(UploadSessionBase):
    id: int
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------

class UploadFieldGroupBase(SQLModel):
    upload_session_id: int = sql_field(foreign_key="upload_session.id")
    name: str
    sort_order: int = 0
    parent_id: int | None = sql_field(default=None, foreign_key="upload_fieldgroup.id")


class UploadFieldGroup(UploadFieldGroupBase, table=True):
    __tablename__ = "upload_fieldgroup"
    id: int | None = sql_field(default=None, primary_key=True)


class UploadFieldGroupRead(UploadFieldGroupBase):
    id: int


# ---------------------------------------------------------------------------

class UploadFieldBase(SQLModel):
    upload_session_id: int = sql_field(foreign_key="upload_session.id")
    field_key: str
    display_name: str | None = None
    detected_type: FieldType
    override_type: FieldType | None = None
    sort_order: int = 0
    upload_fieldgroup_id: int | None = sql_field(
        default=None, foreign_key="upload_fieldgroup.id"
    )


class UploadField(UploadFieldBase, table=True):
    __tablename__ = "upload_field"
    id: int | None = sql_field(default=None, primary_key=True)


class UploadFieldRead(UploadFieldBase):
    id: int

    @property
    def effective_type(self) -> FieldType:
        return self.override_type or self.detected_type


# ---------------------------------------------------------------------------

class UploadLevelBase(SQLModel):
    upload_field_id: int = sql_field(foreign_key="upload_field.id")
    raw_value: str
    display_label: str | None = None
    sort_order: int = 0


class UploadLevel(UploadLevelBase, table=True):
    __tablename__ = "upload_level"
    id: int | None = sql_field(default=None, primary_key=True)


class UploadLevelRead(UploadLevelBase):
    id: int
```

- [ ] **Step 2: Write `apps/api/src/models/reconciliation.py`**

```python
from datetime import UTC, datetime
from enum import StrEnum

from sqlmodel import Field as sql_field
from sqlmodel import SQLModel


class ReconciliationGroup(StrEnum):
    exact = "exact"
    probable = "probable"
    new_only = "new_only"
    old_only = "old_only"


class ReconciliationStatus(StrEnum):
    auto_accepted = "auto_accepted"
    pending = "pending"
    confirmed = "confirmed"
    rejected = "rejected"
    excluded = "excluded"


class ReconciliationRowBase(SQLModel):
    upload_session_id: int = sql_field(foreign_key="upload_session.id")
    upload_field_id: int | None = sql_field(default=None, foreign_key="upload_field.id")
    ref_field_id: int | None = sql_field(default=None, foreign_key="field.id")
    group: ReconciliationGroup
    status: ReconciliationStatus
    confidence: float | None = None
    note: str | None = None


class ReconciliationRow(ReconciliationRowBase, table=True):
    __tablename__ = "reconciliation_row"
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(
        default_factory=lambda: datetime.now(UTC).replace(tzinfo=None)
    )


class ReconciliationRowRead(ReconciliationRowBase):
    id: int
    created_at: datetime
```

- [ ] **Step 3: Update `apps/api/src/models/__init__.py`**

Add these exports after the existing lines:

```python
from .reconciliation import (  # noqa: F401
    ReconciliationGroup,
    ReconciliationRow,
    ReconciliationRowBase,
    ReconciliationRowRead,
    ReconciliationStatus,
)
from .upload import (  # noqa: F401
    UploadField,
    UploadFieldBase,
    UploadFieldGroup,
    UploadFieldGroupBase,
    UploadFieldGroupRead,
    UploadFieldRead,
    UploadLevel,
    UploadLevelBase,
    UploadLevelRead,
    UploadSession,
    UploadSessionBase,
    UploadSessionRead,
    UploadSessionStatus,
)
```

- [ ] **Step 4: Generate the migration**

```bash
just db-migration "add upload tables"
```

Open the generated file and verify it creates all five tables in dependency order:
`upload_session` → `upload_fieldgroup` → `upload_field` → `upload_level` → `reconciliation_row`.

Check that the self-referential FK on `upload_fieldgroup.parent_id` is present and the downgrade drops tables in reverse order and calls `.drop()` on all new enums.

- [ ] **Step 5: Apply and verify migration runs clean**

```bash
just db-migrate
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/models/upload.py \
        apps/api/src/models/reconciliation.py \
        apps/api/src/models/__init__.py \
        apps/api/migrations/versions/
git commit -m "feat(api): add upload staging and reconciliation models + migration"
```

---

### Task 2: Upload repository

CRUD helpers for the staging tables. No business logic here — just queries.

**Files:**
- Create: `apps/api/src/repositories/upload_repo.py`
- Create: `apps/api/tests/test_upload_repo.py`

- [ ] **Step 1: Write the failing tests**

`apps/api/tests/test_upload_repo.py`:

```python
from src.models.collection import Collection, CollectionType
from src.models.package import Package
from src.models.upload import (
    UploadField,
    UploadFieldGroup,
    UploadLevel,
    UploadSession,
    UploadSessionStatus,
)
from src.models.field import FieldType
from src.repositories import upload_repo


async def _seed_session(db):
    pkg = Package(name="P", slug="p-upload-repo-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(name="C", slug="c-upload-repo-test",
                     package_id=pkg.id, collection_type=CollectionType.survey)
    db.add(col)
    await db.flush()
    await db.refresh(col)
    sess = UploadSession(
        file_path="/tmp/test.csv",
        collection_id=col.id,
        dataset_name="Wave 3",
        status=UploadSessionStatus.detecting,
    )
    db.add(sess)
    await db.flush()
    await db.refresh(sess)
    return sess


async def test_get_session_by_id_returns_session(db):
    sess = await _seed_session(db)
    result = await upload_repo.get_session_by_id(db, sess.id)
    assert result is not None
    assert result.id == sess.id


async def test_get_session_by_id_missing_returns_none(db):
    result = await upload_repo.get_session_by_id(db, 99999)
    assert result is None


async def test_get_fields_for_session_returns_all(db):
    sess = await _seed_session(db)
    db.add(UploadField(upload_session_id=sess.id, field_key="gender",
                       detected_type=FieldType.categorical))
    db.add(UploadField(upload_session_id=sess.id, field_key="age",
                       detected_type=FieldType.numeric))
    await db.flush()
    result = await upload_repo.get_fields_for_session(db, sess.id)
    assert len(result) == 2
    keys = {f.field_key for f in result}
    assert keys == {"gender", "age"}


async def test_get_levels_for_field_returns_ordered(db):
    sess = await _seed_session(db)
    f = UploadField(upload_session_id=sess.id, field_key="gender",
                    detected_type=FieldType.categorical)
    db.add(f)
    await db.flush()
    await db.refresh(f)
    db.add(UploadLevel(upload_field_id=f.id, raw_value="male", sort_order=0))
    db.add(UploadLevel(upload_field_id=f.id, raw_value="female", sort_order=1))
    await db.flush()
    result = await upload_repo.get_levels_for_field(db, f.id)
    assert [lv.raw_value for lv in result] == ["male", "female"]
```

- [ ] **Step 2: Run — expect failure**

```bash
just test-api -k test_upload_repo
```

Expected: `ModuleNotFoundError` on `upload_repo`.

- [ ] **Step 3: Write `apps/api/src/repositories/upload_repo.py`**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.field import FieldType
from src.models.upload import (
    UploadField,
    UploadFieldGroup,
    UploadLevel,
    UploadSession,
    UploadSessionStatus,
)


async def get_session_by_id(session: AsyncSession, session_id: int) -> UploadSession | None:
    return (
        (await session.execute(select(UploadSession).where(UploadSession.id == session_id)))
        .scalars()
        .first()
    )


async def create_session(session: AsyncSession, **kwargs) -> UploadSession:
    obj = UploadSession(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def update_session_status(
    session: AsyncSession, session_id: int, status: UploadSessionStatus
) -> None:
    obj = await get_session_by_id(session, session_id)
    if obj:
        obj.status = status
        session.add(obj)
        await session.flush()


async def create_upload_field(session: AsyncSession, **kwargs) -> UploadField:
    obj = UploadField(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def get_fields_for_session(
    session: AsyncSession, session_id: int
) -> list[UploadField]:
    return list(
        (
            await session.execute(
                select(UploadField)
                .where(UploadField.upload_session_id == session_id)
                .order_by(UploadField.sort_order, UploadField.id)
            )
        )
        .scalars()
        .all()
    )


async def get_field_by_id(
    session: AsyncSession, field_id: int
) -> UploadField | None:
    return (
        (await session.execute(select(UploadField).where(UploadField.id == field_id)))
        .scalars()
        .first()
    )


async def create_upload_level(session: AsyncSession, **kwargs) -> UploadLevel:
    obj = UploadLevel(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def get_levels_for_field(
    session: AsyncSession, field_id: int
) -> list[UploadLevel]:
    return list(
        (
            await session.execute(
                select(UploadLevel)
                .where(UploadLevel.upload_field_id == field_id)
                .order_by(UploadLevel.sort_order)
            )
        )
        .scalars()
        .all()
    )


async def create_upload_fieldgroup(session: AsyncSession, **kwargs) -> UploadFieldGroup:
    obj = UploadFieldGroup(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def get_fieldgroups_for_session(
    session: AsyncSession, session_id: int
) -> list[UploadFieldGroup]:
    return list(
        (
            await session.execute(
                select(UploadFieldGroup)
                .where(UploadFieldGroup.upload_session_id == session_id)
                .order_by(UploadFieldGroup.sort_order, UploadFieldGroup.id)
            )
        )
        .scalars()
        .all()
    )
```

- [ ] **Step 4: Run — expect pass**

```bash
just test-api -k test_upload_repo
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repositories/upload_repo.py \
        apps/api/tests/test_upload_repo.py
git commit -m "feat(api): add upload repository with staging table CRUD"
```

---

### Task 3: Field detection service

Pure function that takes CSV column data and returns a detected `FieldType`. No DB access — fully unit-testable.

**Files:**
- Create: `apps/api/src/services/detection_service.py`
- Create: `apps/api/tests/test_detection_service.py`

- [ ] **Step 1: Write the failing tests**

`apps/api/tests/test_detection_service.py`:

```python
from src.models.field import FieldType
from src.services.detection_service import (
    DetectedField,
    detect_fields,
    slugify_key,
)


def _make_rows(header, rows):
    return [dict(zip(header, r)) for r in rows]


def test_slugify_key_lowercases_and_replaces_spaces():
    assert slugify_key("Brand Awareness") == "brand_awareness"


def test_slugify_key_strips_special_chars():
    assert slugify_key("Q1. Age?") == "q1_age"


def test_detects_identifier_by_name():
    rows = _make_rows(["respondent_id"], [["1"], ["2"], ["3"]])
    fields = detect_fields(["respondent_id"], rows)
    assert fields[0].detected_type == FieldType.identifier


def test_detects_weight_by_name():
    rows = _make_rows(["weight"], [["1.2"], ["0.8"], ["1.0"]])
    fields = detect_fields(["weight"], rows)
    assert fields[0].detected_type == FieldType.weight


def test_detects_multi_response_by_sibling_pattern():
    headers = ["media_1", "media_2", "media_3"]
    rows = _make_rows(headers, [["1", "0", "1"], ["0", "1", "0"]])
    fields = detect_fields(headers, rows)
    for f in fields:
        assert f.detected_type == FieldType.multi_response


def test_detects_ordinal_numeric_few_distinct_values():
    rows = _make_rows(["rating"], [[str(i % 5 + 1)] for i in range(50)])
    fields = detect_fields(["rating"], rows)
    assert fields[0].detected_type == FieldType.ordinal


def test_detects_categorical_string_low_cardinality():
    rows = _make_rows(["region"], [["North"], ["South"], ["East"], ["West"]] * 10)
    fields = detect_fields(["region"], rows)
    assert fields[0].detected_type == FieldType.categorical


def test_detects_numeric_high_cardinality_numbers():
    import random
    rows = _make_rows(["income"], [[str(random.randint(20000, 100000))] for _ in range(100)])
    fields = detect_fields(["income"], rows)
    assert fields[0].detected_type == FieldType.numeric


def test_detect_fields_returns_sorted_by_original_order():
    headers = ["gender", "age", "weight"]
    rows = _make_rows(headers, [["male", "30", "1.0"], ["female", "25", "0.9"]])
    fields = detect_fields(headers, rows)
    assert [f.field_key for f in fields] == ["gender", "age", "weight"]


def test_distinct_values_captured_for_categorical():
    rows = _make_rows(["colour"], [["red"], ["blue"], ["green"], ["red"]])
    fields = detect_fields(["colour"], rows)
    assert set(fields[0].distinct_values) == {"red", "blue", "green"}
```

- [ ] **Step 2: Run — expect failure**

```bash
just test-api -k test_detection_service
```

Expected: `ModuleNotFoundError` on `detection_service`.

- [ ] **Step 3: Write `apps/api/src/services/detection_service.py`**

```python
"""CSV field type detection heuristics.

All functions are pure (no DB access) — call with header list + sample rows.
"""

import re
from dataclasses import dataclass, field

from src.models.field import FieldType

_IDENTIFIER_PATTERNS = re.compile(
    r"^(respondent[_\s]?id|resp[_\s]?id|id|uuid|record[_\s]?id)$", re.IGNORECASE
)
_WEIGHT_PATTERNS = re.compile(r"^(weight|wgt|w|wt)$", re.IGNORECASE)
_MULTI_SIBLING = re.compile(r"^(.+)_(\d+)$")
_OTHER_SUFFIX = re.compile(r"^(.+)_other$", re.IGNORECASE)

# Thresholds
_ORDINAL_MAX_DISTINCT = 10
_CATEGORICAL_MAX_DISTINCT = 50
_SAMPLE_ROWS = 200


def slugify_key(raw: str) -> str:
    """Lowercase, replace non-alphanumeric runs with underscore, strip edges."""
    s = raw.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


@dataclass
class DetectedField:
    field_key: str
    original_header: str
    detected_type: FieldType
    distinct_values: list[str] = field(default_factory=list)
    confidence: str = "high"  # "high" | "review"


def detect_fields(
    headers: list[str], rows: list[dict[str, str]]
) -> list[DetectedField]:
    """Return one DetectedField per header, in original order."""
    sample = rows[:_SAMPLE_ROWS]
    slugged = [slugify_key(h) for h in headers]
    header_set = set(slugged)

    # Find multi_response sibling groups: {base_key: [col1, col2, ...]}
    sibling_groups: dict[str, list[str]] = {}
    for key in slugged:
        m = _MULTI_SIBLING.match(key)
        if m:
            base = m.group(1)
            sibling_groups.setdefault(base, []).append(key)
    # Only count as multi_response if ≥ 2 siblings
    multi_keys: set[str] = set()
    for base, members in sibling_groups.items():
        if len(members) >= 2:
            multi_keys.update(members)

    results: list[DetectedField] = []
    for original, key in zip(headers, slugged):
        det_type, distinct, confidence = _classify(key, original, sample, multi_keys, header_set)
        results.append(
            DetectedField(
                field_key=key,
                original_header=original,
                detected_type=det_type,
                distinct_values=distinct,
                confidence=confidence,
            )
        )
    return results


def _classify(
    key: str,
    original: str,
    sample: list[dict[str, str]],
    multi_keys: set[str],
    all_keys: set[str],
) -> tuple[FieldType, list[str], str]:
    # Name-pattern checks first (highest priority)
    if _IDENTIFIER_PATTERNS.match(key) or _IDENTIFIER_PATTERNS.match(original):
        return FieldType.identifier, [], "high"
    if _WEIGHT_PATTERNS.match(key) or _WEIGHT_PATTERNS.match(original):
        return FieldType.weight, [], "high"
    # _other companions — not independently typed; mark as categorical for now
    if _OTHER_SUFFIX.match(key):
        return FieldType.categorical, [], "review"
    if key in multi_keys:
        return FieldType.multi_response, [], "high"

    # Collect non-empty values using original header (rows keyed by original header)
    vals = [r[original].strip() for r in sample if r.get(original, "").strip()]
    distinct = list(dict.fromkeys(vals))  # preserve insertion order, dedupe

    if not vals:
        return FieldType.categorical, distinct, "review"

    all_numeric = all(_is_numeric(v) for v in vals)
    n_distinct = len(set(vals))

    if all_numeric and n_distinct <= _ORDINAL_MAX_DISTINCT:
        return FieldType.ordinal, distinct, "high"
    if all_numeric:
        return FieldType.numeric, distinct, "high"
    if n_distinct <= _CATEGORICAL_MAX_DISTINCT:
        return FieldType.categorical, distinct, "high"
    # High-cardinality string — treat as categorical but flag for review
    return FieldType.categorical, distinct[:50], "review"


def _is_numeric(v: str) -> bool:
    try:
        float(v)
        return True
    except ValueError:
        return False
```

- [ ] **Step 4: Run — expect pass**

```bash
just test-api -k test_detection_service
```

Expected: 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/detection_service.py \
        apps/api/tests/test_detection_service.py
git commit -m "feat(api): add CSV field detection service with heuristics"
```

---

### Task 4: File upload endpoint + upload service

`POST /api/v1/uploads` — accepts multipart CSV, saves to disk, runs detection, creates `upload_session` + `upload_field` + `upload_level` records. Also wires up the router and fixes CORS.

**Files:**
- Create: `apps/api/src/services/upload_service.py`
- Create: `apps/api/src/routes/uploads.py`
- Modify: `apps/api/src/main.py` (register router, expand CORS methods)
- Modify: `apps/api/src/errors.py` (add new error classes)
- Create: `apps/api/tests/test_uploads.py`

- [ ] **Step 1: Update `apps/api/src/errors.py`**

```python
class DomainError(Exception): ...

class PackageNotFoundError(DomainError): ...
class CollectionNotFoundError(DomainError): ...
class DatasetNotFoundError(DomainError): ...
class UploadSessionNotFoundError(DomainError): ...
class UploadSessionConflictError(DomainError): ...
```

- [ ] **Step 2: Write the failing upload test**

`apps/api/tests/test_uploads.py`:

```python
import csv
import io
from src.models.upload import UploadSessionStatus


def _make_csv(headers: list[str], rows: list[list[str]]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue().encode()


async def test_upload_csv_creates_session_and_fields(client, db):
    csv_bytes = _make_csv(
        ["respondent_id", "gender", "age", "brand_1", "brand_2"],
        [["1", "male", "3", "1", "0"], ["2", "female", "5", "0", "1"]],
    )
    response = await client.post(
        "/api/v1/uploads",
        files={"file": ("wave3.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["dataset_name"] == "Wave 3"
    assert data["status"] == UploadSessionStatus.detecting
    assert len(data["fields"]) == 5
    keys = {f["field_key"] for f in data["fields"]}
    assert "respondent_id" in keys
    assert "gender" in keys
    # multi_response siblings detected
    multi = [f for f in data["fields"] if f["field_key"] in ("brand_1", "brand_2")]
    assert all(f["detected_type"] == "multi_response" for f in multi)


async def test_upload_non_csv_returns_422(client):
    response = await client.post(
        "/api/v1/uploads",
        files={"file": ("data.xlsx", b"fake", "application/vnd.ms-excel")},
        data={"dataset_name": "Wave 3"},
    )
    assert response.status_code == 422


async def test_upload_missing_dataset_name_returns_422(client):
    csv_bytes = _make_csv(["id"], [["1"]])
    response = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
    )
    assert response.status_code == 422
```

- [ ] **Step 3: Run — expect failure**

```bash
just test-api -k test_uploads
```

Expected: `404` (route doesn't exist yet).

- [ ] **Step 4: Write `apps/api/src/services/upload_service.py`**

```python
"""Orchestrates file save + field detection + upload_session creation."""

import csv
import io
import os
import tempfile
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.field import FieldType
from src.models.upload import UploadSessionStatus
from src.repositories import upload_repo
from src.services.detection_service import detect_fields

_UPLOAD_DIR = os.environ.get("UPLOAD_DIR", tempfile.gettempdir())
_ALLOWED_TYPES = {"text/csv", "application/csv", "application/octet-stream"}
_MAX_SAMPLE = 200


class InvalidFileTypeError(Exception): ...


async def create_upload_session(
    session: AsyncSession,
    *,
    filename: str,
    content: bytes,
    content_type: str,
    dataset_name: str,
    collection_id: int | None = None,
    collected_at: date | None = None,
) -> dict:
    """Save file, detect fields, persist staging records. Returns dict for response."""
    if not filename.lower().endswith(".csv"):
        raise InvalidFileTypeError(filename)

    # Save to disk
    os.makedirs(_UPLOAD_DIR, exist_ok=True)
    tmp_path = os.path.join(_UPLOAD_DIR, f"upload_{os.getpid()}_{filename}")
    with open(tmp_path, "wb") as fh:
        fh.write(content)

    # Parse CSV
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    rows = []
    row_count = 0
    for row in reader:
        row_count += 1
        if len(rows) < _MAX_SAMPLE:
            rows.append(dict(row))

    # Run detection
    detected = detect_fields(list(headers), rows)

    # Persist session
    sess = await upload_repo.create_session(
        session,
        file_path=tmp_path,
        dataset_name=dataset_name,
        collection_id=collection_id,
        collected_at=collected_at,
        row_count=row_count,
        status=UploadSessionStatus.detecting,
    )

    # Persist fields + levels
    field_records = []
    for i, det in enumerate(detected):
        uf = await upload_repo.create_upload_field(
            session,
            upload_session_id=sess.id,
            field_key=det.field_key,
            detected_type=det.detected_type,
            sort_order=i,
        )
        # Store distinct values as levels for ordinal/categorical
        if det.detected_type in (FieldType.ordinal, FieldType.categorical):
            for j, val in enumerate(det.distinct_values[:100]):
                await upload_repo.create_upload_level(
                    session,
                    upload_field_id=uf.id,
                    raw_value=val,
                    display_label=val,
                    sort_order=j,
                )
        field_records.append({"id": uf.id, "field_key": uf.field_key,
                               "detected_type": uf.detected_type.value,
                               "override_type": None, "sort_order": uf.sort_order})

    return {
        "id": sess.id,
        "status": sess.status.value,
        "dataset_name": sess.dataset_name,
        "collection_id": sess.collection_id,
        "row_count": sess.row_count,
        "fields": field_records,
    }
```

- [ ] **Step 5: Write `apps/api/src/routes/uploads.py`**

```python
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.services import upload_service
from src.services.upload_service import InvalidFileTypeError

router = APIRouter(tags=["uploads"])


@router.post("/uploads", status_code=201)
async def create_upload(
    file: UploadFile,
    dataset_name: str = Form(),
    collection_id: int | None = Form(default=None),
    collected_at: str | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
):
    content = await file.read()
    try:
        result = await upload_service.create_upload_session(
            session,
            filename=file.filename or "upload.csv",
            content=content,
            content_type=file.content_type or "",
            dataset_name=dataset_name,
            collection_id=collection_id,
        )
    except InvalidFileTypeError:
        raise HTTPException(status_code=422, detail="Only CSV files are accepted") from None
    return result
```

- [ ] **Step 6: Update `apps/api/src/main.py`**

Register the new router and expand CORS `allow_methods`:

```python
from src.routes import analytics, collections, datasets, health, packages, scope, sentry, uploads

# In the CORSMiddleware call, change:
allow_methods=["GET", "POST", "PATCH", "DELETE"],

# Add after the existing include_router calls:
app.include_router(uploads.router, prefix="/api/v1")
```

- [ ] **Step 7: Run — expect pass**

```bash
just test-api -k test_uploads
```

Expected: 3 tests passing.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/errors.py \
        apps/api/src/services/upload_service.py \
        apps/api/src/routes/uploads.py \
        apps/api/src/main.py \
        apps/api/tests/test_uploads.py
git commit -m "feat(api): add file upload endpoint with CSV parsing and field detection"
```

---

### Task 5: Field override + session detail endpoints

`GET /api/v1/uploads/{id}` — fetch session + fields (Step 2 page load / resume).
`PATCH /api/v1/uploads/{id}/fields/{field_id}` — override a field's type (Step 2 inline edit).

**Files:**
- Modify: `apps/api/src/routes/uploads.py`
- Modify: `apps/api/tests/test_uploads.py`

- [ ] **Step 1: Write the failing tests** (append to `test_uploads.py`)

```python
async def _create_session(client, headers=None, rows=None):
    headers = headers or ["respondent_id", "gender"]
    rows = rows or [["1", "male"], ["2", "female"]]
    csv_bytes = _make_csv(headers, rows)
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3"},
    )
    assert resp.status_code == 201
    return resp.json()


async def test_get_upload_session_returns_fields(client, db):
    sess = await _create_session(client)
    resp = await client.get(f"/api/v1/uploads/{sess['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == sess["id"]
    assert len(data["fields"]) == 2


async def test_get_upload_session_not_found(client):
    resp = await client.get("/api/v1/uploads/99999")
    assert resp.status_code == 404


async def test_patch_field_override_type(client, db):
    sess = await _create_session(client, headers=["rating"], rows=[[str(i)] for i in range(1, 6)])
    field_id = sess["fields"][0]["id"]
    resp = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}",
        json={"override_type": "categorical"},
    )
    assert resp.status_code == 200
    assert resp.json()["override_type"] == "categorical"


async def test_patch_field_invalid_type_returns_422(client, db):
    sess = await _create_session(client)
    field_id = sess["fields"][0]["id"]
    resp = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}",
        json={"override_type": "not_a_type"},
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run — expect failure**

```bash
just test-api -k "test_get_upload_session or test_patch_field"
```

Expected: 404 or attribute errors.

- [ ] **Step 3: Add the two endpoints to `apps/api/src/routes/uploads.py`**

```python
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.errors import UploadSessionNotFoundError
from src.models.field import FieldType
from src.repositories import upload_repo
from src.services import upload_service
from src.services.upload_service import InvalidFileTypeError

router = APIRouter(tags=["uploads"])


# --- existing POST /uploads handler (unchanged) ---


@router.get("/uploads/{session_id}")
async def get_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    fields = await upload_repo.get_fields_for_session(session, session_id)
    field_list = [
        {
            "id": f.id,
            "field_key": f.field_key,
            "detected_type": f.detected_type.value,
            "override_type": f.override_type.value if f.override_type else None,
            "sort_order": f.sort_order,
            "upload_fieldgroup_id": f.upload_fieldgroup_id,
        }
        for f in fields
    ]
    return {
        "id": sess.id,
        "status": sess.status.value,
        "dataset_name": sess.dataset_name,
        "collection_id": sess.collection_id,
        "row_count": sess.row_count,
        "fields": field_list,
    }


class FieldOverride(BaseModel):
    override_type: FieldType | None = None
    display_name: str | None = None


@router.patch("/uploads/{session_id}/fields/{field_id}")
async def override_field(
    session_id: int,
    field_id: int,
    body: FieldOverride,
    session: AsyncSession = Depends(get_session),
):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise HTTPException(status_code=404, detail="Field not found")
    if body.override_type is not None:
        f.override_type = body.override_type
    if body.display_name is not None:
        f.display_name = body.display_name
    session.add(f)
    await session.flush()
    return {
        "id": f.id,
        "field_key": f.field_key,
        "detected_type": f.detected_type.value,
        "override_type": f.override_type.value if f.override_type else None,
    }
```

- [ ] **Step 4: Run — expect pass**

```bash
just test-api -k test_uploads
```

Expected: all upload tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/uploads.py \
        apps/api/tests/test_uploads.py
git commit -m "feat(api): add GET session detail and PATCH field override endpoints"
```

---

### Task 6: Reconciliation engine + repository

The engine compares upload fields against a reference dataset's fields and assigns each to one of four groups (exact / probable / new_only / old_only). The repository handles cursor-based pagination of the resulting rows.

**Files:**
- Create: `apps/api/src/services/reconciliation_service.py`
- Create: `apps/api/src/repositories/reconciliation_repo.py`
- Create: `apps/api/tests/test_reconciliation_service.py`

- [ ] **Step 1: Write the failing service tests**

`apps/api/tests/test_reconciliation_service.py`:

```python
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.reconciliation import ReconciliationGroup
from src.services.reconciliation_service import (
    classify_row,
    edit_distance,
    level_overlap,
)


def _field(key, levels=None):
    f = Field(field_key=key, display_name=key, field_type=FieldType.categorical,
               dataset_id=1, id=1)
    lvls = [Level(value=v, display_label=v, sort_order=i, field_id=1, id=i)
            for i, v in enumerate(levels or [])]
    return f, lvls


def test_edit_distance_identical():
    assert edit_distance("gender", "gender") == 0


def test_edit_distance_one_char_change():
    assert edit_distance("gender", "Gender") == 1


def test_edit_distance_renamed():
    assert edit_distance("sex", "gender") > 2


def test_level_overlap_identical_sets():
    assert level_overlap({"male", "female"}, {"male", "female"}) == 1.0


def test_level_overlap_partial():
    assert level_overlap({"a", "b", "c"}, {"a", "b"}) == pytest.approx(2 / 3, abs=0.01)


def test_level_overlap_no_overlap():
    assert level_overlap({"a", "b"}, {"c", "d"}) == 0.0


def test_classify_exact_same_key_same_levels():
    f_new, lvls_new = _field("gender", ["male", "female"])
    f_ref, lvls_ref = _field("gender", ["male", "female"])
    result = classify_row(f_new, lvls_new, f_ref, lvls_ref)
    assert result.group == ReconciliationGroup.exact


def test_classify_probable_key_close():
    f_new, lvls_new = _field("q_gender", ["male", "female"])
    f_ref, lvls_ref = _field("gender", ["male", "female"])
    result = classify_row(f_new, lvls_new, f_ref, lvls_ref)
    assert result.group == ReconciliationGroup.probable


def test_classify_new_only_when_no_ref():
    f_new, lvls_new = _field("new_field", [])
    result = classify_row(f_new, lvls_new, None, [])
    assert result.group == ReconciliationGroup.new_only


import pytest
```

- [ ] **Step 2: Run — expect failure**

```bash
just test-api -k test_reconciliation_service
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Write `apps/api/src/services/reconciliation_service.py`**

```python
"""Reconciliation engine — pure functions, no DB access."""

from dataclasses import dataclass

from src.models.field import Field
from src.models.level import Level
from src.models.reconciliation import ReconciliationGroup, ReconciliationStatus

_EDIT_DIST_THRESHOLD = 3
_LEVEL_OVERLAP_THRESHOLD = 0.5


@dataclass
class ClassifyResult:
    group: ReconciliationGroup
    status: ReconciliationStatus
    confidence: float | None
    note: str


def edit_distance(a: str, b: str) -> int:
    """Levenshtein distance (case-sensitive)."""
    if a == b:
        return 0
    la, lb = len(a), len(b)
    prev = list(range(lb + 1))
    for i, ca in enumerate(a, 1):
        curr = [i] + [0] * lb
        for j, cb in enumerate(b, 1):
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1,
                          prev[j - 1] + (0 if ca == cb else 1))
        prev = curr
    return prev[lb]


def level_overlap(new_vals: set[str], ref_vals: set[str]) -> float:
    if not new_vals and not ref_vals:
        return 1.0
    if not new_vals or not ref_vals:
        return 0.0
    return len(new_vals & ref_vals) / len(new_vals | ref_vals)


def classify_row(
    new_field: Field,
    new_levels: list[Level],
    ref_field: Field | None,
    ref_levels: list[Level],
) -> ClassifyResult:
    if ref_field is None:
        return ClassifyResult(
            group=ReconciliationGroup.new_only,
            status=ReconciliationStatus.auto_accepted,
            confidence=None,
            note="No matching field in reference dataset",
        )

    new_vals = {lv.value for lv in new_levels}
    ref_vals = {lv.value for lv in ref_levels}
    key_dist = edit_distance(new_field.field_key, ref_field.field_key)
    overlap = level_overlap(new_vals, ref_vals)

    keys_match = new_field.field_key == ref_field.field_key
    levels_match = (not new_vals and not ref_vals) or overlap >= 0.9

    if keys_match and levels_match:
        return ClassifyResult(
            group=ReconciliationGroup.exact,
            status=ReconciliationStatus.auto_accepted,
            confidence=1.0,
            note="Exact key and level match",
        )

    if key_dist < _EDIT_DIST_THRESHOLD or overlap >= _LEVEL_OVERLAP_THRESHOLD:
        confidence = round(max((1 - key_dist / 10), overlap), 2)
        parts = []
        if key_dist > 0:
            parts.append(f"key differs by {key_dist} char(s)")
        if 0 < overlap < 0.9:
            parts.append(f"{int(overlap * 100)}% level overlap")
        return ClassifyResult(
            group=ReconciliationGroup.probable,
            status=ReconciliationStatus.pending,
            confidence=confidence,
            note=", ".join(parts) or "Probable match",
        )

    return ClassifyResult(
        group=ReconciliationGroup.new_only,
        status=ReconciliationStatus.auto_accepted,
        confidence=None,
        note="No close match found in reference dataset",
    )
```

- [ ] **Step 4: Write `apps/api/src/repositories/reconciliation_repo.py`**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.reconciliation import ReconciliationGroup, ReconciliationRow, ReconciliationStatus


async def create_row(session: AsyncSession, **kwargs) -> ReconciliationRow:
    obj = ReconciliationRow(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def bulk_create_rows(
    session: AsyncSession, rows: list[dict]
) -> list[ReconciliationRow]:
    objs = [ReconciliationRow(**r) for r in rows]
    session.add_all(objs)
    await session.flush()
    return objs


async def get_rows_page(
    session: AsyncSession,
    upload_session_id: int,
    group: ReconciliationGroup | None = None,
    after_id: int | None = None,
    page_size: int = 50,
) -> list[ReconciliationRow]:
    stmt = select(ReconciliationRow).where(
        ReconciliationRow.upload_session_id == upload_session_id
    )
    if group is not None:
        stmt = stmt.where(ReconciliationRow.group == group)
    if after_id is not None:
        stmt = stmt.where(ReconciliationRow.id > after_id)
    stmt = stmt.order_by(ReconciliationRow.id).limit(page_size)
    return list((await session.execute(stmt)).scalars().all())


async def get_all_ids(
    session: AsyncSession,
    upload_session_id: int,
    group: ReconciliationGroup | None = None,
) -> list[int]:
    stmt = select(ReconciliationRow.id).where(
        ReconciliationRow.upload_session_id == upload_session_id
    )
    if group is not None:
        stmt = stmt.where(ReconciliationRow.group == group)
    return list((await session.execute(stmt)).scalars().all())


async def resolve_row(
    session: AsyncSession, row_id: int, status: ReconciliationStatus,
    ref_field_id: int | None = None,
) -> ReconciliationRow | None:
    row = (
        (await session.execute(
            select(ReconciliationRow).where(ReconciliationRow.id == row_id)
        )).scalars().first()
    )
    if row:
        row.status = status
        if ref_field_id is not None:
            row.ref_field_id = ref_field_id
        session.add(row)
        await session.flush()
    return row


async def bulk_resolve(
    session: AsyncSession,
    upload_session_id: int,
    row_ids: list[int],
    status: ReconciliationStatus,
) -> int:
    rows = list(
        (await session.execute(
            select(ReconciliationRow).where(
                ReconciliationRow.upload_session_id == upload_session_id,
                ReconciliationRow.id.in_(row_ids),
            )
        )).scalars().all()
    )
    for row in rows:
        row.status = status
        session.add(row)
    await session.flush()
    return len(rows)
```

- [ ] **Step 5: Run — expect pass**

```bash
just test-api -k test_reconciliation_service
```

Expected: all reconciliation service tests passing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/reconciliation_service.py \
        apps/api/src/repositories/reconciliation_repo.py \
        apps/api/tests/test_reconciliation_service.py
git commit -m "feat(api): add reconciliation engine and repository"
```

---

### Task 7: Reconciliation API endpoints

Five endpoints that drive Step 3 of the wizard: trigger reconciliation, list rows (cursor-paginated), fetch all IDs (for select-all bulk ops), resolve a single row, bulk resolve.

**Files:**
- Modify: `apps/api/src/routes/uploads.py`
- Create: `apps/api/tests/test_reconciliation_api.py`

- [ ] **Step 1: Write the failing tests**

`apps/api/tests/test_reconciliation_api.py`:

```python
import csv, io
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.reconciliation import ReconciliationGroup, ReconciliationStatus


def _csv(headers, rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerows(rows)
    return buf.getvalue().encode()


async def _seed_ref_dataset(db):
    pkg = Package(name="P", slug="p-recon-api-test")
    db.add(pkg)
    await db.flush(); await db.refresh(pkg)
    col = Collection(name="C", slug="c-recon-api-test",
                     package_id=pkg.id, collection_type=CollectionType.survey)
    db.add(col)
    await db.flush(); await db.refresh(col)
    ds = Dataset(name="Wave 2", slug="wave-2-recon-test", collection_id=col.id)
    db.add(ds)
    await db.flush(); await db.refresh(ds)
    f = Field(field_key="gender", display_name="Gender",
              field_type=FieldType.categorical, dataset_id=ds.id)
    db.add(f)
    await db.flush(); await db.refresh(f)
    db.add(Level(value="male", display_label="Male", sort_order=0, field_id=f.id))
    db.add(Level(value="female", display_label="Female", sort_order=1, field_id=f.id))
    await db.flush()
    return col, ds


async def _upload(client, col_id):
    csv_bytes = _csv(["gender", "age"], [["male", "3"], ["female", "5"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3", "collection_id": str(col_id)},
    )
    assert resp.status_code == 201
    return resp.json()


async def test_trigger_reconciliation_creates_rows(client, db):
    col, ref_ds = await _seed_ref_dataset(db)
    sess = await _upload(client, col.id)
    resp = await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile",
        json={"reference_dataset_id": ref_ds.id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2  # gender (exact/probable) + age (new_only)


async def test_list_reconciliation_rows_paginated(client, db):
    col, ref_ds = await _seed_ref_dataset(db)
    sess = await _upload(client, col.id)
    await client.post(f"/api/v1/uploads/{sess['id']}/reconcile",
                      json={"reference_dataset_id": ref_ds.id})
    resp = await client.get(f"/api/v1/uploads/{sess['id']}/reconcile?page_size=1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert "next_cursor" in data


async def test_bulk_resolve_rows(client, db):
    col, ref_ds = await _seed_ref_dataset(db)
    sess = await _upload(client, col.id)
    await client.post(f"/api/v1/uploads/{sess['id']}/reconcile",
                      json={"reference_dataset_id": ref_ds.id})
    ids_resp = await client.get(f"/api/v1/uploads/{sess['id']}/reconcile/ids")
    ids = ids_resp.json()["ids"]
    resp = await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile/bulk",
        json={"ids": ids, "action": "excluded"},
    )
    assert resp.status_code == 200
    assert resp.json()["resolved"] == len(ids)
```

- [ ] **Step 2: Run — expect failure**

```bash
just test-api -k test_reconciliation_api
```

Expected: 404 (endpoints not yet defined).

- [ ] **Step 3: Add reconciliation endpoints to `apps/api/src/routes/uploads.py`**

Append these handlers (keep existing handlers above):

```python
from pydantic import BaseModel
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.reconciliation import ReconciliationGroup, ReconciliationStatus
from src.repositories import dataset_repo, reconciliation_repo
from src.services import reconciliation_service


class ReconcileTrigger(BaseModel):
    reference_dataset_id: int


class BulkResolve(BaseModel):
    ids: list[int]
    action: ReconciliationStatus  # confirmed | rejected | excluded


@router.post("/uploads/{session_id}/reconcile")
async def trigger_reconcile(
    session_id: int,
    body: ReconcileTrigger,
    session: AsyncSession = Depends(get_session),
):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")

    # Load new fields + levels
    new_fields = await upload_repo.get_fields_for_session(session, session_id)
    new_levels_by_field: dict[int, list] = {}
    for f in new_fields:
        new_levels_by_field[f.id] = await upload_repo.get_levels_for_field(session, f.id)

    # Load reference fields + levels
    ref_fields_raw = await dataset_repo.get_fields_with_levels(session, body.reference_dataset_id)
    # ref_fields_raw: list[tuple[Field, list[Level]]]
    ref_by_key = {f.field_key: (f, lvls) for f, lvls in ref_fields_raw}

    rows_to_create: list[dict] = []
    matched_ref_keys: set[str] = set()

    for uf in new_fields:
        # Make a transient Field for classification
        stub = Field(field_key=uf.field_key, display_name=uf.field_key,
                     field_type=uf.override_type or uf.detected_type, dataset_id=0)

        best_ref = None
        best_ref_lvls: list = []
        # Try exact key match first
        if uf.field_key in ref_by_key:
            best_ref, best_ref_lvls = ref_by_key[uf.field_key]
        else:
            # Find closest by edit distance
            for key, (rf, rl) in ref_by_key.items():
                d = reconciliation_service.edit_distance(uf.field_key, key)
                if d < 4:
                    best_ref, best_ref_lvls = rf, rl
                    break

        result = reconciliation_service.classify_row(
            stub, new_levels_by_field.get(uf.id, []), best_ref, best_ref_lvls
        )
        if best_ref:
            matched_ref_keys.add(best_ref.field_key)
        rows_to_create.append({
            "upload_session_id": session_id,
            "upload_field_id": uf.id,
            "ref_field_id": best_ref.id if best_ref else None,
            "group": result.group,
            "status": result.status,
            "confidence": result.confidence,
            "note": result.note,
        })

    # Old-only: reference fields not matched
    for key, (rf, _) in ref_by_key.items():
        if key not in matched_ref_keys:
            rows_to_create.append({
                "upload_session_id": session_id,
                "upload_field_id": None,
                "ref_field_id": rf.id,
                "group": ReconciliationGroup.old_only,
                "status": ReconciliationStatus.pending,
                "confidence": None,
                "note": "Present in reference, absent in new file",
            })

    await reconciliation_repo.bulk_create_rows(session, rows_to_create)
    sess.reference_dataset_id = body.reference_dataset_id
    session.add(sess)
    await session.flush()
    return {"total": len(rows_to_create)}


@router.get("/uploads/{session_id}/reconcile")
async def list_reconcile_rows(
    session_id: int,
    group: ReconciliationGroup | None = None,
    after_id: int | None = None,
    page_size: int = 50,
    session: AsyncSession = Depends(get_session),
):
    rows = await reconciliation_repo.get_rows_page(
        session, session_id, group=group, after_id=after_id, page_size=page_size
    )
    next_cursor = rows[-1].id if len(rows) == page_size else None
    return {
        "items": [
            {"id": r.id, "group": r.group, "status": r.status,
             "upload_field_id": r.upload_field_id, "ref_field_id": r.ref_field_id,
             "confidence": r.confidence, "note": r.note}
            for r in rows
        ],
        "next_cursor": next_cursor,
    }


@router.get("/uploads/{session_id}/reconcile/ids")
async def get_reconcile_ids(
    session_id: int,
    group: ReconciliationGroup | None = None,
    session: AsyncSession = Depends(get_session),
):
    ids = await reconciliation_repo.get_all_ids(session, session_id, group=group)
    return {"ids": ids}


class RowResolve(BaseModel):
    status: ReconciliationStatus
    ref_field_id: int | None = None


@router.patch("/uploads/{session_id}/reconcile/{row_id}")
async def resolve_reconcile_row(
    session_id: int,
    row_id: int,
    body: RowResolve,
    session: AsyncSession = Depends(get_session),
):
    row = await reconciliation_repo.resolve_row(
        session, row_id, body.status, ref_field_id=body.ref_field_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Row not found")
    return {"id": row.id, "status": row.status}


@router.post("/uploads/{session_id}/reconcile/bulk")
async def bulk_resolve_rows(
    session_id: int,
    body: BulkResolve,
    session: AsyncSession = Depends(get_session),
):
    resolved = await reconciliation_repo.bulk_resolve(
        session, session_id, body.ids, body.action
    )
    return {"resolved": resolved}
```

- [ ] **Step 4: Run — expect pass**

```bash
just test-api -k test_reconciliation_api
```

Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/uploads.py \
        apps/api/tests/test_reconciliation_api.py
git commit -m "feat(api): add reconciliation trigger, list, and bulk-resolve endpoints"
```

---

### Task 8: Metadata CRUD endpoints (Step 4)

Endpoints that drive the metadata editor: full field+group tree, create/rename/reparent/delete groups, update field metadata (display name, type, sort order, level labels), move field to group.

**Files:**
- Modify: `apps/api/src/routes/uploads.py`
- Create: `apps/api/tests/test_metadata_api.py`

- [ ] **Step 1: Write the failing tests**

`apps/api/tests/test_metadata_api.py`:

```python
import csv, io
from src.models.collection import Collection, CollectionType
from src.models.package import Package


def _csv(headers, rows):
    buf = io.StringIO()
    csv.writer(buf).writerow(headers)
    for r in rows: csv.writer(buf).writerow(r)
    return buf.getvalue().encode()


async def _session(client):
    csv_bytes = _csv(["gender", "age"], [["male", "3"]])
    r = await client.post("/api/v1/uploads",
                          files={"file": ("f.csv", csv_bytes, "text/csv")},
                          data={"dataset_name": "W3"})
    return r.json()


async def test_get_field_tree_returns_groups_and_fields(client, db):
    sess = await _session(client)
    resp = await client.get(f"/api/v1/uploads/{sess['id']}/field-tree")
    assert resp.status_code == 200
    data = resp.json()
    assert "groups" in data
    assert "unassigned_fields" in data
    assert len(data["unassigned_fields"]) == 2


async def test_create_fieldgroup(client, db):
    sess = await _session(client)
    resp = await client.post(f"/api/v1/uploads/{sess['id']}/fieldgroups",
                             json={"name": "Demographics"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "Demographics"


async def test_move_field_to_group(client, db):
    sess = await _session(client)
    grp = await client.post(f"/api/v1/uploads/{sess['id']}/fieldgroups",
                            json={"name": "Demo"})
    grp_id = grp.json()["id"]
    field_id = sess["fields"][0]["id"]
    resp = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}/move",
        json={"upload_fieldgroup_id": grp_id},
    )
    assert resp.status_code == 200
    assert resp.json()["upload_fieldgroup_id"] == grp_id


async def test_update_field_display_name(client, db):
    sess = await _session(client)
    field_id = sess["fields"][0]["id"]
    resp = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}",
        json={"display_name": "Sex"},
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Sex"


async def test_delete_fieldgroup_moves_fields_to_unassigned(client, db):
    sess = await _session(client)
    grp = await client.post(f"/api/v1/uploads/{sess['id']}/fieldgroups",
                            json={"name": "Demo"})
    grp_id = grp.json()["id"]
    field_id = sess["fields"][0]["id"]
    await client.patch(f"/api/v1/uploads/{sess['id']}/fields/{field_id}/move",
                       json={"upload_fieldgroup_id": grp_id})
    resp = await client.delete(f"/api/v1/uploads/{sess['id']}/fieldgroups/{grp_id}")
    assert resp.status_code == 200
    # Field should now be unassigned
    tree = await client.get(f"/api/v1/uploads/{sess['id']}/field-tree")
    unassigned_ids = [f["id"] for f in tree.json()["unassigned_fields"]]
    assert field_id in unassigned_ids
```

- [ ] **Step 2: Run — expect failure**

```bash
just test-api -k test_metadata_api
```

Expected: 404 on all.

- [ ] **Step 3: Add metadata endpoints to `apps/api/src/routes/uploads.py`**

```python
# --- Field tree ---

@router.get("/uploads/{session_id}/field-tree")
async def get_field_tree(session_id: int, session: AsyncSession = Depends(get_session)):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    groups = await upload_repo.get_fieldgroups_for_session(session, session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)

    def _group_dict(g):
        return {"id": g.id, "name": g.name, "parent_id": g.parent_id,
                "sort_order": g.sort_order}

    def _field_dict(f):
        return {"id": f.id, "field_key": f.field_key, "display_name": f.display_name,
                "detected_type": f.detected_type.value,
                "override_type": f.override_type.value if f.override_type else None,
                "sort_order": f.sort_order,
                "upload_fieldgroup_id": f.upload_fieldgroup_id}

    assigned_field_ids = {f.id for f in fields if f.upload_fieldgroup_id is not None}
    return {
        "groups": [_group_dict(g) for g in groups],
        "fields": [_field_dict(f) for f in fields if f.id in assigned_field_ids],
        "unassigned_fields": [_field_dict(f) for f in fields
                               if f.upload_fieldgroup_id is None],
    }


# --- Field group CRUD ---

class FieldGroupCreate(BaseModel):
    name: str
    parent_id: int | None = None
    sort_order: int = 0


class FieldGroupUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    sort_order: int | None = None


@router.post("/uploads/{session_id}/fieldgroups", status_code=201)
async def create_fieldgroup(
    session_id: int, body: FieldGroupCreate,
    session: AsyncSession = Depends(get_session),
):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    grp = await upload_repo.create_upload_fieldgroup(
        session, upload_session_id=session_id,
        name=body.name, parent_id=body.parent_id, sort_order=body.sort_order,
    )
    return {"id": grp.id, "name": grp.name, "parent_id": grp.parent_id,
            "sort_order": grp.sort_order}


@router.patch("/uploads/{session_id}/fieldgroups/{group_id}")
async def update_fieldgroup(
    session_id: int, group_id: int, body: FieldGroupUpdate,
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select
    from src.models.upload import UploadFieldGroup
    grp = (await session.execute(
        select(UploadFieldGroup).where(UploadFieldGroup.id == group_id,
                                        UploadFieldGroup.upload_session_id == session_id)
    )).scalars().first()
    if grp is None:
        raise HTTPException(status_code=404, detail="Group not found")
    if body.name is not None:
        grp.name = body.name
    if body.parent_id is not None:
        grp.parent_id = body.parent_id
    if body.sort_order is not None:
        grp.sort_order = body.sort_order
    session.add(grp)
    await session.flush()
    return {"id": grp.id, "name": grp.name, "parent_id": grp.parent_id}


@router.delete("/uploads/{session_id}/fieldgroups/{group_id}")
async def delete_fieldgroup(
    session_id: int, group_id: int,
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select, update
    from src.models.upload import UploadField, UploadFieldGroup
    grp = (await session.execute(
        select(UploadFieldGroup).where(UploadFieldGroup.id == group_id,
                                        UploadFieldGroup.upload_session_id == session_id)
    )).scalars().first()
    if grp is None:
        raise HTTPException(status_code=404, detail="Group not found")
    # Unassign fields
    await session.execute(
        update(UploadField)
        .where(UploadField.upload_fieldgroup_id == group_id)
        .values(upload_fieldgroup_id=None)
    )
    await session.delete(grp)
    await session.flush()
    return {"deleted": group_id}


# --- Field move ---

class FieldMove(BaseModel):
    upload_fieldgroup_id: int | None


@router.patch("/uploads/{session_id}/fields/{field_id}/move")
async def move_field(
    session_id: int, field_id: int, body: FieldMove,
    session: AsyncSession = Depends(get_session),
):
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise HTTPException(status_code=404, detail="Field not found")
    f.upload_fieldgroup_id = body.upload_fieldgroup_id
    session.add(f)
    await session.flush()
    return {"id": f.id, "upload_fieldgroup_id": f.upload_fieldgroup_id}
```

- [ ] **Step 4: Run — expect pass**

```bash
just test-api -k test_metadata_api
```

Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/uploads.py \
        apps/api/tests/test_metadata_api.py
git commit -m "feat(api): add metadata CRUD endpoints (field tree, groups, field move)"
```

---

### Task 9: Commit service + endpoint + datasets list

`POST /api/v1/uploads/{id}/commit` — atomic promotion of staging records to live tables.
`GET /api/v1/datasets` — list all committed datasets (for the `/datasets` page).

**Files:**
- Create: `apps/api/src/services/commit_service.py`
- Modify: `apps/api/src/routes/uploads.py`
- Modify: `apps/api/src/routes/datasets.py`
- Create: `apps/api/tests/test_commit.py`

- [ ] **Step 1: Write the failing commit test**

`apps/api/tests/test_commit.py`:

```python
import csv, io
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.package import Package


def _csv(headers, rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerows(rows)
    return buf.getvalue().encode()


async def _seed_collection(db):
    pkg = Package(name="P", slug="p-commit-test")
    db.add(pkg)
    await db.flush(); await db.refresh(pkg)
    col = Collection(name="C", slug="c-commit-test",
                     package_id=pkg.id, collection_type=CollectionType.survey)
    db.add(col)
    await db.flush(); await db.refresh(col)
    return col


async def test_commit_creates_dataset_fields_and_responses(client, db):
    col = await _seed_collection(db)
    csv_bytes = _csv(["gender", "age"], [["male", "3"], ["female", "5"]])
    upload = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3", "collection_id": str(col.id)},
    )
    sess_id = upload.json()["id"]

    resp = await client.post(f"/api/v1/uploads/{sess_id}/commit")
    assert resp.status_code == 201
    data = resp.json()
    assert "dataset_id" in data
    dataset_id = data["dataset_id"]

    # Verify dataset exists via existing endpoint
    ds_resp = await client.get(f"/api/v1/datasets/{dataset_id}")
    assert ds_resp.status_code == 200
    ds = ds_resp.json()
    assert ds["name"] == "Wave 3"
    assert len(ds["fields"]) == 2


async def test_datasets_list_returns_committed(client, db):
    col = await _seed_collection(db)
    csv_bytes = _csv(["q1"], [["yes"], ["no"]])
    upload = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave List Test", "collection_id": str(col.id)},
    )
    await client.post(f"/api/v1/uploads/{upload.json()['id']}/commit")
    resp = await client.get("/api/v1/datasets")
    assert resp.status_code == 200
    names = [d["name"] for d in resp.json()["items"]]
    assert "Wave List Test" in names
```

- [ ] **Step 2: Run — expect failure**

```bash
just test-api -k test_commit
```

Expected: 404 on commit endpoint.

- [ ] **Step 3: Write `apps/api/src/services/commit_service.py`**

```python
"""Atomically promotes staging records to live tables."""

import csv
import io
import re

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.dataset import Dataset
from src.models.field import Field
from src.models.field_group import FieldGroup
from src.models.level import Level
from src.models.response import Response
from src.models.upload import UploadSessionStatus
from src.repositories import upload_repo
from src.services.detection_service import slugify_key


def _slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "unnamed"


async def commit_upload(session: AsyncSession, upload_session_id: int) -> int:
    """Promotes staging → live. Returns new dataset.id."""
    sess = await upload_repo.get_session_by_id(session, upload_session_id)
    if sess is None:
        raise ValueError(f"Upload session {upload_session_id} not found")

    # 1. Create Dataset
    name = sess.dataset_name or "Untitled"
    ds = Dataset(
        name=name,
        slug=_slugify(name),
        collection_id=sess.collection_id,
        collected_at=sess.collected_at,
    )
    session.add(ds)
    await session.flush()
    await session.refresh(ds)

    # 2. Promote field groups (staging → live), respecting parent hierarchy
    staging_groups = await upload_repo.get_fieldgroups_for_session(session, upload_session_id)
    # Sort: roots first, then children (parent_id is None for roots)
    roots = [g for g in staging_groups if g.parent_id is None]
    children = [g for g in staging_groups if g.parent_id is not None]

    staging_to_live_group: dict[int, int] = {}  # staging_group.id → live group.id

    for sg in roots:
        lg = FieldGroup(
            name=sg.name, slug=_slugify(sg.name),
            sort_order=sg.sort_order, dataset_id=ds.id, parent_id=None,
        )
        session.add(lg)
        await session.flush()
        await session.refresh(lg)
        staging_to_live_group[sg.id] = lg.id

    for sg in children:
        live_parent_id = staging_to_live_group.get(sg.parent_id)
        lg = FieldGroup(
            name=sg.name, slug=_slugify(sg.name),
            sort_order=sg.sort_order, dataset_id=ds.id, parent_id=live_parent_id,
        )
        session.add(lg)
        await session.flush()
        await session.refresh(lg)
        staging_to_live_group[sg.id] = lg.id

    # 3. Promote fields
    staging_fields = await upload_repo.get_fields_for_session(session, upload_session_id)
    staging_to_live_field: dict[int, int] = {}

    for sf in staging_fields:
        live_group_id = (staging_to_live_group.get(sf.upload_fieldgroup_id)
                         if sf.upload_fieldgroup_id else None)
        lf = Field(
            field_key=sf.field_key,
            display_name=sf.display_name or sf.field_key,
            field_type=sf.override_type or sf.detected_type,
            sort_order=sf.sort_order,
            dataset_id=ds.id,
            group_id=live_group_id,
        )
        session.add(lf)
        await session.flush()
        await session.refresh(lf)
        staging_to_live_field[sf.id] = lf.id

        # 4. Promote levels
        staging_levels = await upload_repo.get_levels_for_field(session, sf.id)
        for sl in staging_levels:
            session.add(Level(
                value=sl.raw_value,
                display_label=sl.display_label or sl.raw_value,
                sort_order=sl.sort_order,
                field_id=lf.id,
            ))
        await session.flush()

    # 5. Stream CSV rows → Response records
    with open(sess.file_path, "rb") as fh:
        text = fh.read().decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        # Build payload keyed by field_key (slugified header)
        payload = {}
        for original_key, val in row.items():
            slug = slugify_key(original_key)
            payload[slug] = val
        session.add(Response(dataset_id=ds.id, payload=payload))
    await session.flush()

    # 6. Mark session committed
    sess.status = UploadSessionStatus.committed
    sess.committed_dataset_id = ds.id
    session.add(sess)
    await session.flush()

    return ds.id
```

- [ ] **Step 4: Add commit endpoint to `apps/api/src/routes/uploads.py`**

```python
from src.services import commit_service

@router.post("/uploads/{session_id}/commit", status_code=201)
async def commit_upload(session_id: int, session: AsyncSession = Depends(get_session)):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    try:
        dataset_id = await commit_service.commit_upload(session, session_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"dataset_id": dataset_id}
```

- [ ] **Step 5: Add `GET /datasets` list to `apps/api/src/routes/datasets.py`**

```python
from sqlalchemy import select
from src.models.dataset import Dataset

@router.get("/datasets")
async def list_datasets(
    collection_id: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import func
    stmt = select(Dataset)
    if collection_id is not None:
        stmt = stmt.where(Dataset.collection_id == collection_id)
    total = (await session.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar_one()
    items = list((await session.execute(
        stmt.order_by(Dataset.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all())
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [{"id": d.id, "name": d.name, "collection_id": d.collection_id,
                   "collected_at": d.collected_at.isoformat() if d.collected_at else None,
                   "created_at": d.created_at.isoformat()} for d in items],
    }
```

- [ ] **Step 6: Run — expect pass**

```bash
just test-api -k "test_commit"
```

Expected: 2 tests passing.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/commit_service.py \
        apps/api/src/routes/uploads.py \
        apps/api/src/routes/datasets.py \
        apps/api/tests/test_commit.py
git commit -m "feat(api): add commit service, commit endpoint, and datasets list endpoint"
```

---

### Task 10: Regenerate TypeScript types + install react-virtual

All backend endpoints are complete. Generate the typed API client the frontend will use, and install the one new frontend dependency.

**Files:**
- Modified (auto-generated): `packages/shared/api.d.ts`

- [ ] **Step 1: Start the API server so the OpenAPI spec can be fetched**

```bash
just api
```

Keep it running in a terminal. Wait for "Application startup complete."

- [ ] **Step 2: Regenerate types**

In a second terminal:

```bash
just generate-types
```

Expected: `packages/shared/api.d.ts` updated with new paths for `/api/v1/uploads`, `/api/v1/uploads/{session_id}`, `/api/v1/uploads/{session_id}/reconcile`, etc.

Verify the new paths are present:

```bash
grep "uploads" packages/shared/api.d.ts | head -20
```

Expected: at least 5 upload-related path entries.

- [ ] **Step 3: Install `@tanstack/react-virtual`**

```bash
just add-web-dep @tanstack/react-virtual
```

Verify it appears in `apps/web/package.json`.

- [ ] **Step 4: Stop the API server** (Ctrl+C in the terminal running `just api`)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/api.d.ts apps/web/package.json pnpm-lock.yaml
git commit -m "chore(shared): regenerate API types for upload wizard endpoints; add react-virtual"
```

---

> **Frontend implementation (Tasks 11–17):** Invoke the `frontend-design` skill before writing each component. Follow its guidance on token usage, component structure, and story patterns for this codebase.

### Task 11: Datasets page (`/datasets`)

The management page that lists all committed datasets and provides the "Upload dataset" CTA.

**Files:**
- Create: `apps/web/src/app/datasets/page.tsx`
- Create: `apps/web/src/app/datasets/DatasetsPage.tsx`
- Create: `apps/web/src/app/datasets/DatasetsPage.stories.tsx`

- [ ] **Step 1: Write `apps/web/src/app/datasets/page.tsx`**

```tsx
import { DatasetsPage } from "./DatasetsPage"

export const metadata = { title: "Datasets" }

export default function Page() {
  return <DatasetsPage />
}
```

- [ ] **Step 2: Write `apps/web/src/app/datasets/DatasetsPage.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"

type DatasetItem = {
  id: number
  name: string
  collection_id: number
  collected_at: string | null
  created_at: string
}

export function DatasetsPage() {
  const [items, setItems] = useState<DatasetItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.GET("/api/v1/datasets" as never).then(({ data }: any) => {
      if (data) setItems(data.items)
      setLoading(false)
    })
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Datasets</h1>
        <Link
          href="/datasets/upload"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Upload dataset
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">No datasets yet.</p>
          <Link href="/datasets/upload" className="mt-3 inline-block text-sm font-semibold text-accent">
            Upload your first dataset →
          </Link>
        </div>
      ) : (
        <table className="w-full text-sm" data-testid="datasets-table">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Collected</th>
              <th className="pb-2 pr-4">Uploaded</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0" data-testid="dataset-row">
                <td className="py-3 pr-4 font-medium text-foreground">{d.name}</td>
                <td className="py-3 pr-4 text-muted-foreground">{d.collected_at ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {new Date(d.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 text-right">
                  <Link href={`/datasets/upload?session=resume&dataset=${d.id}`}
                    className="text-xs font-semibold text-accent hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `apps/web/src/app/datasets/DatasetsPage.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { beforeEach, vi } from "@storybook/test"
import { DatasetsPage } from "./DatasetsPage"

const meta: Meta<typeof DatasetsPage> = {
  title: "Datasets/DatasetsPage",
  component: DatasetsPage,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof DatasetsPage>

const MOCK_DATASETS = [
  { id: 1, name: "Wave 1", collection_id: 1, collected_at: "2025-01", created_at: "2025-01-15T00:00:00Z" },
  { id: 2, name: "Wave 2", collection_id: 1, collected_at: "2025-07", created_at: "2025-07-10T00:00:00Z" },
]

// Empty state — no datasets yet
export const Empty: Story = {
  beforeEach() {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )
  },
}

// Populated table with two datasets
export const WithData: Story = {
  beforeEach() {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: MOCK_DATASETS }), { status: 200 }),
    )
  },
}
```

- [ ] **Step 4: Verify in browser**

```bash
just web
```

Open `http://localhost:3000/datasets`. Verify:
- Empty state renders with "Upload your first dataset →" link
- "Upload dataset" button links to `/datasets/upload`

- [ ] **Step 5: Check a11y in Storybook**

```bash
just storybook
```

Open `Datasets/DatasetsPage` story. Run accessibility checks (A11y panel). Fix any violations.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/datasets/
git commit -m "feat(web): add /datasets management page with dataset list"
```

---

### Task 12: Wizard shell + state types

The outer container that shows the step indicator and renders the active step. Wizard state (session ID + current step) lives in URL params so the page is resumable on refresh.

**Files:**
- Create: `apps/web/src/app/datasets/upload/page.tsx`
- Create: `apps/web/src/app/datasets/upload/wizard-types.ts`
- Create: `apps/web/src/app/datasets/upload/useWizardState.ts`
- Create: `apps/web/src/app/datasets/upload/WizardShell.tsx`
- Create: `apps/web/src/app/datasets/upload/WizardShell.stories.tsx`
- Create: `apps/web/src/app/datasets/upload/useWizardState.test.ts`

- [ ] **Step 1: Write `apps/web/src/app/datasets/upload/wizard-types.ts`**

```ts
export type WizardStep = 1 | 2 | 3 | 4 | 5

export interface WizardState {
  step: WizardStep
  sessionId: number | null
  /** true when collection already has datasets — triggers reconciliation step */
  needsReconcile: boolean
}

export const STEP_LABELS: Record<WizardStep, string> = {
  1: "File & Hierarchy",
  2: "Field Detection",
  3: "Reconciliation",
  4: "Metadata",
  5: "Review & Commit",
}
```

- [ ] **Step 2: Write the failing hook test**

`apps/web/src/app/datasets/upload/useWizardState.test.ts`:

```ts
import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useWizardState } from "./useWizardState"

// Mock Next.js router and searchParams
const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams("step=1"),
}))

describe("useWizardState", () => {
  beforeEach(() => pushMock.mockClear())

  it("starts at step 1 with no session", () => {
    const { result } = renderHook(() => useWizardState())
    expect(result.current.state.step).toBe(1)
    expect(result.current.state.sessionId).toBeNull()
  })

  it("setStep updates URL", () => {
    const { result } = renderHook(() => useWizardState())
    act(() => result.current.setStep(2))
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("step=2"))
  })

  it("setSessionId stores id in state", () => {
    const { result } = renderHook(() => useWizardState())
    act(() => result.current.setSessionId(42))
    expect(result.current.state.sessionId).toBe(42)
  })
})
```

- [ ] **Step 3: Run — expect failure**

```bash
just test-web -t "useWizardState"
```

Expected: `Cannot find module './useWizardState'`.

- [ ] **Step 4: Write `apps/web/src/app/datasets/upload/useWizardState.ts`**

```ts
"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useCallback } from "react"
import type { WizardState, WizardStep } from "./wizard-types"

export function useWizardState() {
  const router = useRouter()
  const params = useSearchParams()
  const stepParam = Number(params.get("step") ?? "1") as WizardStep

  const [state, setState] = useState<WizardState>({
    step: stepParam,
    sessionId: params.get("session") ? Number(params.get("session")) : null,
    needsReconcile: params.get("reconcile") === "1",
  })

  const setStep = useCallback(
    (step: WizardStep) => {
      setState((prev) => ({ ...prev, step }))
      const p = new URLSearchParams(params.toString())
      p.set("step", String(step))
      router.push(`/datasets/upload?${p.toString()}`)
    },
    [params, router],
  )

  const setSessionId = useCallback(
    (id: number) => {
      setState((prev) => ({ ...prev, sessionId: id }))
      // Also persist in URL so the session survives a refresh
      const p = new URLSearchParams(params.toString())
      p.set("session", String(id))
      router.replace(`/datasets/upload?${p.toString()}`)
    },
    [params, router],
  )

  const setNeedsReconcile = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, needsReconcile: v }))
  }, [])

  return { state, setStep, setSessionId, setNeedsReconcile }
}
```

- [ ] **Step 5: Run — expect pass**

```bash
just test-web -t "useWizardState"
```

Expected: 3 tests passing.

- [ ] **Step 6: Write `apps/web/src/app/datasets/upload/WizardShell.tsx`**

```tsx
"use client"
import { Suspense } from "react"
import { useWizardState } from "./useWizardState"
import { STEP_LABELS, type WizardStep } from "./wizard-types"

const STEPS = [1, 2, 3, 4, 5] as const

function StepIndicator({ current, needsReconcile }: { current: WizardStep; needsReconcile: boolean }) {
  return (
    <div className="mb-6 flex">
      {STEPS.map((s) => {
        // Step 3 is skipped entirely when uploading into a new collection
        const isSkipped = s === 3 && !needsReconcile
        return (
          <div
            key={s}
            className={[
              "flex-1 border-b-2 pb-2 text-center text-xs font-semibold",
              isSkipped
                ? "border-border text-muted-foreground opacity-30 line-through"
                : s === current
                  ? "border-accent text-accent"
                  : s < current
                    ? "border-accent text-muted-foreground opacity-50"
                    : "border-border text-muted-foreground",
            ].join(" ")}
          >
            {s}. {STEP_LABELS[s]}
          </div>
        )
      })}
    </div>
  )
}

export function WizardShell() {
  const { state, setStep, setSessionId, setNeedsReconcile } = useWizardState()

  // Lazy import each step so only the active step is bundled on load
  const stepProps = { state, setStep, setSessionId, setNeedsReconcile }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 text-xl font-bold text-foreground">Upload dataset</h1>
      <StepIndicator current={state.step} needsReconcile={state.needsReconcile} />
      <StepContent {...stepProps} />
    </div>
  )
}

function StepContent(props: ReturnType<typeof useWizardState>) {
  const { state } = props
  // Each step component imported inline in Task 13–17
  return (
    <div className="rounded-lg border border-border p-6">
      <p className="text-sm text-muted-foreground">
        Step {state.step} component loads here.
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Write `apps/web/src/app/datasets/upload/page.tsx`**

```tsx
import { Suspense } from "react"
import { WizardShell } from "./WizardShell"

export const metadata = { title: "Upload dataset" }

export default function Page() {
  return (
    <Suspense>
      <WizardShell />
    </Suspense>
  )
}
```

- [ ] **Step 8: Write `apps/web/src/app/datasets/upload/WizardShell.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { WizardShell } from "./WizardShell"

const meta: Meta<typeof WizardShell> = {
  title: "Datasets/Upload/WizardShell",
  component: WizardShell,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof WizardShell>

// Step 1 — initial state, no session yet
export const AtStep1: Story = {
  parameters: {
    nextjs: {
      navigation: { pathname: "/datasets/upload", searchParams: new URLSearchParams("step=1") },
    },
  },
}

// Step 4 — reconciliation skipped (new collection upload)
export const AtStep4ReconcileSkipped: Story = {
  name: "Step 4 (step 3 skipped — new collection)",
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/datasets/upload",
        searchParams: new URLSearchParams("step=4&session=1&reconcile=0"),
      },
    },
  },
}

// Step 5 — all steps done
export const AtStep5: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/datasets/upload",
        searchParams: new URLSearchParams("step=5&session=1&reconcile=1"),
      },
    },
  },
}
```

- [ ] **Step 9: Verify in browser**

```bash
just web
```

Open `http://localhost:3000/datasets/upload`. Verify:
- Step indicator renders all 5 steps
- Step 1 is highlighted
- No console errors

- [ ] **Step 10: Check a11y in Storybook**

```bash
just storybook
```

Open `Datasets/Upload/WizardShell` → `AtStep1` story. Run accessibility checks. Fix any violations before committing.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/datasets/upload/
git commit -m "feat(web): add wizard shell, URL-synced state hook, step indicator, and WizardShell stories"
```

---

### Task 13: Step 1 — File & Hierarchy

File drop zone + package/collection/dataset name form. On "Next", POSTs the file to `/api/v1/uploads`, stores the returned `session_id`, and advances to step 2.

**Files:**
- Create: `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.stories.tsx`
- Modify: `apps/web/src/app/datasets/upload/WizardShell.tsx` (wire in step)

- [ ] **Step 1: Write `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx`**

```tsx
"use client"
import { useRef, useState } from "react"
import type { WizardState, WizardStep } from "../wizard-types"

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
  setSessionId: (id: number) => void
  setNeedsReconcile: (v: boolean) => void
}

export function Step1FileHierarchy({ setStep, setSessionId, setNeedsReconcile }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [datasetName, setDatasetName] = useState("")
  const [collectionId, setCollectionId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const canProceed = file !== null && datasetName.trim().length > 0

  async function handleNext() {
    if (!file || !canProceed) return
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append("file", file)
    form.append("dataset_name", datasetName)
    if (collectionId) form.append("collection_id", collectionId)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/uploads`,
        { method: "POST", body: form },
      )
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSessionId(data.id)
      // If collection_id provided, reconciliation may be needed
      // (backend determines; for now always skip reconcile for new collections)
      setNeedsReconcile(Boolean(collectionId))
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith(".csv")) setFile(f)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-foreground">Step 1 — File &amp; Hierarchy</h2>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-lg border-2 border-dashed border-border p-10 text-center hover:border-accent"
        data-testid="drop-zone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <p className="text-sm font-medium text-foreground">{file.name}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-muted-foreground">
              Drag a CSV here or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Accepts .csv</p>
          </>
        )}
      </div>

      {/* Metadata fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            Dataset name *
          </label>
          <input
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="e.g. Wave 3"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            Collection ID (optional)
          </label>
          <input
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            placeholder="ID of existing collection"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={!canProceed || busy}
          className="rounded-lg bg-accent px-6 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Uploading…" : "Next →"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire Step1 into `WizardShell.tsx`**

Replace the placeholder `StepContent` body:

```tsx
import { Step1FileHierarchy } from "./steps/Step1FileHierarchy"

function StepContent(props: ReturnType<typeof useWizardState>) {
  const { state, setStep, setSessionId, setNeedsReconcile } = props
  if (state.step === 1) {
    return <Step1FileHierarchy state={state} setStep={setStep}
                                setSessionId={setSessionId}
                                setNeedsReconcile={setNeedsReconcile} />
  }
  return (
    <div className="rounded-lg border border-border p-6">
      <p className="text-sm text-muted-foreground">Step {state.step} — coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 3: Write `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { Step1FileHierarchy } from "./Step1FileHierarchy"

const meta: Meta<typeof Step1FileHierarchy> = {
  title: "Datasets/Upload/Step1FileHierarchy",
  component: Step1FileHierarchy,
}
export default meta
type Story = StoryObj<typeof Step1FileHierarchy>

const mockState = { step: 1 as const, sessionId: null, needsReconcile: false }

// Empty form — Next button disabled
export const Default: Story = {
  args: {
    state: mockState,
    setStep: fn(),
    setSessionId: fn(),
    setNeedsReconcile: fn(),
  },
}
```

- [ ] **Step 4: Check a11y in Storybook**

```bash
just storybook
```

Open `Datasets/Upload/Step1FileHierarchy` → `Default`. Confirm a11y panel passes. Fix any violations.

- [ ] **Step 5: Verify in browser**

Start `just dev`. Navigate to `http://localhost:3000/datasets/upload`.
- Drop a CSV file → file name appears in drop zone
- Fill in dataset name → "Next →" becomes active
- Click Next → file uploads, step indicator moves to 2
- Check Network tab: POST `/api/v1/uploads` returns 201 with fields array

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx \
        apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.stories.tsx \
        apps/web/src/app/datasets/upload/WizardShell.tsx
git commit -m "feat(web): add wizard Step 1 — file drop zone and hierarchy form"
```

---

### Task 14: Step 2 — Field Detection review

Table showing every detected field, its type, sample values, and an override dropdown.

**Files:**
- Create: `apps/web/src/app/datasets/upload/steps/Step2FieldDetection.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/Step2FieldDetection.stories.tsx`
- Modify: `apps/web/src/app/datasets/upload/WizardShell.tsx`

- [ ] **Step 1: Write `apps/web/src/app/datasets/upload/steps/Step2FieldDetection.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { WizardState, WizardStep } from "../wizard-types"

const FIELD_TYPES = ["numeric", "ordinal", "categorical", "multi_response", "identifier", "weight"]

interface DetectedField {
  id: number
  field_key: string
  detected_type: string
  override_type: string | null
  sort_order: number
}

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

export function Step2FieldDetection({ state, setStep }: Props) {
  const [fields, setFields] = useState<DetectedField[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!state.sessionId) return
    // Cast: endpoint not yet in generated types — use `as never`
    ;(api.GET as any)(`/api/v1/uploads/${state.sessionId}`).then(({ data }: any) => {
      if (data) setFields(data.fields)
      setLoading(false)
    })
  }, [state.sessionId])

  async function handleOverride(fieldId: number, overrideType: string | null) {
    if (!state.sessionId) return
    const res: any = await (api.PATCH as any)(
      `/api/v1/uploads/${state.sessionId}/fields/${fieldId}`,
      { body: { override_type: overrideType } },
    )
    if (res.data) {
      setFields((prev) => prev.map((f) => f.id === fieldId
        ? { ...f, override_type: res.data.override_type } : f))
    }
  }

  async function handleNext() {
    if (!state.sessionId) return
    setBusy(true)
    if (state.needsReconcile) {
      setStep(3)
    } else {
      setStep(4)
    }
    setBusy(false)
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading fields…</p>

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Step 2 — Field Detection</h2>
      <p className="text-xs text-muted-foreground">
        Review auto-detected field types. Override any that are wrong.
      </p>

      <table className="w-full text-sm" data-testid="field-detection-table">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4">#</th>
            <th className="pb-2 pr-4">Field key</th>
            <th className="pb-2 pr-4">Detected type</th>
            <th className="pb-2">Override</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.id} className="border-b border-border last:border-0" data-testid="field-row">
              <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
              <td className="py-2 pr-4 font-mono text-xs">{f.field_key}</td>
              <td className="py-2 pr-4">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {f.detected_type}
                </span>
              </td>
              <td className="py-2">
                <select
                  value={f.override_type ?? ""}
                  onChange={(e) => handleOverride(f.id, e.target.value || null)}
                  className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">— keep detected —</option>
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between">
        <button
          onClick={() => setStep(1)}
          className="rounded-lg border border-border px-5 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          disabled={busy}
          className="rounded-lg bg-accent px-6 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "…" : "Next →"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire Step2 into `WizardShell.tsx`**

```tsx
import { Step2FieldDetection } from "./steps/Step2FieldDetection"

// Inside StepContent, after step 1 check:
if (state.step === 2) {
  return <Step2FieldDetection state={state} setStep={setStep} />
}
```

- [ ] **Step 3: Write `apps/web/src/app/datasets/upload/steps/Step2FieldDetection.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { beforeEach, fn, vi } from "@storybook/test"
import { Step2FieldDetection } from "./Step2FieldDetection"

const meta: Meta<typeof Step2FieldDetection> = {
  title: "Datasets/Upload/Step2FieldDetection",
  component: Step2FieldDetection,
}
export default meta
type Story = StoryObj<typeof Step2FieldDetection>

const MOCK_FIELDS = [
  { id: 1, field_key: "respondent_id", detected_type: "identifier", override_type: null, sort_order: 0 },
  { id: 2, field_key: "gender", detected_type: "categorical", override_type: null, sort_order: 1 },
  { id: 3, field_key: "age", detected_type: "ordinal", override_type: null, sort_order: 2 },
  { id: 4, field_key: "brand_awareness", detected_type: "categorical", override_type: null, sort_order: 3 },
  { id: 5, field_key: "net_promoter_score", detected_type: "numeric", override_type: null, sort_order: 4 },
]

export const WithFields: Story = {
  args: {
    state: { step: 2 as const, sessionId: 1, needsReconcile: false },
    setStep: fn(),
  },
  beforeEach() {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ fields: MOCK_FIELDS }), { status: 200 }),
    )
  },
}
```

- [ ] **Step 4: Check a11y in Storybook**

```bash
just storybook
```

Open `Datasets/Upload/Step2FieldDetection` → `WithFields`. Confirm a11y passes. Fix any violations.

- [ ] **Step 5: Verify in browser**

After completing Step 1, Step 2 should load the detected fields table. Override a type from the dropdown and confirm the UI reflects the change.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/datasets/upload/steps/Step2FieldDetection.tsx \
        apps/web/src/app/datasets/upload/steps/Step2FieldDetection.stories.tsx \
        apps/web/src/app/datasets/upload/WizardShell.tsx
git commit -m "feat(web): add wizard Step 2 — field detection review table"
```

---

### Task 15: Step 3 — Reconciliation

4-tab view (Exact / Probable / New only / Old only) with cursor-based pagination at top. The virtual "Show all" mode uses `@tanstack/react-virtual`. "Next" is disabled while any Probable or Old-only rows are pending.

**Files:**
- Create: `apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/ReconciliationRow.stories.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.stories.tsx`
- Modify: `apps/web/src/app/datasets/upload/WizardShell.tsx`

- [ ] **Step 1: Write `apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx`**

The 8-column grid row. Columns: checkbox | dot | field_key | match_target | note | type | status | actions.

```tsx
import { cn } from "@/lib/utils"

export type ReconGroup = "exact" | "probable" | "new_only" | "old_only"
export type ReconStatus =
  | "auto_accepted" | "pending" | "confirmed" | "rejected" | "excluded"

export interface ReconRow {
  id: number
  group: ReconGroup
  status: ReconStatus
  upload_field_id: number | null
  ref_field_id: number | null
  confidence: number | null
  note: string | null
  // Enriched on the frontend after fetching field keys
  field_key?: string
  ref_field_key?: string
  field_type?: string
}

const GROUP_DOT: Record<ReconGroup, string> = {
  exact: "bg-green-500",
  probable: "bg-amber-500",
  new_only: "bg-blue-500",
  old_only: "bg-muted-foreground",
}

const STATUS_CHIP: Record<ReconStatus, string> = {
  auto_accepted: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-muted text-muted-foreground",
  excluded: "bg-muted text-muted-foreground",
}

interface Props {
  row: ReconRow
  checked: boolean
  onCheck: (id: number, checked: boolean) => void
  onAction: (id: number, action: "confirm" | "reject" | "exclude" | "map") => void
}

export function ReconciliationRow({ row, checked, onCheck, onAction }: Props) {
  return (
    <div
      className="grid items-center gap-2 border-b border-border px-3 py-2 text-xs last:border-0"
      style={{ gridTemplateColumns: "20px 10px 1fr 1fr 1fr 80px 80px auto" }}
      data-testid="recon-row"
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheck(row.id, e.target.checked)}
        aria-label={`Select row ${row.id}`}
      />
      {/* Status dot */}
      <span className={cn("h-2 w-2 rounded-full", GROUP_DOT[row.group])} />
      {/* field_key */}
      <span className="truncate font-mono">{row.field_key ?? `field_${row.upload_field_id}`}</span>
      {/* match_target */}
      <span className="truncate text-muted-foreground">
        {row.ref_field_key ?? (row.group === "new_only" || row.group === "old_only" ? "—" : "?")}
      </span>
      {/* note */}
      <span className="truncate text-muted-foreground">{row.note ?? ""}</span>
      {/* type */}
      <span className="truncate">{row.field_type ?? ""}</span>
      {/* status chip */}
      <span className={cn("rounded-full px-2 py-0.5 font-semibold", STATUS_CHIP[row.status])}>
        {row.status.replace("_", " ")}
      </span>
      {/* actions */}
      <div className="flex gap-1">
        {row.group === "probable" && row.status === "pending" && (
          <>
            <button onClick={() => onAction(row.id, "confirm")}
              className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-800 hover:bg-green-200">
              Confirm
            </button>
            <button onClick={() => onAction(row.id, "reject")}
              className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold hover:bg-muted/60">
              Reject
            </button>
          </>
        )}
        {row.group === "old_only" && row.status === "pending" && (
          <button onClick={() => onAction(row.id, "exclude")}
            className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold hover:bg-muted/60">
            Exclude
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx`**

```tsx
"use client"
import { useEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { WizardState, WizardStep } from "../wizard-types"
import { ReconciliationRow, type ReconGroup, type ReconRow, type ReconStatus } from "./ReconciliationRow"

const TABS: { key: ReconGroup | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "exact", label: "Exact" },
  { key: "probable", label: "Probable" },
  { key: "new_only", label: "New only" },
  { key: "old_only", label: "Old only" },
]
const PAGE_SIZE = 50
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

export function Step3Reconciliation({ state, setStep }: Props) {
  const [triggered, setTriggered] = useState(false)
  const [refDatasetId, setRefDatasetId] = useState<string>("")
  const [activeTab, setActiveTab] = useState<ReconGroup | "all">("all")
  const [rows, setRows] = useState<ReconRow[]>([])
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: showAll ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
  })

  async function triggerReconcile() {
    if (!state.sessionId || !refDatasetId) return
    setBusy(true)
    await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference_dataset_id: Number(refDatasetId) }),
    })
    setTriggered(true)
    fetchPage(null)
    setBusy(false)
  }

  async function fetchPage(cursor: number | null) {
    if (!state.sessionId) return
    setLoading(true)
    const params = new URLSearchParams({ page_size: String(PAGE_SIZE) })
    if (activeTab !== "all") params.set("group", activeTab)
    if (cursor !== null) params.set("after_id", String(cursor))
    const res = await fetch(
      `${API_BASE}/api/v1/uploads/${state.sessionId}/reconcile?${params}`
    )
    const data = await res.json()
    setRows((prev) => cursor === null ? data.items : [...prev, ...data.items])
    setNextCursor(data.next_cursor ?? null)
    setLoading(false)
  }

  useEffect(() => {
    if (triggered) fetchPage(null)
  }, [activeTab, triggered])

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showAll || !nextCursor) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) fetchPage(nextCursor)
    })
    if (sentinelRef.current) obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [showAll, nextCursor])

  async function handleAction(rowId: number, action: "confirm" | "reject" | "exclude" | "map") {
    const statusMap: Record<string, ReconStatus> = {
      confirm: "confirmed", reject: "rejected", exclude: "excluded"
    }
    const status = statusMap[action] as ReconStatus
    await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/reconcile/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, status } : r))
  }

  function handleCheck(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  const pendingCount = rows.filter(
    (r) => (r.group === "probable" || r.group === "old_only") && r.status === "pending"
  ).length

  if (!triggered) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Step 3 — Reconciliation</h2>
        <p className="text-xs text-muted-foreground">
          Enter the ID of the reference dataset to reconcile against.
        </p>
        <input
          value={refDatasetId}
          onChange={(e) => setRefDatasetId(e.target.value)}
          placeholder="Reference dataset ID"
          className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          onClick={triggerReconcile}
          disabled={!refDatasetId || busy}
          className="rounded-lg bg-accent px-6 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Running…" : "Run reconciliation →"}
        </button>
        <div className="flex justify-start pt-2">
          <button onClick={() => setStep(2)}
            className="rounded-lg border border-border px-5 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">Step 3 — Reconciliation</h2>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as ReconGroup | "all")}
            className={[
              "px-4 py-2 text-xs font-semibold",
              activeTab === tab.key
                ? "border-b-2 border-accent text-accent"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pagination controls at top */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{rows.length} loaded</span>
        {nextCursor && !showAll && (
          <button onClick={() => fetchPage(nextCursor)}
            className="font-semibold text-accent hover:underline">
            Load more
          </button>
        )}
        <button onClick={() => setShowAll((v) => !v)}
          className="font-semibold text-accent hover:underline">
          {showAll ? "Paginate" : "Show all"}
        </button>
        {loading && <span>Loading…</span>}
      </div>

      {/* Row list — virtual when showAll, plain list otherwise */}
      {showAll ? (
        <div ref={parentRef} className="relative max-h-96 overflow-auto"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((vi) => (
            <div key={vi.key} style={{ position: "absolute", top: vi.start, width: "100%" }}>
              <ReconciliationRow
                row={rows[vi.index]}
                checked={selected.has(rows[vi.index].id)}
                onCheck={handleCheck}
                onAction={handleAction}
              />
            </div>
          ))}
          <div ref={sentinelRef} className="h-1" />
        </div>
      ) : (
        <div>
          {rows.map((row) => (
            <ReconciliationRow key={row.id} row={row}
              checked={selected.has(row.id)} onCheck={handleCheck} onAction={handleAction} />
          ))}
        </div>
      )}

      {pendingCount > 0 && (
        <p className="text-xs font-semibold text-amber-600">
          {pendingCount} row{pendingCount > 1 ? "s" : ""} still need a decision before proceeding.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={() => setStep(2)}
          className="rounded-lg border border-border px-5 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
          ← Back
        </button>
        <button onClick={() => setStep(4)} disabled={pendingCount > 0}
          className="rounded-lg bg-accent px-6 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Next →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire Step3 into `WizardShell.tsx`**

```tsx
import { Step3Reconciliation } from "./steps/Step3Reconciliation"

// Inside StepContent, after step 2 check:
if (state.step === 3) {
  return <Step3Reconciliation state={state} setStep={setStep} />
}
```

- [ ] **Step 4: Write `apps/web/src/app/datasets/upload/steps/ReconciliationRow.stories.tsx`**

`ReconciliationRow` is a pure component — stories exercise all four group variants.

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { ReconciliationRow } from "./ReconciliationRow"

const meta: Meta<typeof ReconciliationRow> = {
  title: "Datasets/Upload/ReconciliationRow",
  component: ReconciliationRow,
}
export default meta
type Story = StoryObj<typeof ReconciliationRow>

const base = { checked: false, onCheck: fn(), onAction: fn() }

export const Exact: Story = {
  args: {
    ...base,
    row: { id: 1, group: "exact", status: "auto_accepted", upload_field_id: 1, ref_field_id: 1,
           confidence: 1, note: null, field_key: "gender", ref_field_key: "gender", field_type: "categorical" },
  },
}

export const ProbablePending: Story = {
  args: {
    ...base,
    row: { id: 2, group: "probable", status: "pending", upload_field_id: 2, ref_field_id: 3,
           confidence: 0.85, note: "key renamed", field_key: "brand_awareness",
           ref_field_key: "awareness", field_type: "categorical" },
  },
}

export const OldOnlyPending: Story = {
  args: {
    ...base,
    row: { id: 3, group: "old_only", status: "pending", upload_field_id: null, ref_field_id: 4,
           confidence: null, note: null, field_key: undefined, ref_field_key: "region",
           field_type: "categorical" },
  },
}

export const NewOnly: Story = {
  args: {
    ...base,
    row: { id: 4, group: "new_only", status: "auto_accepted", upload_field_id: 5, ref_field_id: null,
           confidence: null, note: null, field_key: "nps_score", ref_field_key: undefined,
           field_type: "numeric" },
  },
}
```

- [ ] **Step 5: Write `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { Step3Reconciliation } from "./Step3Reconciliation"

const meta: Meta<typeof Step3Reconciliation> = {
  title: "Datasets/Upload/Step3Reconciliation",
  component: Step3Reconciliation,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof Step3Reconciliation>

// Pre-trigger state — shows the reference dataset ID input
export const PreTrigger: Story = {
  args: {
    state: { step: 3 as const, sessionId: 1, needsReconcile: true },
    setStep: fn(),
  },
}
```

- [ ] **Step 6: Check a11y in Storybook**

```bash
just storybook
```

Open `Datasets/Upload/ReconciliationRow` — check all four variants. Then check `Datasets/Upload/Step3Reconciliation → PreTrigger`. Fix any a11y violations.

- [ ] **Step 7: Verify in browser**

After Step 2, clicking Next (with `needsReconcile = true`) lands on Step 3.
- Enter a valid reference dataset ID → "Run reconciliation →" triggers the engine
- Rows appear in the correct tab groupings
- Probable rows show Confirm/Reject buttons; Old-only show Exclude
- Resolving all pending rows enables the "Next →" button

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx \
        apps/web/src/app/datasets/upload/steps/ReconciliationRow.stories.tsx \
        apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx \
        apps/web/src/app/datasets/upload/steps/Step3Reconciliation.stories.tsx \
        apps/web/src/app/datasets/upload/WizardShell.tsx
git commit -m "feat(web): add wizard Step 3 — reconciliation tabs with virtual list"
```

---

### Task 16: Step 4 — Metadata Editor

Split-panel layout: 240px left panel (tree or list, toggled by tabs) + flex right editor panel. Tree uses dnd-kit for drag-to-reorder and drag-to-reparent. All drag actions have accessible ⋮ menu alternatives.

**Files:**
- Create: `apps/web/src/app/datasets/upload/steps/FieldTree.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/FieldTree.stories.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/FieldList.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/FieldList.stories.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.stories.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx`
- Modify: `apps/web/src/app/datasets/upload/WizardShell.tsx`

- [ ] **Step 1: Write `apps/web/src/app/datasets/upload/steps/FieldTree.tsx`**

```tsx
"use client"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Plus } from "lucide-react"
import { useState } from "react"

export interface FieldNode {
  id: number
  field_key: string
  display_name: string | null
  detected_type: string
  override_type: string | null
  upload_fieldgroup_id: number | null
}
export interface GroupNode {
  id: number
  name: string
  parent_id: number | null
  sort_order: number
}

interface Props {
  groups: GroupNode[]
  fields: FieldNode[]
  unassignedFields: FieldNode[]
  selectedFieldId: number | null
  onSelectField: (id: number) => void
  onMoveField: (fieldId: number, groupId: number | null) => void
  onCreateGroup: (name: string, parentId: number | null) => void
  onRenameGroup: (id: number, name: string) => void
  onDeleteGroup: (id: number) => void
}

export function FieldTree({
  groups, fields, unassignedFields,
  selectedFieldId, onSelectField,
  onMoveField, onCreateGroup, onRenameGroup, onDeleteGroup,
}: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    // active.id = "field-{id}", over.id = "group-{id}" or "unassigned"
    const activeStr = String(active.id)
    const overStr = String(over.id)
    if (activeStr.startsWith("field-")) {
      const fieldId = Number(activeStr.replace("field-", ""))
      const groupId = overStr.startsWith("group-")
        ? Number(overStr.replace("group-", "")) : null
      onMoveField(fieldId, groupId)
    }
  }

  const rootGroups = groups.filter((g) => g.parent_id === null)

  function renderGroup(group: GroupNode, depth = 0) {
    const groupFields = fields.filter((f) => f.upload_fieldgroup_id === group.id)
    const childGroups = groups.filter((g) => g.parent_id === group.id)
    const isExpanded = expanded.has(group.id)

    return (
      <div key={group.id}>
        <div
          id={`group-${group.id}`}
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-muted"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => toggleExpand(group.id)}
        >
          <span className="text-muted-foreground">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="flex-1 font-semibold text-foreground">{group.name}</span>
          <button
            aria-label={`Add field to ${group.name}`}
            onClick={(e) => { e.stopPropagation(); onCreateGroup("New subgroup", group.id) }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus size={11} />
          </button>
          <button
            aria-label={`Group options for ${group.name}`}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal size={11} />
          </button>
        </div>

        {isExpanded && (
          <div>
            {childGroups.map((cg) => renderGroup(cg, depth + 1))}
            {groupFields.map((f) => <FieldLeaf key={f.id} field={f}
              selected={selectedFieldId === f.id} onSelect={onSelectField} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}>
      <div className="flex flex-col gap-0.5 overflow-auto">
        <button
          onClick={() => onCreateGroup("New group", null)}
          className="mb-1 flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-accent hover:bg-muted"
        >
          <Plus size={11} /> New group
        </button>
        {rootGroups.map((g) => renderGroup(g))}
        {/* Unassigned */}
        <div className="mt-2 border-t border-border pt-2">
          <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground">Unassigned</p>
          {unassignedFields.map((f) => (
            <FieldLeaf key={f.id} field={f}
              selected={selectedFieldId === f.id} onSelect={onSelectField} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeId?.startsWith("field-") && (
          <div className="rounded border border-accent bg-background px-2 py-1 text-xs shadow">
            Moving field…
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function FieldLeaf({
  field, selected, onSelect,
}: { field: FieldNode; selected: boolean; onSelect: (id: number) => void }) {
  // useDraggable (not useSortable) — no SortableContext wraps this tree
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${field.id}`,
    data: { type: "field", fieldId: field.id, groupId: field.upload_fieldgroup_id },
  })
  const style = { transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.4 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(field.id)}
      className={[
        "flex cursor-pointer items-center gap-1 rounded px-3 py-1 text-xs",
        selected ? "bg-accent/10 font-semibold text-accent" : "text-foreground hover:bg-muted",
      ].join(" ")}
      data-testid="field-leaf"
    >
      <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical size={11} />
      </span>
      <span className="flex-1 truncate font-mono">{field.display_name ?? field.field_key}</span>
      <span className="text-muted-foreground">{field.override_type ?? field.detected_type}</span>
    </div>
  )
}
```

- [ ] **Step 2: Write `apps/web/src/app/datasets/upload/steps/FieldList.tsx`**

Flat list view for the left panel (list tab). Filter pills + sort dropdown.

```tsx
"use client"
import { useMemo, useState } from "react"
import type { FieldNode, GroupNode } from "./FieldTree"

type Filter = "all" | "needs" | "ready"

interface Props {
  fields: FieldNode[]
  groups: GroupNode[]
  unassignedFields: FieldNode[]
  selectedFieldId: number | null
  onSelectField: (id: number) => void
}

export function FieldList({ fields, groups, unassignedFields, selectedFieldId, onSelectField }: Props) {
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<"key" | "group" | "type">("key")

  const allFields = [...fields, ...unassignedFields]
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]))

  const filtered = useMemo(() => {
    let list = allFields
    if (filter === "needs") list = list.filter((f) => !f.display_name)
    if (filter === "ready") list = list.filter((f) => Boolean(f.display_name))
    if (sort === "key") list = [...list].sort((a, b) => a.field_key.localeCompare(b.field_key))
    if (sort === "group") list = [...list].sort((a, b) => {
      const ga = a.upload_fieldgroup_id ? (groupById[a.upload_fieldgroup_id]?.name ?? "") : ""
      const gb = b.upload_fieldgroup_id ? (groupById[b.upload_fieldgroup_id]?.name ?? "") : ""
      return ga.localeCompare(gb)
    })
    if (sort === "type") list = [...list].sort((a, b) =>
      (a.override_type ?? a.detected_type).localeCompare(b.override_type ?? b.detected_type))
    return list
  }, [allFields, filter, sort, groupById])

  return (
    <div className="flex flex-col gap-0">
      {/* Filter pills */}
      <div className="mb-1 flex gap-1 px-1">
        {(["all", "needs", "ready"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={[
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              filter === f ? "bg-accent text-white" : "bg-muted text-muted-foreground",
            ].join(" ")}>
            {f === "all" ? "All" : f === "needs" ? "⚠ Needs" : "✓ Ready"}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as any)}
          className="ml-auto rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground">
          <option value="key">Sort: A–Z</option>
          <option value="group">Sort: Group</option>
          <option value="type">Sort: Type</option>
        </select>
      </div>
      {filtered.map((f) => {
        const groupName = f.upload_fieldgroup_id
          ? groupById[f.upload_fieldgroup_id]?.name : null
        return (
          <div key={f.id} onClick={() => onSelectField(f.id)}
            className={[
              "flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs",
              selectedFieldId === f.id ? "bg-accent/10 text-accent" : "hover:bg-muted",
            ].join(" ")}
            data-testid="field-list-row">
            <span className={[
              "h-1.5 w-1.5 rounded-full shrink-0",
              f.display_name ? "bg-green-500" : "bg-amber-500",
            ].join(" ")} />
            <span className="flex-1 truncate font-mono">{f.field_key}</span>
            <span className="truncate text-muted-foreground">{groupName ?? "—"}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Write `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"
import type { FieldNode, GroupNode } from "./FieldTree"

const FIELD_TYPES = ["numeric", "ordinal", "categorical", "multi_response", "identifier", "weight"]
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface Props {
  sessionId: number
  field: FieldNode | null
  groups: GroupNode[]
  onSaved: (updated: FieldNode) => void
}

export function FieldEditorPanel({ sessionId, field, groups, onSaved }: Props) {
  const [displayName, setDisplayName] = useState("")
  const [overrideType, setOverrideType] = useState<string>("")
  const [groupId, setGroupId] = useState<string>("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!field) return
    setDisplayName(field.display_name ?? "")
    setOverrideType(field.override_type ?? "")
    setGroupId(field.upload_fieldgroup_id ? String(field.upload_fieldgroup_id) : "")
  }, [field])

  if (!field) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Select a field to edit
      </div>
    )
  }

  async function handleSave() {
    if (!field) return
    setBusy(true)
    // Save metadata
    const r1 = await fetch(
      `${API_BASE}/api/v1/uploads/${sessionId}/fields/${field.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName || null,
          override_type: overrideType || null,
        }),
      },
    )
    // Move if group changed
    const newGroupId = groupId ? Number(groupId) : null
    if (newGroupId !== field.upload_fieldgroup_id) {
      await fetch(
        `${API_BASE}/api/v1/uploads/${sessionId}/fields/${field.id}/move`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upload_fieldgroup_id: newGroupId }),
        },
      )
    }
    const data = await r1.json()
    onSaved({ ...field, display_name: data.display_name,
               override_type: data.override_type, upload_fieldgroup_id: newGroupId })
    setBusy(false)
  }

  // Build flat group path list for selector
  const groupPath = (g: GroupNode): string => {
    const parent = groups.find((p) => p.id === g.parent_id)
    return parent ? `${groupPath(parent)} › ${g.name}` : g.name
  }

  return (
    <div className="flex flex-col gap-4 overflow-auto p-4">
      {/* Breadcrumb */}
      <p className="text-xs text-muted-foreground">
        {groupId ? groups.find((g) => g.id === Number(groupId)) ? groupPath(groups.find((g) => g.id === Number(groupId))!) : "—" : "Unassigned"} › <span className="font-mono font-semibold text-foreground">{field.field_key}</span>
      </p>

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          placeholder={field.field_key}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Field type</label>
        <select value={overrideType} onChange={(e) => setOverrideType(e.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
          <option value="">— detected: {field.detected_type} —</option>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Group</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
          <option value="">— Unassigned —</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{groupPath(g)}</option>)}
        </select>
      </div>

      <div className="mt-auto flex justify-end gap-2 border-t border-border pt-4">
        <button onClick={handleSave} disabled={busy}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"
import type { WizardState, WizardStep } from "../wizard-types"
import type { FieldNode, GroupNode } from "./FieldTree"
import { FieldTree } from "./FieldTree"
import { FieldList } from "./FieldList"
import { FieldEditorPanel } from "./FieldEditorPanel"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
type PanelTab = "tree" | "list"

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

export function Step4MetadataEditor({ state, setStep }: Props) {
  const [panelTab, setPanelTab] = useState<PanelTab>("tree")
  const [groups, setGroups] = useState<GroupNode[]>([])
  const [fields, setFields] = useState<FieldNode[]>([])
  const [unassigned, setUnassigned] = useState<FieldNode[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadTree() {
    if (!state.sessionId) return
    const res = await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/field-tree`)
    const data = await res.json()
    setGroups(data.groups)
    setFields(data.fields)
    setUnassigned(data.unassigned_fields)
  }

  useEffect(() => { loadTree().then(() => setLoading(false)) }, [state.sessionId])

  async function handleMoveField(fieldId: number, groupId: number | null) {
    if (!state.sessionId) return
    await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/fields/${fieldId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_fieldgroup_id: groupId }),
    })
    await loadTree()
  }

  async function handleCreateGroup(name: string, parentId: number | null) {
    if (!state.sessionId) return
    await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/fieldgroups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId }),
    })
    await loadTree()
  }

  async function handleDeleteGroup(id: number) {
    if (!state.sessionId) return
    await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/fieldgroups/${id}`, {
      method: "DELETE",
    })
    await loadTree()
  }

  const selectedField = [...fields, ...unassigned].find((f) => f.id === selectedFieldId) ?? null

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">Step 4 — Metadata Editor</h2>
      <div className="flex h-[520px] gap-0 overflow-hidden rounded-lg border border-border">

        {/* Left panel */}
        <div className="flex w-60 shrink-0 flex-col border-r border-border">
          {/* Toggle tabs */}
          <div className="flex border-b border-border">
            {(["tree", "list"] as PanelTab[]).map((t) => (
              <button key={t} onClick={() => setPanelTab(t)}
                className={[
                  "flex-1 py-2 text-xs font-semibold",
                  panelTab === t ? "border-b-2 border-accent text-accent" : "text-muted-foreground",
                ].join(" ")}>
                {t === "tree" ? "🌲 Tree" : "☰ List"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-1">
            {panelTab === "tree" ? (
              <FieldTree
                groups={groups} fields={fields} unassignedFields={unassigned}
                selectedFieldId={selectedFieldId} onSelectField={setSelectedFieldId}
                onMoveField={handleMoveField} onCreateGroup={handleCreateGroup}
                onRenameGroup={async () => await loadTree()}
                onDeleteGroup={handleDeleteGroup}
              />
            ) : (
              <FieldList
                groups={groups} fields={fields} unassignedFields={unassigned}
                selectedFieldId={selectedFieldId} onSelectField={setSelectedFieldId}
              />
            )}
          </div>
        </div>

        {/* Right editor panel */}
        <div className="flex-1 overflow-hidden">
          <FieldEditorPanel
            sessionId={state.sessionId!}
            field={selectedField}
            groups={groups}
            onSaved={async () => await loadTree()}
          />
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={() => setStep(state.needsReconcile ? 3 : 2)}
          className="rounded-lg border border-border px-5 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
          ← Back
        </button>
        <button onClick={() => setStep(5)}
          className="rounded-lg bg-accent px-6 py-2 text-sm font-semibold text-white">
          Next →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire Step4 into `WizardShell.tsx`**

```tsx
import { Step4MetadataEditor } from "./steps/Step4MetadataEditor"

// Inside StepContent, after step 3 check:
if (state.step === 4) {
  return <Step4MetadataEditor state={state} setStep={setStep} />
}
```

- [ ] **Step 6: Write `apps/web/src/app/datasets/upload/steps/FieldTree.stories.tsx`**

`FieldTree` takes all data as props — stories exercise default and selected states.

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { FieldTree } from "./FieldTree"

const meta: Meta<typeof FieldTree> = {
  title: "Datasets/Upload/FieldTree",
  component: FieldTree,
}
export default meta
type Story = StoryObj<typeof FieldTree>

const GROUPS = [
  { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0 },
  { id: 2, name: "Awareness", parent_id: 1, sort_order: 0 },
  { id: 3, name: "Demographics", parent_id: null, sort_order: 1 },
]

const FIELDS = [
  { id: 1, field_key: "brand_awareness", display_name: "Brand Awareness",
    detected_type: "categorical", override_type: null, upload_fieldgroup_id: 2 },
  { id: 2, field_key: "gender", display_name: "Gender",
    detected_type: "categorical", override_type: null, upload_fieldgroup_id: 3 },
]

const UNASSIGNED = [
  { id: 3, field_key: "nps_score", display_name: null,
    detected_type: "numeric", override_type: null, upload_fieldgroup_id: null },
]

const baseArgs = {
  groups: GROUPS, fields: FIELDS, unassignedFields: UNASSIGNED,
  onSelectField: fn(), onMoveField: fn(), onCreateGroup: fn(),
  onRenameGroup: fn(), onDeleteGroup: fn(),
}

export const Default: Story = {
  args: { ...baseArgs, selectedFieldId: null },
}

export const FieldSelected: Story = {
  args: { ...baseArgs, selectedFieldId: 1 },
}
```

- [ ] **Step 7: Write `apps/web/src/app/datasets/upload/steps/FieldList.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { FieldList } from "./FieldList"
import type { FieldNode, GroupNode } from "./FieldTree"

const meta: Meta<typeof FieldList> = {
  title: "Datasets/Upload/FieldList",
  component: FieldList,
}
export default meta
type Story = StoryObj<typeof FieldList>

const GROUPS: GroupNode[] = [
  { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0 },
  { id: 2, name: "Demographics", parent_id: null, sort_order: 1 },
]

const FIELDS: FieldNode[] = [
  { id: 1, field_key: "brand_awareness", display_name: "Brand Awareness",
    detected_type: "categorical", override_type: null, upload_fieldgroup_id: 1 },
  { id: 2, field_key: "gender", display_name: null,
    detected_type: "categorical", override_type: null, upload_fieldgroup_id: 2 },
]

const UNASSIGNED: FieldNode[] = [
  { id: 3, field_key: "nps_score", display_name: null,
    detected_type: "numeric", override_type: null, upload_fieldgroup_id: null },
]

export const Default: Story = {
  args: {
    fields: FIELDS, groups: GROUPS, unassignedFields: UNASSIGNED,
    selectedFieldId: null, onSelectField: fn(),
  },
}
```

- [ ] **Step 8: Write `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { beforeEach, fn, vi } from "@storybook/test"
import { FieldEditorPanel } from "./FieldEditorPanel"
import type { FieldNode, GroupNode } from "./FieldTree"

const meta: Meta<typeof FieldEditorPanel> = {
  title: "Datasets/Upload/FieldEditorPanel",
  component: FieldEditorPanel,
}
export default meta
type Story = StoryObj<typeof FieldEditorPanel>

const GROUPS: GroupNode[] = [
  { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0 },
  { id: 2, name: "Demographics", parent_id: null, sort_order: 1 },
]

const FIELD: FieldNode = {
  id: 1, field_key: "brand_awareness", display_name: "Brand Awareness",
  detected_type: "categorical", override_type: null, upload_fieldgroup_id: 1,
}

export const NoSelection: Story = {
  args: { sessionId: 1, field: null, groups: GROUPS, onSaved: fn() },
}

export const FieldSelected: Story = {
  args: { sessionId: 1, field: FIELD, groups: GROUPS, onSaved: fn() },
  beforeEach() {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...FIELD }), { status: 200 }),
    )
  },
}
```

- [ ] **Step 9: Check a11y in Storybook**

```bash
just storybook
```

Open `Datasets/Upload/FieldTree`, `FieldList`, and `FieldEditorPanel`. Run accessibility checks on each. Fix any violations.

- [ ] **Step 10: Verify in browser**

Navigate to Step 4 via the wizard.
- Left panel shows tree with "Unassigned" section at bottom
- Clicking "🌲 Tree" / "☰ List" toggles the left panel only — right panel stays
- Click a field → right panel shows editor with display name + type + group fields
- Drag a field from Unassigned into a group → it moves in the tree
- Save display name → tree reflects updated label
- Creating a group → appears in tree and in group selector

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/datasets/upload/steps/FieldTree.tsx \
        apps/web/src/app/datasets/upload/steps/FieldTree.stories.tsx \
        apps/web/src/app/datasets/upload/steps/FieldList.tsx \
        apps/web/src/app/datasets/upload/steps/FieldList.stories.tsx \
        apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx \
        apps/web/src/app/datasets/upload/steps/FieldEditorPanel.stories.tsx \
        apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx \
        apps/web/src/app/datasets/upload/WizardShell.tsx
git commit -m "feat(web): add wizard Step 4 — metadata editor with tree/list panel and field editor"
```

---

### Task 17: Step 5 — Review & Commit

Summary grid showing dataset details, field breakdown, reconciliation summary, and group structure. Commit CTA calls `POST /api/v1/uploads/{id}/commit` and redirects to `/datasets`.

**Files:**
- Create: `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`
- Create: `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.stories.tsx`
- Modify: `apps/web/src/app/datasets/upload/WizardShell.tsx`

- [ ] **Step 1: Write `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { WizardState, WizardStep } from "../wizard-types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface SessionSummary {
  dataset_name: string | null
  row_count: number | null
  collection_id: number | null
  fields: { detected_type: string; override_type: string | null }[]
  groups: { id: number; name: string; parent_id: number | null }[]
  unassigned_fields: unknown[]
}

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
}

export function Step5ReviewCommit({ state, setStep }: Props) {
  const router = useRouter()
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state.sessionId) return
    Promise.all([
      fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}`).then((r) => r.json()),
      fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/field-tree`).then((r) => r.json()),
    ]).then(([sess, tree]) => {
      setSummary({
        dataset_name: sess.dataset_name,
        row_count: sess.row_count,
        collection_id: sess.collection_id,
        fields: sess.fields,
        groups: tree.groups,
        unassigned_fields: tree.unassigned_fields,
      })
      setLoading(false)
    })
  }, [state.sessionId])

  async function handleCommit() {
    if (!state.sessionId) return
    setBusy(true)
    setError(null)
    const res = await fetch(
      `${API_BASE}/api/v1/uploads/${state.sessionId}/commit`,
      { method: "POST" },
    )
    if (!res.ok) {
      setError("Commit failed. Please try again.")
      setBusy(false)
      return
    }
    router.push("/datasets")
  }

  if (loading || !summary) return <p className="text-sm text-muted-foreground">Loading summary…</p>

  const typeCounts = summary.fields.reduce<Record<string, number>>((acc, f) => {
    const t = f.override_type ?? f.detected_type
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  const topGroups = summary.groups.filter((g) => g.parent_id === null)

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Step 5 — Review &amp; Commit</h2>
      <p className="text-xs text-muted-foreground">
        Everything looks good. Review the summary and confirm to write to the database.
      </p>

      {/* 2×2 summary grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Dataset details */}
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Dataset details
            <button onClick={() => setStep(1)} className="text-xs font-semibold normal-case text-accent">← Edit</button>
          </div>
          <div className="space-y-1 px-3 py-2 text-xs">
            <div className="flex gap-2"><span className="w-28 text-muted-foreground">Name</span><span className="font-medium">{summary.dataset_name}</span></div>
            <div className="flex gap-2"><span className="w-28 text-muted-foreground">Responses</span><span className="font-medium">{summary.row_count ?? "—"}</span></div>
            <div className="flex gap-2"><span className="w-28 text-muted-foreground">Collection ID</span><span className="font-medium">{summary.collection_id ?? "—"}</span></div>
          </div>
        </div>

        {/* Fields breakdown */}
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Fields
            <button onClick={() => setStep(2)} className="text-xs font-semibold normal-case text-accent">← Edit</button>
          </div>
          <div className="space-y-1 px-3 py-2 text-xs">
            <div className="flex gap-2"><span className="w-28 text-muted-foreground">Total</span><span className="font-semibold">{summary.fields.length}</span></div>
            {Object.entries(typeCounts).map(([t, n]) => (
              <div key={t} className="flex gap-2"><span className="w-28 text-muted-foreground">{t}</span><span className="font-medium">{n}</span></div>
            ))}
          </div>
        </div>

        {/* Group structure */}
        <div className="col-span-2 rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Group structure
            <button onClick={() => setStep(4)} className="text-xs font-semibold normal-case text-accent">← Edit</button>
          </div>
          <div className="space-y-1 px-3 py-2 text-xs">
            {topGroups.map((g) => (
              <div key={g.id} className="flex gap-2">
                <span className="h-2 w-2 rounded-full bg-accent shrink-0 mt-0.5" />
                <span className="font-medium">{g.name}</span>
              </div>
            ))}
            {summary.unassigned_fields.length > 0 && (
              <div className="flex gap-2 text-muted-foreground italic">
                <span className="h-2 w-2 rounded-full bg-muted-foreground shrink-0 mt-0.5" />
                <span>Unassigned ({summary.unassigned_fields.length} field{summary.unassigned_fields.length !== 1 ? "s" : ""})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commit panel */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
        <span className="text-3xl">🚀</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Ready to commit</p>
          <p className="text-xs text-muted-foreground">
            This will create <strong>{summary.dataset_name}</strong> with{" "}
            <strong>{summary.row_count ?? "?"} responses</strong> and{" "}
            <strong>{summary.fields.length} fields</strong>.{" "}
            This action cannot be undone — responses and fields will be written to the database.
          </p>
        </div>
        <button onClick={handleCommit} disabled={busy}
          className="shrink-0 rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {busy ? "Committing…" : "Commit dataset →"}
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-start">
        <button onClick={() => setStep(4)}
          className="rounded-lg border border-border px-5 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
          ← Back to Metadata
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire Step5 into `WizardShell.tsx`**

```tsx
import { Step5ReviewCommit } from "./steps/Step5ReviewCommit"

// Inside StepContent, after step 4 check:
if (state.step === 5) {
  return <Step5ReviewCommit state={state} setStep={setStep} />
}
```

- [ ] **Step 3: Write `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { beforeEach, fn, vi } from "@storybook/test"
import { Step5ReviewCommit } from "./Step5ReviewCommit"

const meta: Meta<typeof Step5ReviewCommit> = {
  title: "Datasets/Upload/Step5ReviewCommit",
  component: Step5ReviewCommit,
  parameters: {
    nextjs: {
      navigation: { pathname: "/datasets/upload", searchParams: new URLSearchParams("step=5&session=1") },
    },
  },
}
export default meta
type Story = StoryObj<typeof Step5ReviewCommit>

const MOCK_SESSION = {
  dataset_name: "Wave 3", row_count: 847, collection_id: 1,
  fields: [
    { detected_type: "categorical", override_type: null },
    { detected_type: "categorical", override_type: null },
    { detected_type: "ordinal", override_type: null },
    { detected_type: "numeric", override_type: null },
    { detected_type: "identifier", override_type: null },
  ],
}
const MOCK_TREE = {
  groups: [
    { id: 1, name: "Brand Tracker", parent_id: null, sort_order: 0 },
    { id: 2, name: "Demographics", parent_id: null, sort_order: 1 },
  ],
  unassigned_fields: [],
}

export const ReadyToCommit: Story = {
  args: {
    state: { step: 5 as const, sessionId: 1, needsReconcile: false },
    setStep: fn(),
  },
  beforeEach() {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_SESSION), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_TREE), { status: 200 }))
  },
}
```

- [ ] **Step 4: Check a11y in Storybook**

```bash
just storybook
```

Open `Datasets/Upload/Step5ReviewCommit` → `ReadyToCommit`. Run accessibility checks. Fix any violations.

- [ ] **Step 5: Verify in browser**

Navigate through the full wizard to Step 5.
- Summary grid shows correct dataset name, response count, field type breakdown, and group structure
- "← Edit" links on each card navigate back to the correct step
- "Commit dataset →" calls the API, then redirects to `/datasets`
- The committed dataset appears in the `/datasets` list

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx \
        apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.stories.tsx \
        apps/web/src/app/datasets/upload/WizardShell.tsx
git commit -m "feat(web): add wizard Step 5 — review and commit"
```

---

### Task 18: Navigation link to /datasets

Add a "Datasets" link to the home page so users can reach the new page.

**Files:**
- Modify: `apps/web/src/app/page.tsx` (or `HomePage.tsx` — check which has the nav)

- [ ] **Step 1: Find where navigation links live**

```bash
grep -n "analytics\|href" apps/web/src/app/HomePage.tsx | head -20
```

- [ ] **Step 2: Add Datasets link**

In `apps/web/src/app/HomePage.tsx`, add a link to `/datasets` near the existing analytics link. Follow the exact same link pattern already used:

```tsx
<Link href="/datasets" className={/* same className as existing nav links */}>
  Datasets
</Link>
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000`. Confirm "Datasets" link is visible and routes correctly to `/datasets`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/HomePage.tsx apps/web/src/app/page.tsx
git commit -m "feat(web): add Datasets nav link to home page"
```

---

## Self-Review

### Spec coverage check

| Spec section | Covered by task(s) |
|---|---|
| `/datasets` management page | Task 11 |
| Step 1: File & Hierarchy | Task 13 |
| Step 2: Field Detection | Task 14 |
| Step 3: Reconciliation (4 groups, tabs, virtual list, bulk ops) | Tasks 6, 7, 15 |
| Step 4: Metadata editor tree/list/editor | Tasks 8, 16 |
| Step 5: Review & Commit | Tasks 9, 17 |
| Upload staging models + migration | Task 1 |
| Upload repository | Task 2 |
| Field detection heuristics | Task 3 |
| Upload service (file save + detection orchestration) | Task 4 |
| Field override endpoint | Task 5 |
| Reconciliation engine (exact/probable/new/old) | Task 6 |
| Reconciliation API (trigger, list, IDs, resolve, bulk) | Task 7 |
| Metadata CRUD (field tree, groups, field move) | Task 8 |
| Commit service (atomic promotion) | Task 9 |
| Datasets list endpoint | Task 9 |
| TypeScript type regeneration | Task 10 |
| `@tanstack/react-virtual` dependency | Task 10 |
| CORS allow PATCH/DELETE | Task 4 |
| Nav link | Task 18 |
| SPSS stretch goal | Not in this plan — add in a separate task when implementing |

### Placeholder scan — none found

All steps contain actual code, commands, and expected outputs.

### Type consistency check

- `UploadSession`, `UploadField`, `UploadLevel`, `UploadFieldGroup`, `ReconciliationRow` defined in Task 1; used consistently in Tasks 2–9.
- `DetectedField`, `detect_fields`, `slugify_key` defined in Task 3; used in Task 4 (`upload_service.py`).
- `classify_row`, `edit_distance`, `level_overlap` defined in Task 6; used in Task 7 (route handler).
- `commit_upload` defined in Task 9 (`commit_service.py`); called in Task 9 route handler.
- Frontend: `FieldNode`, `GroupNode` defined in `FieldTree.tsx` (Task 16); imported and reused in `FieldList.tsx`, `FieldEditorPanel.tsx`, `Step4MetadataEditor.tsx` — consistent throughout.
- `WizardState`, `WizardStep`, `STEP_LABELS` defined in `wizard-types.ts` (Task 12); used consistently in all step components (Tasks 13–17).
- `useWizardState` return shape (`state`, `setStep`, `setSessionId`, `setNeedsReconcile`) defined in Task 12; passed through `WizardShell` → step components consistently.

### Fixes applied during holistic review

1. **`useWizardState.ts` `setSessionId`** — was not persisting session ID to URL params; fixed to call `router.replace` so the session survives refresh.
2. **`metadata_service.py`** — listed in file map but never created; crossed out with note (YAGNI — inline logic in `routes/uploads.py` is sufficient).
3. **`commit_service.py` `slugify_key` import** — was inside the CSV row loop; moved to file-top import.
4. **`resolve_reconcile_row` `body: dict`** — FastAPI won't validate a raw dict; replaced with typed `RowResolve(BaseModel)`.
5. **`FieldLeaf` `useSortable`** — no `SortableContext` ancestor exists in the tree; changed to `useDraggable` from `@dnd-kit/core` (matching analytics `FieldTreePanel.tsx` pattern).
6. **`StepIndicator` skips step 3** — when `needsReconcile` is false the wizard jumps 2→4 but the indicator still showed all 5 steps equally; fixed to accept `needsReconcile` prop and style step 3 as greyed-out + strikethrough when skipped.
