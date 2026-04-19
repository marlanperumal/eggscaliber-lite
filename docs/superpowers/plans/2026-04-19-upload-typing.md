# Upload API Typing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all bare `dict` returns in the upload service/routes with typed Pydantic/SQLModel response models, propagate those types through `api.d.ts` to remove every `as any` cast in the upload wizard, and update patterns docs to prevent recurrence.

**Architecture:** New response schemas are added to `models/upload.py` and `models/reconciliation.py`. The service layer is updated to return model instances instead of dicts. Routes gain `response_model=`. After Python types are correct, `just generate-types` regenerates `api.d.ts`, then frontend `as any` casts are replaced with proper type access.

**Tech Stack:** Python 3.13, SQLModel, FastAPI, TypeScript, openapi-fetch, openapi-typescript

---

## File Map

**Create nothing new.** All changes are additions to existing files.

| File | Change |
|------|--------|
| `apps/api/src/models/upload.py` | Add 14 response schema classes |
| `apps/api/src/models/reconciliation.py` | Add 7 response schema classes + `ReconciliationRowCreate` input model |
| `apps/api/src/models/collection.py` | Move `InconsistencyType` enum here; use it in `InconsistencyOut` |
| `apps/api/src/repositories/upload_repo.py` | Replace 4× `**kwargs` with typed params; tighten `get_collection_meta` return type |
| `apps/api/src/repositories/reconciliation_repo.py` | Replace `**kwargs` in `create_row`; type `bulk_create_rows` to accept `list[ReconciliationRowCreate]` |
| `apps/api/src/services/upload_service.py` | Add `list_upload_sessions`; all `-> dict` → typed models; fix `Any` params; add return type to `upsert_level` |
| `apps/api/src/services/collection_service.py` | Import `InconsistencyType` from models instead of defining it locally |
| `apps/api/src/repositories/collection_repo.py` | `collection_type: str` → `CollectionType` |
| `apps/api/src/services/dataset_service.py` | Fix `get_csv_data` return type annotation |
| `apps/api/src/errors.py` | Remove dead `UploadSessionConflictError` |
| `apps/api/src/routes/uploads.py` | Add `response_model=` to all routes; call `upload_service.list_upload_sessions` |
| `packages/shared/api.d.ts` | Regenerated — do not edit manually |
| `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx` | Remove `as any` casts |
| `apps/web/src/app/datasets/upload/steps/Step2FieldDetection.tsx` | Remove `as any`; use generated `FieldType` in local interface |
| `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx` | Remove `as any` casts |
| `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx` | Remove `as any` casts |
| `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx` | Remove `as any` casts |
| `apps/web/src/app/analytics/analytics-types.ts` | `AnalyticsResult` → discriminated union of generated `CrosstabResponse \| TrendResponse` |
| `apps/web/src/app/analytics/useAnalyticsState.ts` | Fix `as FilterSpec[]` parser; fix `rows`/`cols` type mismatch |
| `docs/patterns/backend.md` | Add rule: no `dict` returns from services; no `**kwargs` in repos |
| `docs/patterns.md` | Add checklist pointer to the new backend rule |

---

### Task 1: Add upload response schemas to `models/upload.py`

**Files:**
- Modify: `apps/api/src/models/upload.py`

No tests needed — pure model additions; they're exercised by the service tests in later tasks.

- [ ] **Step 1: Add schemas to `models/upload.py`**

Append after the existing `UploadLevelRead` class at the end of the file:

```python
# ---------------------------------------------------------------------------
# API response schemas (not ORM table models)
# ---------------------------------------------------------------------------

class UploadFieldOut(SQLModel):
    id: int
    field_key: str
    detected_type: FieldType
    override_type: FieldType | None = None
    display_name: str | None = None
    sort_order: int
    upload_fieldgroup_id: int | None = None
    confidence: str
    value_sample: list[Any]


class UploadCreatedResponse(SQLModel):
    id: int
    status: UploadSessionStatus
    dataset_name: str | None
    collection_id: int | None
    row_count: int | None
    fields: list[UploadFieldOut]


class UploadSessionListItem(SQLModel):
    id: int
    status: UploadSessionStatus
    dataset_name: str | None
    collection_name: str | None
    package_name: str | None
    collected_at: str | None
    created_at: str


class UploadSessionListResponse(SQLModel):
    items: list[UploadSessionListItem]


class UploadSessionDetail(SQLModel):
    id: int
    status: UploadSessionStatus
    dataset_name: str | None
    collection_id: int | None
    collection_name: str | None
    package_name: str | None
    collected_at: str | None
    file_name: str | None
    row_count: int | None
    fields: list[UploadFieldOut]


class UploadFieldOverrideOut(SQLModel):
    id: int
    field_key: str
    detected_type: FieldType
    override_type: FieldType | None
    display_name: str | None
    sort_order: int
    upload_fieldgroup_id: int | None


class FieldMoveOut(SQLModel):
    id: int
    upload_fieldgroup_id: int | None


class UploadLevelOut(SQLModel):
    id: int
    raw_value: str
    display_label: str | None
    sort_order: int
    is_inherited: bool


class FieldTreeFieldOut(SQLModel):
    id: int
    field_key: str
    display_name: str | None
    detected_type: FieldType
    override_type: FieldType | None
    sort_order: int
    upload_fieldgroup_id: int | None
    levels: list[UploadLevelOut]


class FieldGroupOut(SQLModel):
    id: int
    name: str
    parent_id: int | None
    sort_order: int
    field_count: int = 0


class FieldTreeOut(SQLModel):
    groups: list[FieldGroupOut]
    fields: list[FieldTreeFieldOut]
    unassigned_fields: list[FieldTreeFieldOut]


class FieldGroupDetail(SQLModel):
    id: int
    name: str
    parent_id: int | None
    sort_order: int


class DeletedOut(SQLModel):
    deleted: int


class CommitOut(SQLModel):
    dataset_id: int


class SuggestedReferenceOut(SQLModel):
    dataset_id: int | None
    dataset_name: str | None
```

- [ ] **Step 2: Verify Python import is valid**

```bash
just typecheck
```

Expected: any errors are unrelated to the new models (no `NameError` or `ImportError` on upload models).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/models/upload.py
```

Write to `/tmp/commit-msg.txt`:
```
feat(api): add typed response schemas to models/upload.py
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 2: Add reconciliation response schemas to `models/reconciliation.py`

**Files:**
- Modify: `apps/api/src/models/reconciliation.py`

- [ ] **Step 1: Update `models/reconciliation.py`**

Add at the top, after existing imports:

```python
from src.models.field import FieldType
```

Then append after `ReconciliationRowRead`:

```python
# ---------------------------------------------------------------------------
# Input schema (replaces list[dict] in bulk_create_rows)
# ---------------------------------------------------------------------------

class ReconciliationRowCreate(SQLModel):
    upload_session_id: int
    upload_field_id: int | None
    ref_field_id: int | None
    group: ReconciliationGroup
    status: ReconciliationStatus
    confidence: float | None
    note: str | None


# ---------------------------------------------------------------------------
# API response schemas
# ---------------------------------------------------------------------------

class ReconcileTriggerOut(SQLModel):
    total: int


class ReconcileRowOut(SQLModel):
    id: int
    group: ReconciliationGroup
    status: ReconciliationStatus
    upload_field_id: int | None
    ref_field_id: int | None
    field_key: str | None
    field_type: FieldType | None
    ref_field_key: str | None
    confidence: float | None
    note: str | None


class ReconcileRowPage(SQLModel):
    items: list[ReconcileRowOut]
    next_cursor: int | None


class ReconcileIdsOut(SQLModel):
    ids: list[int]


class ReconcileCountsOut(SQLModel):
    exact: int = 0
    probable: int = 0
    new_only: int = 0
    old_only: int = 0
    status_counts: dict[str, int]
    blocking_pending: int


class ReconcileRowResolvedOut(SQLModel):
    id: int
    status: ReconciliationStatus
    upload_field_id: int | None
    ref_field_id: int | None


class BulkResolvedOut(SQLModel):
    resolved: int
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/models/reconciliation.py
```

Write to `/tmp/commit-msg.txt`:
```
feat(api): add typed response schemas and ReconciliationRowCreate to models/reconciliation.py
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 3: Fix `InconsistencyType` — move from service into models

`InconsistencyType` is currently defined in `services/collection_service.py` but is used in `models/collection.py`'s `InconsistencyOut`. Types used in models must live in models to avoid circular imports.

**Files:**
- Modify: `apps/api/src/models/collection.py`
- Modify: `apps/api/src/services/collection_service.py`

- [ ] **Step 1: Add `InconsistencyType` enum to `models/collection.py`**

In `models/collection.py`, add `StrEnum` to the imports from stdlib, then add the enum before `InconsistencyOut`:

```python
# After existing imports add:
from enum import StrEnum

# Add before InconsistencyOut:
class InconsistencyType(StrEnum):
    missing_field = "missing_field"
    type_mismatch = "type_mismatch"
    level_added = "level_added"
    level_removed = "level_removed"


class InconsistencyOut(SQLModel):
    field_key: str
    inconsistency_type: InconsistencyType  # was: str
    detail: str
```

- [ ] **Step 2: Update `collection_service.py` to import from models**

In `services/collection_service.py`, remove the local `InconsistencyType` definition and import it from models instead:

```python
# Add to existing model imports:
from src.models.collection import CollectionWithDatasets, InconsistencyOut, InconsistencyType
```

Then delete the local `class InconsistencyType(StrEnum): ...` block (lines ~18–23).

- [ ] **Step 3: Run tests**

```bash
just test-api
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/models/collection.py apps/api/src/services/collection_service.py
```

Write to `/tmp/commit-msg.txt`:
```
fix(api): move InconsistencyType enum from service into models/collection.py
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 4: Fix repository signatures — `upload_repo.py`

Replace the four `**kwargs` constructor functions with explicit typed parameters. This makes every call site type-checkable.

**Files:**
- Modify: `apps/api/src/repositories/upload_repo.py`

- [ ] **Step 1: Replace `create_session`**

```python
async def create_session(
    session: AsyncSession,
    *,
    file_path: str,
    dataset_name: str | None,
    collection_id: int | None,
    collected_at: date | None,
    row_count: int | None,
    status: UploadSessionStatus,
) -> UploadSession:
    obj = UploadSession(
        file_path=file_path,
        dataset_name=dataset_name,
        collection_id=collection_id,
        collected_at=collected_at,
        row_count=row_count,
        status=status,
    )
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj
```

Add the `date` import to the top of the file (add `from datetime import date` after the existing imports from `sqlalchemy`).

- [ ] **Step 2: Replace `create_upload_field`**

```python
async def create_upload_field(
    session: AsyncSession,
    *,
    upload_session_id: int,
    field_key: str,
    detected_type: FieldType,
    sort_order: int,
    confidence: str,
    value_sample: list[Any] | None,
) -> UploadField:
    obj = UploadField(
        upload_session_id=upload_session_id,
        field_key=field_key,
        detected_type=detected_type,
        sort_order=sort_order,
        confidence=confidence,
        value_sample=value_sample,
    )
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj
```

Add `from typing import Any` to the imports (it may already be present — check first).
Also add `from src.models.field import FieldType` to the imports.

- [ ] **Step 3: Replace `create_upload_level`**

```python
async def create_upload_level(
    session: AsyncSession,
    *,
    upload_field_id: int,
    raw_value: str,
    display_label: str,
    sort_order: int,
) -> UploadLevel:
    obj = UploadLevel(
        upload_field_id=upload_field_id,
        raw_value=raw_value,
        display_label=display_label,
        sort_order=sort_order,
    )
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj
```

- [ ] **Step 4: Replace `create_upload_fieldgroup`**

```python
async def create_upload_fieldgroup(
    session: AsyncSession,
    *,
    upload_session_id: int,
    name: str,
    parent_id: int | None,
    sort_order: int,
) -> UploadFieldGroup:
    obj = UploadFieldGroup(
        upload_session_id=upload_session_id,
        name=name,
        parent_id=parent_id,
        sort_order=sort_order,
    )
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj
```

- [ ] **Step 5: Tighten `get_collection_meta` return type**

Change the signature from `-> dict | None` to `-> dict[str, str | None] | None`.

- [ ] **Step 6: Run tests**

```bash
just test-api
```

Expected: all tests pass. The call sites in `upload_service.py` already use keyword arguments that match the new signatures.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/repositories/upload_repo.py
```

Write to `/tmp/commit-msg.txt`:
```
fix(api): replace **kwargs constructors with typed params in upload_repo
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 5: Fix repository signatures — `reconciliation_repo.py`

**Files:**
- Modify: `apps/api/src/repositories/reconciliation_repo.py`

- [ ] **Step 1: Add import for `ReconciliationRowCreate`**

At the top of `reconciliation_repo.py`, update the import from `src.models.reconciliation`:

```python
from src.models.reconciliation import (
    ReconciliationGroup,
    ReconciliationRow,
    ReconciliationRowCreate,
    ReconciliationStatus,
)
```

- [ ] **Step 2: Replace `create_row`**

```python
async def create_row(
    session: AsyncSession,
    *,
    upload_session_id: int,
    upload_field_id: int | None,
    ref_field_id: int | None,
    group: ReconciliationGroup,
    status: ReconciliationStatus,
    confidence: float | None,
    note: str | None,
) -> ReconciliationRow:
    obj = ReconciliationRow(
        upload_session_id=upload_session_id,
        upload_field_id=upload_field_id,
        ref_field_id=ref_field_id,
        group=group,
        status=status,
        confidence=confidence,
        note=note,
    )
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj
```

- [ ] **Step 3: Update `bulk_create_rows`**

```python
async def bulk_create_rows(
    session: AsyncSession, rows: list[ReconciliationRowCreate]
) -> list[ReconciliationRow]:
    objs = [ReconciliationRow(**r.model_dump()) for r in rows]
    session.add_all(objs)
    await session.flush()
    return objs
```

- [ ] **Step 4: Run tests**

```bash
just test-api
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repositories/reconciliation_repo.py
```

Write to `/tmp/commit-msg.txt`:
```
fix(api): replace **kwargs and list[dict] with typed params in reconciliation_repo
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 6: Fix `collection_repo.py` and `dataset_service.py` minor typing

**Files:**
- Modify: `apps/api/src/repositories/collection_repo.py`
- Modify: `apps/api/src/services/dataset_service.py`
- Modify: `apps/api/src/errors.py`

- [ ] **Step 1: Fix `collection_type` parameter in `collection_repo.create_collection`**

In `collection_repo.py`, add the import:

```python
from src.models.collection import Collection, CollectionType
```

Change the function signature from:

```python
async def create_collection(
    ...
    collection_type: str = "generic",
```

to:

```python
async def create_collection(
    ...
    collection_type: CollectionType = CollectionType.generic,
```

- [ ] **Step 2: Fix `get_csv_data` return type in `dataset_service.py`**

Find the function `get_csv_data` (around line 34). Change:

```python
async def get_csv_data(session: AsyncSession, dataset_id: int) -> tuple[list[str], list]:
```

to:

```python
async def get_csv_data(session: AsyncSession, dataset_id: int) -> tuple[list[str], list[Response]]:
```

Ensure `Response` is imported at the top of the file — look for `from src.models.response import Response` or similar. If `Response` is the ORM model imported under an alias, use that alias.

- [ ] **Step 3: Remove dead `UploadSessionConflictError`**

In `apps/api/src/errors.py`, remove the line:

```python
class UploadSessionConflictError(DomainError): ...
```

It is defined but never raised or caught anywhere.

- [ ] **Step 4: Run tests**

```bash
just test-api
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repositories/collection_repo.py apps/api/src/services/dataset_service.py apps/api/src/errors.py
```

Write to `/tmp/commit-msg.txt`:
```
fix(api): tighten collection_type enum, dataset_service return type, remove dead error class
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 7: Rewrite `upload_service.py` — typed returns

This is the central task. Every `-> dict` return is replaced with the corresponding typed model from Tasks 1–2. The logic does not change — only the return type and how the return value is constructed.

**Files:**
- Modify: `apps/api/src/services/upload_service.py`

- [ ] **Step 1: Update imports in `upload_service.py`**

Replace the existing import block (keep all existing imports, add new ones):

```python
from typing import cast

from src.models.upload import (
    UploadCreatedResponse,
    UploadFieldOut,
    UploadFieldOverrideOut,
    UploadLevelOut,
    UploadSessionDetail,
    UploadSessionListItem,
    UploadSessionListResponse,
    UploadSessionStatus,
    FieldGroupDetail,
    FieldGroupOut,
    FieldMoveOut,
    FieldTreeFieldOut,
    FieldTreeOut,
    DeletedOut,
    CommitOut,
    SuggestedReferenceOut,
)
from src.models.reconciliation import (
    BulkResolvedOut,
    ReconcileCountsOut,
    ReconcileIdsOut,
    ReconcileRowOut,
    ReconcileRowPage,
    ReconcileRowResolvedOut,
    ReconcileRowCreate,
    ReconcileTriggerOut,
)
```

Remove `from typing import Any` — it's no longer needed after fixing `override_field`.

- [ ] **Step 2: Update `create_upload_session` return type and body**

Change signature:

```python
async def create_upload_session(
    session: AsyncSession,
    *,
    filename: str,
    content: bytes,
    content_type: str,
    dataset_name: str,
    collection_id: int | None = None,
    collected_at: date | None = None,
) -> UploadCreatedResponse:
```

Replace the `field_records` list construction and final `return` with:

```python
    field_records: list[UploadFieldOut] = []
    for i, det in enumerate(detected):
        uf = await upload_repo.create_upload_field(
            session,
            upload_session_id=cast(int, sess.id),
            field_key=det.field_key,
            detected_type=det.detected_type,
            sort_order=i,
            confidence=det.confidence,
            value_sample=det.distinct_values[:5] if det.distinct_values else None,
        )
        if det.detected_type in (FieldType.ordinal, FieldType.categorical):
            for j, val in enumerate(det.distinct_values[:100]):
                await upload_repo.create_upload_level(
                    session,
                    upload_field_id=cast(int, uf.id),
                    raw_value=val,
                    display_label=val,
                    sort_order=j,
                )
        field_records.append(
            UploadFieldOut(
                id=cast(int, uf.id),
                field_key=uf.field_key,
                detected_type=uf.detected_type,
                override_type=None,
                sort_order=uf.sort_order,
                confidence=uf.confidence,
                value_sample=uf.value_sample or [],
            )
        )

    return UploadCreatedResponse(
        id=cast(int, sess.id),
        status=sess.status,
        dataset_name=sess.dataset_name,
        collection_id=sess.collection_id,
        row_count=sess.row_count,
        fields=field_records,
    )
```

- [ ] **Step 3: Add `list_upload_sessions` service function**

The list route currently has business logic inline (fetches collection meta per session). Move it to the service. Add this function after `get_upload_session`:

```python
async def list_upload_sessions(session: AsyncSession) -> UploadSessionListResponse:
    """Returns all non-committed, non-abandoned upload sessions."""
    sessions = await upload_repo.list_draft_sessions(session)
    items: list[UploadSessionListItem] = []
    for sess in sessions:
        meta: dict[str, str | None] = {}
        if sess.collection_id:
            meta = await upload_repo.get_collection_meta(session, sess.collection_id) or {}
        items.append(
            UploadSessionListItem(
                id=cast(int, sess.id),
                status=sess.status,
                dataset_name=sess.dataset_name,
                collection_name=meta.get("collection_name"),
                package_name=meta.get("package_name"),
                collected_at=sess.collected_at.isoformat() if sess.collected_at else None,
                created_at=sess.created_at.isoformat(),
            )
        )
    return UploadSessionListResponse(items=items)
```

- [ ] **Step 4: Update `get_upload_session`**

Change signature and body:

```python
async def get_upload_session(session: AsyncSession, session_id: int) -> UploadSessionDetail:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)
    field_list = [
        UploadFieldOut(
            id=cast(int, f.id),
            field_key=f.field_key,
            detected_type=f.detected_type,
            override_type=f.override_type,
            display_name=f.display_name,
            sort_order=f.sort_order,
            upload_fieldgroup_id=f.upload_fieldgroup_id,
            confidence=f.confidence,
            value_sample=f.value_sample or [],
        )
        for f in fields
    ]
    collection_meta: dict[str, str | None] = {}
    if sess.collection_id:
        collection_meta = await upload_repo.get_collection_meta(session, sess.collection_id) or {}
    return UploadSessionDetail(
        id=cast(int, sess.id),
        status=sess.status,
        dataset_name=sess.dataset_name,
        collection_id=sess.collection_id,
        collection_name=collection_meta.get("collection_name"),
        package_name=collection_meta.get("package_name"),
        collected_at=sess.collected_at.isoformat() if sess.collected_at else None,
        file_name=os.path.basename(sess.file_path).split("_", 2)[-1],
        row_count=sess.row_count,
        fields=field_list,
    )
```

- [ ] **Step 5: Update `get_suggested_reference`**

```python
async def get_suggested_reference(session: AsyncSession, session_id: int) -> SuggestedReferenceOut:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    if sess.collection_id is None:
        return SuggestedReferenceOut(dataset_id=None, dataset_name=None)
    ds = await dataset_repo.get_latest_for_collection(session, sess.collection_id)
    if ds is None:
        return SuggestedReferenceOut(dataset_id=None, dataset_name=None)
    return SuggestedReferenceOut(dataset_id=cast(int, ds.id), dataset_name=ds.name)
```

- [ ] **Step 6: Update `override_field`**

Fix signature (remove `Any`) and return type:

```python
async def override_field(
    session: AsyncSession,
    session_id: int,
    field_id: int,
    *,
    override_type: FieldType | None,
    display_name: str | None,
    upload_fieldgroup_id: int | None,
    sort_order: int | None,
    fieldgroup_id_set: bool,
) -> UploadFieldOverrideOut:
    """Raises UploadSessionNotFoundError / FieldNotFoundError as appropriate."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    if override_type is not None:
        f.override_type = override_type
    if display_name is not None:
        f.display_name = display_name
    if fieldgroup_id_set:
        f.upload_fieldgroup_id = upload_fieldgroup_id
    if sort_order is not None:
        f.sort_order = sort_order
    session.add(f)
    await session.flush()
    return UploadFieldOverrideOut(
        id=cast(int, f.id),
        field_key=f.field_key,
        detected_type=f.detected_type,
        override_type=f.override_type,
        display_name=f.display_name,
        sort_order=f.sort_order,
        upload_fieldgroup_id=f.upload_fieldgroup_id,
    )
```

- [ ] **Step 7: Update `move_field`**

```python
async def move_field(
    session: AsyncSession, session_id: int, field_id: int, group_id: int | None
) -> FieldMoveOut:
    """Raises FieldNotFoundError if field not found or doesn't belong to session."""
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    f.upload_fieldgroup_id = group_id
    session.add(f)
    await session.flush()
    return FieldMoveOut(id=cast(int, f.id), upload_fieldgroup_id=f.upload_fieldgroup_id)
```

- [ ] **Step 8: Update `upsert_level` — add return type**

```python
async def upsert_level(
    session: AsyncSession,
    session_id: int,
    field_id: int,
    *,
    raw_value: str,
    display_label: str | None,
    sort_order: int,
    is_inherited: bool,
) -> UploadLevel:
```

(Import `UploadLevel` is already present in the file.)

- [ ] **Step 9: Update `get_field_tree`**

```python
async def get_field_tree(session: AsyncSession, session_id: int) -> FieldTreeOut:
    """Raises UploadSessionNotFoundError if session not found."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    groups = await upload_repo.get_fieldgroups_for_session(session, session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)

    def _group_out(g: UploadFieldGroup) -> FieldGroupOut:
        field_count = sum(1 for f in fields if f.upload_fieldgroup_id == g.id)
        return FieldGroupOut(
            id=cast(int, g.id),
            name=g.name,
            parent_id=g.parent_id,
            sort_order=g.sort_order,
            field_count=field_count,
        )

    async def _field_out(f: UploadField) -> FieldTreeFieldOut:
        levels = await upload_repo.get_levels_for_field(session, cast(int, f.id))
        return FieldTreeFieldOut(
            id=cast(int, f.id),
            field_key=f.field_key,
            display_name=f.display_name,
            detected_type=f.detected_type,
            override_type=f.override_type,
            sort_order=f.sort_order,
            upload_fieldgroup_id=f.upload_fieldgroup_id,
            levels=[
                UploadLevelOut(
                    id=cast(int, lvl.id),
                    raw_value=lvl.raw_value,
                    display_label=lvl.display_label,
                    sort_order=lvl.sort_order,
                    is_inherited=lvl.is_inherited,
                )
                for lvl in levels
            ],
        )

    field_outs = await asyncio.gather(*[_field_out(f) for f in fields])
    return FieldTreeOut(
        groups=[_group_out(g) for g in groups],
        fields=[d for d in field_outs if d.upload_fieldgroup_id is not None],
        unassigned_fields=[d for d in field_outs if d.upload_fieldgroup_id is None],
    )
```

Add `from src.models.upload import UploadField, UploadFieldGroup` to the imports if not already present.

- [ ] **Step 10: Update `create_fieldgroup`**

```python
async def create_fieldgroup(
    session: AsyncSession, session_id: int, *, name: str, parent_id: int | None, sort_order: int
) -> FieldGroupDetail:
    """Raises UploadSessionNotFoundError if session not found."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    grp = await upload_repo.create_upload_fieldgroup(
        session, upload_session_id=session_id, name=name, parent_id=parent_id, sort_order=sort_order
    )
    return FieldGroupDetail(
        id=cast(int, grp.id),
        name=grp.name,
        parent_id=grp.parent_id,
        sort_order=grp.sort_order,
    )
```

- [ ] **Step 11: Update `update_fieldgroup`**

```python
async def update_fieldgroup(
    session: AsyncSession,
    session_id: int,
    group_id: int,
    *,
    name: str | None,
    parent_id: int | None,
    parent_id_set: bool,
    sort_order: int | None,
) -> FieldGroupDetail:
    """Raises FieldGroupNotFoundError if group not found in this session."""
    grp = await upload_repo.get_fieldgroup_by_id_and_session(session, group_id, session_id)
    if grp is None:
        raise FieldGroupNotFoundError(group_id)
    if name is not None:
        grp.name = name
    if parent_id_set:
        grp.parent_id = parent_id
    if sort_order is not None:
        grp.sort_order = sort_order
    session.add(grp)
    await session.flush()
    return FieldGroupDetail(
        id=cast(int, grp.id),
        name=grp.name,
        parent_id=grp.parent_id,
        sort_order=grp.sort_order,
    )
```

- [ ] **Step 12: Update `delete_fieldgroup_svc`**

```python
async def delete_fieldgroup_svc(session: AsyncSession, session_id: int, group_id: int) -> DeletedOut:
    """Raises FieldGroupNotFoundError if group not found in this session."""
    grp = await upload_repo.get_fieldgroup_by_id_and_session(session, group_id, session_id)
    if grp is None:
        raise FieldGroupNotFoundError(group_id)
    await upload_repo.delete_fieldgroup(session, grp)
    return DeletedOut(deleted=group_id)
```

- [ ] **Step 13: Update `trigger_reconcile`**

Change the signature and `rows_to_create` type, and return type:

```python
async def trigger_reconcile(
    session: AsyncSession, session_id: int, reference_dataset_id: int
) -> ReconcileTriggerOut:
```

Change `rows_to_create: list[dict] = []` to `rows_to_create: list[ReconciliationRowCreate] = []`.

Replace each `rows_to_create.append({...})` with `rows_to_create.append(ReconciliationRowCreate(...))`:

For the "new field" row:
```python
rows_to_create.append(
    ReconciliationRowCreate(
        upload_session_id=session_id,
        upload_field_id=cast(int, uf.id),
        ref_field_id=cast(int, best_ref.id) if best_ref and best_ref.id else None,
        group=result.group,
        status=result.status,
        confidence=result.confidence,
        note=result.note,
    )
)
```

For the "old_only" row:
```python
rows_to_create.append(
    ReconciliationRowCreate(
        upload_session_id=session_id,
        upload_field_id=None,
        ref_field_id=cast(int, rf.id) if rf.id else None,
        group=ReconciliationGroup.old_only,
        status=ReconciliationStatus.pending,
        confidence=None,
        note="Present in reference, absent in new file",
    )
)
```

Replace final return:
```python
    return ReconcileTriggerOut(total=len(rows_to_create))
```

- [ ] **Step 14: Update `list_reconcile_rows`**

```python
async def list_reconcile_rows(
    session: AsyncSession,
    session_id: int,
    group: ReconciliationGroup | None,
    after_id: int | None,
    page_size: int,
) -> ReconcileRowPage:
    rows = await reconciliation_repo.get_rows_page(
        session, session_id, group=group, after_id=after_id, page_size=page_size
    )
    next_cursor = rows[-1].id if len(rows) == page_size else None

    upload_field_ids = [r.upload_field_id for r in rows if r.upload_field_id]
    ref_field_ids = [r.ref_field_id for r in rows if r.ref_field_id]
    uf_map = {
        cast(int, u.id): u
        for u in await upload_repo.get_upload_fields_by_ids(session, upload_field_ids)
        if u.id
    }
    rf_map = {
        cast(int, f.id): f
        for f in await dataset_repo.get_fields_by_ids(session, ref_field_ids)
        if f.id
    }

    return ReconcileRowPage(
        items=[
            ReconcileRowOut(
                id=cast(int, r.id),
                group=r.group,
                status=r.status,
                upload_field_id=r.upload_field_id,
                ref_field_id=r.ref_field_id,
                field_key=uf_map[r.upload_field_id].field_key
                if r.upload_field_id and r.upload_field_id in uf_map
                else None,
                field_type=(
                    uf_map[r.upload_field_id].override_type
                    or uf_map[r.upload_field_id].detected_type
                )
                if r.upload_field_id and r.upload_field_id in uf_map
                else None,
                ref_field_key=rf_map[r.ref_field_id].field_key
                if r.ref_field_id and r.ref_field_id in rf_map
                else None,
                confidence=r.confidence,
                note=r.note,
            )
            for r in rows
        ],
        next_cursor=next_cursor,
    )
```

- [ ] **Step 15: Update `get_reconcile_counts`**

```python
async def get_reconcile_counts(session: AsyncSession, session_id: int) -> ReconcileCountsOut:
    """Raises UploadSessionNotFoundError if session not found."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    group_counts = await reconciliation_repo.get_counts_by_group(session, session_id)
    status_counts = await reconciliation_repo.get_status_counts(session, session_id)
    blocking_pending = await reconciliation_repo.get_blocking_pending_count(session, session_id)
    return ReconcileCountsOut(
        exact=group_counts.get("exact", 0),
        probable=group_counts.get("probable", 0),
        new_only=group_counts.get("new_only", 0),
        old_only=group_counts.get("old_only", 0),
        status_counts=status_counts,
        blocking_pending=blocking_pending,
    )
```

- [ ] **Step 16: Update `resolve_reconcile_row`**

```python
async def resolve_reconcile_row(
    session: AsyncSession,
    session_id: int,
    row_id: int,
    status: ReconciliationStatus,
    ref_field_id: int | None,
    upload_field_id: int | None,
) -> ReconcileRowResolvedOut:
    """Raises LevelNotFoundError (reused as RowNotFoundError) if row not found."""
    row = await reconciliation_repo.resolve_row(
        session, row_id, status, ref_field_id=ref_field_id, upload_field_id=upload_field_id
    )
    if row is None:
        raise LevelNotFoundError(row_id)
    return ReconcileRowResolvedOut(
        id=cast(int, row.id),
        status=row.status,
        upload_field_id=row.upload_field_id,
        ref_field_id=row.ref_field_id,
    )
```

- [ ] **Step 17: Update `bulk_resolve_rows`**

```python
async def bulk_resolve_rows(
    session: AsyncSession, session_id: int, ids: list[int], action: ReconciliationStatus
) -> BulkResolvedOut:
    resolved = await reconciliation_repo.bulk_resolve(session, session_id, ids, action)
    return BulkResolvedOut(resolved=resolved)
```

- [ ] **Step 18: Run tests**

```bash
just test-api
```

Expected: all tests pass.

- [ ] **Step 19: Commit**

```bash
git add apps/api/src/services/upload_service.py
```

Write to `/tmp/commit-msg.txt`:
```
feat(api): replace all dict returns in upload_service with typed Pydantic response models
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 8: Add `response_model=` to all upload routes

**Files:**
- Modify: `apps/api/src/routes/uploads.py`

- [ ] **Step 1: Update imports in `routes/uploads.py`**

Add to the existing imports from `src.services import upload_service`:

Also add explicit model imports:

```python
from src.models.reconciliation import (
    BulkResolvedOut,
    ReconcileCountsOut,
    ReconcileIdsOut,
    ReconcileRowPage,
    ReconcileRowResolvedOut,
    ReconcileTriggerOut,
)
from src.models.upload import (
    CommitOut,
    DeletedOut,
    FieldGroupDetail,
    FieldMoveOut,
    FieldTreeOut,
    SuggestedReferenceOut,
    UploadCreatedResponse,
    UploadFieldOverrideOut,
    UploadLevelRead,
    UploadSessionDetail,
    UploadSessionListResponse,
)
```

- [ ] **Step 2: Add `response_model=` to every route**

Update each route decorator and route body as follows. The logic does not change — only `response_model=` is added to the decorator.

**POST /uploads** (status_code=201):
```python
@router.post("/uploads", status_code=201, response_model=UploadCreatedResponse)
```

**GET /uploads** (replace inline logic with service call):
```python
@router.get("/uploads", response_model=UploadSessionListResponse)
async def list_upload_sessions(session: AsyncSession = Depends(get_session)):
    """List all non-committed, non-abandoned upload sessions (drafts)."""
    return await upload_service.list_upload_sessions(session)
```

**GET /uploads/{session_id}**:
```python
@router.get("/uploads/{session_id}", response_model=UploadSessionDetail)
```

**PATCH /uploads/{session_id}/fields/{field_id}**:
```python
@router.patch("/uploads/{session_id}/fields/{field_id}", response_model=UploadFieldOverrideOut)
```

**POST /uploads/{session_id}/reconcile**:
```python
@router.post("/uploads/{session_id}/reconcile", response_model=ReconcileTriggerOut)
```

**GET /uploads/{session_id}/reconcile**:
```python
@router.get("/uploads/{session_id}/reconcile", response_model=ReconcileRowPage)
```

**GET /uploads/{session_id}/reconcile/ids**:
```python
@router.get("/uploads/{session_id}/reconcile/ids", response_model=ReconcileIdsOut)
async def get_reconcile_ids(
    session_id: int,
    group: ReconciliationGroup | None = None,
    session: AsyncSession = Depends(get_session),
):
    ids = await reconciliation_repo.get_all_ids(session, session_id, group=group)
    return ReconcileIdsOut(ids=ids)
```

**GET /uploads/{session_id}/reconcile/counts**:
```python
@router.get("/uploads/{session_id}/reconcile/counts", response_model=ReconcileCountsOut)
```

**GET /uploads/{session_id}/suggested-reference**:
```python
@router.get("/uploads/{session_id}/suggested-reference", response_model=SuggestedReferenceOut)
```

**PATCH /uploads/{session_id}/reconcile/{row_id}**:
```python
@router.patch("/uploads/{session_id}/reconcile/{row_id}", response_model=ReconcileRowResolvedOut)
```

**POST /uploads/{session_id}/reconcile/bulk**:
```python
@router.post("/uploads/{session_id}/reconcile/bulk", response_model=BulkResolvedOut)
```

**POST /uploads/{session_id}/commit** (status_code=201):
```python
@router.post("/uploads/{session_id}/commit", status_code=201, response_model=CommitOut)
async def commit_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        dataset_id = await upload_service.commit(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return CommitOut(dataset_id=dataset_id)
```

**GET /uploads/{session_id}/field-tree**:
```python
@router.get("/uploads/{session_id}/field-tree", response_model=FieldTreeOut)
```

**POST /uploads/{session_id}/fieldgroups** (status_code=201):
```python
@router.post("/uploads/{session_id}/fieldgroups", status_code=201, response_model=FieldGroupDetail)
```

**PATCH /uploads/{session_id}/fieldgroups/{group_id}**:
```python
@router.patch("/uploads/{session_id}/fieldgroups/{group_id}", response_model=FieldGroupDetail)
```

**DELETE /uploads/{session_id}/fieldgroups/{group_id}**:
```python
@router.delete("/uploads/{session_id}/fieldgroups/{group_id}", response_model=DeletedOut)
```

**PUT /uploads/{upload_session_id}/fields/{field_id}/levels** (status_code=200):
```python
@router.put("/uploads/{upload_session_id}/fields/{field_id}/levels", status_code=200, response_model=UploadLevelRead)
```

**PATCH /uploads/{session_id}/fields/{field_id}/move**:
```python
@router.patch("/uploads/{session_id}/fields/{field_id}/move", response_model=FieldMoveOut)
```

- [ ] **Step 3: Run tests**

```bash
just test-api
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/uploads.py
```

Write to `/tmp/commit-msg.txt`:
```
feat(api): add response_model= to all upload routes; extract list_upload_sessions to service
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 9: Python typecheck + regenerate shared types

- [ ] **Step 1: Run full Python typecheck**

```bash
just typecheck
```

Fix any type errors surfaced. Common issues to expect:
- `cast(int, ...)` needed where ORM `id: int | None` is passed to a model expecting `int`
- Missing imports for new model classes

- [ ] **Step 2: Regenerate `packages/shared/api.d.ts`**

```bash
just generate-types
```

Expected: the file is rewritten. Verify that the previously-`unknown` operations now have proper response types by grepping:

```bash
grep -c "unknown" packages/shared/api.d.ts
```

The count should drop significantly (some `unknown` for non-JSON endpoints like the download streaming route is acceptable).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/api.d.ts
```

Write to `/tmp/commit-msg.txt`:
```
chore(shared): regenerate api.d.ts — upload routes now fully typed
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 10: Fix TypeScript — upload wizard steps

Now that `api.d.ts` has proper types for all upload routes, remove every `as any` cast from the wizard steps. The data shapes are guaranteed by the schemas defined in Tasks 1–8.

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/Step2FieldDetection.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`

- [ ] **Step 1: Fix `Step1FileHierarchy.tsx`**

Find:
```typescript
const { data, error } = await api.POST("/api/v1/uploads", { body: form as any })
// ...
setSessionId((data as any).id)
```

Replace with:
```typescript
const { data, error } = await api.POST("/api/v1/uploads", { body: form as Parameters<typeof api.POST<"/api/v1/uploads">>[1]["body"] })
// ...
if (data) setSessionId(data.id)
```

Note: `FormData` cannot be statically typed against the generated multipart schema without a cast. Use `body: form as never` or the explicit type above to preserve safety while satisfying the compiler. The `data.id` access is now fully typed.

Actually the simplest correct approach for multipart FormData with openapi-fetch is:

```typescript
const { data, error } = await api.POST("/api/v1/uploads", {
  body: form,
  bodySerializer: (b) => b as FormData,
} as Parameters<typeof api.POST>[1])
```

Or simply keep `body: form as never` — this avoids casting `data` while only casting the FormData at the boundary.

After the call, access `data.id`, `data.fields`, etc. directly without `as any`.

- [ ] **Step 2: Fix `Step2FieldDetection.tsx`**

The local `DetectedField` interface types should use the generated enum. Import and use:

```typescript
import type { components } from "@shared/api"
type FieldType = components["schemas"]["FieldType"]
```

Update `DetectedField`:
```typescript
interface DetectedField {
  id: number
  field_key: string
  detected_type: FieldType
  override_type: FieldType | null
  sort_order: number
  confidence: string
  value_sample: string[]
}
```

Remove all `as any` casts — `data.fields` is now `UploadFieldOut[]` from the typed client, which matches `DetectedField` (after the create-upload call, `data.fields` contains the detected fields). Assign directly:
```typescript
if (data) setFields(data.fields as DetectedField[])
```

(The cast to `DetectedField[]` is safe and narrow — both are the same shape, just locally vs. generated.)

For the override response:
```typescript
// data from PATCH /uploads/.../fields/{field_id} is now UploadFieldOverrideOut
setFields((prev) =>
  prev.map((f) =>
    f.id === fieldId
      ? { ...f, override_type: data.override_type ?? null }
      : f,
  ),
)
```

- [ ] **Step 3: Fix `Step3Reconciliation.tsx`**

The suggested-reference response is now `SuggestedReferenceOut`. Replace:
```typescript
if ((data as any)?.dataset_id) { setRefDatasetId(String((data as any).dataset_id)) }
```
with:
```typescript
if (data?.dataset_id) { setRefDatasetId(String(data.dataset_id)) }
```

Reconcile counts is now `ReconcileCountsOut`. Replace:
```typescript
setCounts(data as any)
setBlockingPending((data as any).blocking_pending ?? 0)
```
with:
```typescript
setCounts(data)
setBlockingPending(data.blocking_pending)
```

Reconcile rows is now `ReconcileRowPage`. Replace:
```typescript
setRows((prev) => (cursor === null ? (data as any).items : [...prev, ...(data as any).items]))
setNextCursor((data as any).next_cursor ?? null)
```
with:
```typescript
setRows((prev) => (cursor === null ? data.items : [...prev, ...data.items]))
setNextCursor(data.next_cursor ?? null)
```

Update local type annotations to match the generated schemas — e.g. the `ReconcileRow` local interface should reference `components["schemas"]["ReconcileRowOut"]` or simply be removed if it duplicates the generated type.

- [ ] **Step 4: Fix `Step4MetadataEditor.tsx`**

Field tree response is now `FieldTreeOut`. Replace:
```typescript
setGroups((data as any).groups)
setFields((data as any).fields)
setUnassigned((data as any).unassigned_fields)
```
with:
```typescript
setGroups(data.groups)
setFields(data.fields)
setUnassigned(data.unassigned_fields)
```

Update local state types to match `FieldGroupOut[]` and `FieldTreeFieldOut[]` from the generated schemas.

- [ ] **Step 5: Fix `Step5ReviewCommit.tsx`**

The `SessionSummary` interface is manually defined. Update it to align with the generated types:

```typescript
import type { components } from "@shared/api"
type UploadSessionDetail = components["schemas"]["UploadSessionDetail"]
type FieldTreeOut = components["schemas"]["FieldTreeOut"]
type ReconcileCountsOut = components["schemas"]["ReconcileCountsOut"]
type SuggestedReferenceOut = components["schemas"]["SuggestedReferenceOut"]
```

Replace the `sess as any` and `tree as any` pattern with direct typed access:

```typescript
const [sessRaw, treeRaw, reconData] = await Promise.all([...])

const sess = sessRaw  // typed as UploadSessionDetail
const tree = treeRaw  // typed as FieldTreeOut
```

Update `SessionSummary` construction to use typed properties without casts.

The `unassigned_fields: unknown[]` field becomes `unassigned_fields: FieldTreeFieldOut[]`.

- [ ] **Step 6: Run TS typecheck**

```bash
just typecheck
```

Fix any remaining errors. Common fixes:
- Local interfaces that predate the generated types may need to be removed or narrowed
- `null` vs `undefined` mismatches between Python `Optional` and TS `| null` vs `| undefined`

- [ ] **Step 7: Run web tests**

```bash
just test-web
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/datasets/upload/steps/
```

Write to `/tmp/commit-msg.txt`:
```
fix(web): remove all as-any casts from upload wizard — routes now fully typed
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 11: Fix analytics types — discriminated union

**Files:**
- Modify: `apps/web/src/app/analytics/analytics-types.ts`
- Modify: `apps/web/src/app/analytics/useAnalyticsState.ts`
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.tsx`

- [ ] **Step 1: Replace `AnalyticsResult` with discriminated union in `analytics-types.ts`**

The generated `api.d.ts` now contains `CrosstabResponse` and `TrendResponse` schemas. Replace the hand-rolled `AnalyticsResult` interface with:

```typescript
import type { components } from "@shared/api"

export type CrosstabResult = components["schemas"]["CrosstabResponse"]
export type TrendResult = components["schemas"]["TrendResponse"]
export type AnalyticsResult = CrosstabResult | TrendResult
```

Remove the old `export interface AnalyticsResult { ... }` block entirely.

- [ ] **Step 2: Update `QueryBuilderPanel.tsx` — remove `as AnalyticsResult` cast**

Find:
```typescript
onResult(data as AnalyticsResult, q)
```

Now that `data` from `api.POST("/api/v1/analytics/crosstab")` is typed as `CrosstabResult` and `api.POST("/api/v1/analytics/trend")` returns `TrendResult`, the cast is unnecessary if the `onResult` signature accepts `AnalyticsResult`:

```typescript
onResult(data, q)
```

If `data` is `CrosstabResult | undefined`, add a guard first:
```typescript
if (!data) return
onResult(data, q)
```

Also fix the scope fetch error branch:
```typescript
api.GET("/api/v1/scope").then(({ data, error }) => {
  if (error) console.error("Failed to load scope", error)
  if (data) setPackages(data)  // no cast needed — data is already ScopePackage[]
})
```

- [ ] **Step 3: Fix `useAnalyticsState.ts` — URL parser type mismatch**

The URL stores `FieldSelection[]` in `rows` and `cols` params (the internal `QueryConfig` type). The parser is incorrectly typed as `FilterSpec[]`. Fix:

```typescript
import { parseAsJson, parseAsStringLiteral, parseAsInteger, useQueryStates } from 'nuqs'
import type { FieldSelection } from './analytics-types'

const [p, setP] = useQueryStates({
  ...
  rows: parseAsJson<FieldSelection[]>((v) => v as FieldSelection[]).withDefault([]),
  cols: parseAsJson<FieldSelection[]>((v) => v as FieldSelection[]).withDefault([]),
  ...
})
```

And update the conversion in the getter and setter to use `FieldSelection[]` consistently, removing the `as FilterSpec[]` casts.

- [ ] **Step 4: Run typecheck + tests**

```bash
just typecheck
just test-web
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/analytics/analytics-types.ts apps/web/src/app/analytics/useAnalyticsState.ts apps/web/src/app/analytics/QueryBuilderPanel.tsx
```

Write to `/tmp/commit-msg.txt`:
```
fix(web): replace AnalyticsResult local type with generated discriminated union; fix URL parser types
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 12: Update patterns docs to prevent recurrence

**Files:**
- Modify: `docs/patterns/backend.md`
- Modify: `docs/patterns.md`

- [ ] **Step 1: Add three rules to `docs/patterns/backend.md`**

Append a new section after the existing content (before the Alembic section or at the end):

```markdown
## Typing Enforcement Rules

These rules prevent the class of type-safety holes found in the 2026-04 audit.
The `audit-patterns` skill checks for violations.

### Services must return typed models, never bare `dict`

Service functions must return a SQLModel or Pydantic `BaseModel` instance.
Bare `dict` return types (`-> dict`, `-> dict[str, Any]`) are prohibited.

```python
# CORRECT — typed response schema
class CommitOut(SQLModel):
    dataset_id: int

async def commit(session: AsyncSession, session_id: int) -> CommitOut:
    ...
    return CommitOut(dataset_id=new_id)

# WRONG — untyped, generates unknown in api.d.ts
async def commit(session: AsyncSession, session_id: int) -> dict:
    ...
    return {"dataset_id": new_id}
```

Where a service exists purely to pass through a repo result (list endpoint, CRUD
passthrough), returning the ORM model directly is fine — no extra schema needed.

### All route handlers must declare `response_model=`

Every route handler that returns a body must set `response_model=` on its
decorator. FastAPI uses this to generate the OpenAPI schema, which `openapi-typescript`
uses to generate TypeScript types. Without it, all API calls from the frontend
return `unknown`.

```python
# CORRECT
@router.post("/uploads", status_code=201, response_model=UploadCreatedResponse)
async def create_upload(...) -> UploadCreatedResponse: ...

# WRONG — openapi-typescript generates unknown for this response
@router.post("/uploads", status_code=201)
async def create_upload(...): ...
```

The only acceptable exception is `StreamingResponse` endpoints (e.g. CSV download),
where the content type is not JSON and no schema can be emitted.

### Repositories must use explicit typed parameters, not `**kwargs`

Repository constructor helpers must declare every parameter explicitly. `**kwargs`
makes all call sites opaque to the type checker — a typo in a keyword argument is
invisible until runtime.

```python
# CORRECT
async def create_session(
    session: AsyncSession,
    *,
    file_path: str,
    dataset_name: str | None,
    status: UploadSessionStatus,
) -> UploadSession:
    obj = UploadSession(file_path=file_path, dataset_name=dataset_name, status=status)
    ...

# WRONG — type checker cannot verify call sites
async def create_session(session: AsyncSession, **kwargs) -> UploadSession:
    obj = UploadSession(**kwargs)
    ...
```

### No `Any` in service function signatures

Service function parameters must not use `Any`. If the type is a union, write the
union explicitly. `Any` in a signature silently disables type checking at every
call site.

```python
# CORRECT
async def override_field(
    ...,
    override_type: FieldType | None,
    upload_fieldgroup_id: int | None,
) -> UploadFieldOverrideOut: ...

# WRONG — silences type checking on all callers
async def override_field(
    ...,
    override_type: Any | None,
    upload_fieldgroup_id: Any,
) -> dict: ...
```
```

- [ ] **Step 2: Add a pointer in `docs/patterns.md`**

Find the `## Backend (FastAPI)` section in `docs/patterns.md`. After the existing summary paragraph, add:

```markdown
### Typing rules

All service functions must return typed SQLModel/Pydantic instances — never bare `dict`.
All route handlers must declare `response_model=`. Repositories must use explicit typed
parameters, not `**kwargs`. No `Any` in service signatures.
See the full rules with examples: [docs/patterns/backend.md — Typing Enforcement Rules](patterns/backend.md#typing-enforcement-rules)
```

- [ ] **Step 3: Update `audit-patterns` skill to call out these checks explicitly**

The current `audit-patterns` skill (`.claude/skills/audit-patterns/SKILL.md`) has a "Common Deviation Categories to Check" section. Open the file and add under **Python:**

```markdown
- Service functions returning bare `dict` (should return SQLModel or Pydantic BaseModel)
- Route handlers missing `response_model=` (causes `unknown` in api.d.ts and `as any` cascades in frontend)
- Repository functions using `**kwargs` instead of explicit typed parameters
- `Any` used in service function parameter types
```

- [ ] **Step 4: Commit**

```bash
git add docs/patterns/backend.md docs/patterns.md .claude/skills/audit-patterns/SKILL.md
```

Write to `/tmp/commit-msg.txt`:
```
docs: add typing enforcement rules to backend patterns; update audit-patterns skill checklist
```

```bash
git commit -F /tmp/commit-msg.txt
```

---

### Task 13: Final verification

- [ ] **Step 1: Run full test suite**

```bash
just test
```

Expected: all pytest + vitest tests pass.

- [ ] **Step 2: Run full typecheck**

```bash
just typecheck
```

Expected: no errors on `ty` (Python) or `tsc` (TypeScript).

- [ ] **Step 3: Verify `unknown` count in `api.d.ts` is minimal**

```bash
grep -c "unknown" packages/shared/api.d.ts
```

Acceptable remaining `unknown` entries: the CSV download streaming route (`download_dataset_csv_...`) — all others should be typed.

- [ ] **Step 4: Run lint**

```bash
just lint
```

Fix any warnings introduced (likely none — changes are type annotations only).
