# Data Ingestion Gap-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 15 spec gaps identified in the post-implementation audit of Sub-project 6 (Data Ingestion & Metadata Editor wizard Steps 1–5 and Datasets page).

**Architecture:** Backend tasks come first (API enrichment, new endpoints, migration) so frontend tasks can consume them in order. Each task is self-contained. No new libraries needed — dnd-kit, lucide-react, tanstack-query are already installed.

**Tech Stack:** FastAPI + SQLModel + Alembic (backend); Next.js App Router + TailwindCSS + lucide-react (frontend); pytest (API tests); Storybook + @storybook/test (component stories).

---

## File Map

**Modified (backend):**
- `apps/api/src/repositories/reconciliation_repo.py` — add `get_status_counts`; add `upload_field_id` to `resolve_row`
- `apps/api/src/routes/uploads.py` — enrich session GET, add `sort_order` to PATCH, add field DELETE, levels endpoints, `upload_field_id` to `RowResolve`, CSV download
- `apps/api/src/repositories/upload_repo.py` — `delete_field`, `get_levels_for_field` (already exists), `upsert_level`, `delete_level`
- `apps/api/src/models/upload.py` — add `is_inherited` to `UploadLevel`
- `apps/api/migrations/versions/` — new migration for `is_inherited`

**Modified (frontend):**
- `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx` — fix recon counts bug, fix excluded keys bug, enrich dataset details, add fields bar chart
- `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx` — add status chip, sort_order input, levels editor, Cancel + Delete buttons
- `apps/web/src/app/datasets/upload/steps/FieldList.tsx` — add ⋮ context menu per row
- `apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx` — add Map to… and Map to new field buttons
- `apps/web/src/app/datasets/DatasetsPage.tsx` — add Download per-row action

**Created (frontend):**
- `apps/web/src/app/datasets/upload/steps/FieldPicker.tsx` — modal/popover for picking an existing upload field

---

## Task 1: Fix Step 5 — Reconciliation Counts Bug + Excluded Keys Bug

Two bugs in `Step5ReviewCommit.tsx`:
1. `excluded: counts.old_only ?? 0` uses the group count (all old_only rows), but the UI intent is "how many old_only rows were marked excluded as a status". Needs a `get_status_counts` query that returns counts per `status` value.
2. `excludedKeys` filters `r.field_key` — but `old_only` rows have a null `field_key` (they come from the reference dataset). The correct field is `ref_field_key`.

**Files:**
- Modify: `apps/api/src/repositories/reconciliation_repo.py`
- Modify: `apps/api/src/routes/uploads.py`
- Modify: `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`
- Test: `apps/api/tests/test_uploads.py`

- [ ] **Step 1: Add `get_status_counts` to reconciliation repo**

In `apps/api/src/repositories/reconciliation_repo.py`, add after `get_counts_by_group`:

```python
async def get_status_counts(
    self, session: AsyncSession, upload_session_id: int
) -> dict[str, int]:
    result = await session.execute(
        select(
            ReconRow.status,
            func.count(ReconRow.id).label("cnt"),
        )
        .where(ReconRow.upload_session_id == upload_session_id)
        .group_by(ReconRow.status)
    )
    return {row.status: row.cnt for row in result}
```

- [ ] **Step 2: Expose status counts on the existing counts endpoint**

In `apps/api/src/routes/uploads.py`, find the `get_reconcile_counts` route (returns group counts). Change it to return both group counts and status counts:

```python
@router.get("/uploads/{upload_session_id}/reconcile/counts")
async def get_reconcile_counts(
    upload_session_id: int, session: AsyncSession = Depends(get_session)
):
    group_counts = await recon_repo.get_counts_by_group(session, upload_session_id)
    status_counts = await recon_repo.get_status_counts(session, upload_session_id)
    return {**group_counts, "status_counts": status_counts}
```

- [ ] **Step 3: Write failing test**

Add to `apps/api/tests/test_uploads.py`:

```python
async def test_reconcile_counts_includes_status_counts(client, db, recon_session):
    """recon_session fixture: upload session that has gone through reconciliation."""
    resp = await client.get(f"/api/v1/uploads/{recon_session}/reconcile/counts")
    assert resp.status_code == 200
    body = resp.json()
    assert "status_counts" in body
    # status_counts must be a dict with at least one key
    assert isinstance(body["status_counts"], dict)
```

- [ ] **Step 4: Run test to confirm it fails**

```
just test-api -k "test_reconcile_counts_includes_status_counts"
```

Expected: `AssertionError` — `status_counts` not in response.

- [ ] **Step 5: Run test again after implementation — confirm pass**

```
just test-api -k "test_reconcile_counts_includes_status_counts"
```

Expected: PASS.

- [ ] **Step 6: Fix frontend — use status_counts for excluded count**

In `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`, change line ~71:

```typescript
// Before
excluded: counts.old_only ?? 0,

// After
excluded: counts.status_counts?.excluded ?? 0,
```

- [ ] **Step 7: Fix frontend — use ref_field_key for excluded keys**

In the same file, change lines ~73–75:

```typescript
// Before
excludedKeys = oldOnlyPage.items
  .filter((r) => r.status === "excluded" && r.field_key)
  .map((r) => r.field_key as string)

// After
excludedKeys = oldOnlyPage.items
  .filter((r) => r.status === "excluded" && r.ref_field_key)
  .map((r) => r.ref_field_key as string)
```

- [ ] **Step 8: Commit**

```
git add apps/api/src/repositories/reconciliation_repo.py apps/api/src/routes/uploads.py apps/api/tests/test_uploads.py apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx
```

Write to `/tmp/commit-msg.txt`:
```
fix(api): add status-based reconciliation counts endpoint

Adds get_status_counts to recon repo and exposes status_counts in the
reconcile/counts response. Fixes Step 5 excluded count and excluded key
display to use status column and ref_field_key respectively.
```

```
git commit -F /tmp/commit-msg.txt
```

---

## Task 2: Enrich `GET /uploads/{id}` with Collection Metadata

The spec (Step 5 dataset details card) requires `collection_name`, `package_name`, `collected_at`, and `file_name`. Currently only `collection_id` is returned.

**Files:**
- Modify: `apps/api/src/routes/uploads.py`
- Modify: `apps/api/src/repositories/upload_repo.py`
- Test: `apps/api/tests/test_uploads.py`

- [ ] **Step 1: Check what's available on the session model**

Read `apps/api/src/models/upload.py` and confirm which columns exist on `UploadSession`. The fields `dataset_name`, `collection_id`, `file_name`, `row_count` should already be there. Check if `package_name`, `collected_at` are also stored or if they need to be fetched from a related `Collection` model.

- [ ] **Step 2: Add a repo helper to get collection metadata**

If `Collection` is a separate model with `package_name` and `collected_at`, add to `apps/api/src/repositories/upload_repo.py`:

```python
async def get_collection_meta(
    self, session: AsyncSession, collection_id: int
) -> dict | None:
    from src.models.collection import Collection  # adjust import
    result = await session.get(Collection, collection_id)
    if result is None:
        return None
    return {
        "collection_name": result.name,
        "package_name": result.package_name,
        "collected_at": result.collected_at.isoformat() if result.collected_at else None,
    }
```

If `Collection` doesn't have these fields, check the actual model and adapt accordingly.

- [ ] **Step 3: Enrich the session GET response**

In `apps/api/src/routes/uploads.py`, in `get_upload_session`, after loading `sess`:

```python
    collection_meta = {}
    if sess.collection_id:
        collection_meta = await upload_repo.get_collection_meta(session, sess.collection_id) or {}

    return {
        "id": sess.id,
        "dataset_name": sess.dataset_name,
        "row_count": sess.row_count,
        "collection_id": sess.collection_id,
        "collection_name": collection_meta.get("collection_name"),
        "package_name": collection_meta.get("package_name"),
        "collected_at": collection_meta.get("collected_at"),
        "file_name": sess.file_name,
        "fields": field_list,
    }
```

- [ ] **Step 4: Write failing test**

```python
async def test_get_upload_session_includes_file_name(client, db):
    csv_bytes = _make_csv(["id"], [["1"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("survey.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Test"},
    )
    sid = resp.json()["id"]
    get_resp = await client.get(f"/api/v1/uploads/{sid}")
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert "file_name" in body
    assert body["file_name"] == "survey.csv"
```

- [ ] **Step 5: Run test — expect FAIL**

```
just test-api -k "test_get_upload_session_includes_file_name"
```

- [ ] **Step 6: Run test after implementation — confirm PASS**

```
just test-api -k "test_get_upload_session_includes_file_name"
```

- [ ] **Step 7: Commit**

```
git add apps/api/src/routes/uploads.py apps/api/src/repositories/upload_repo.py apps/api/tests/test_uploads.py
```

Write to `/tmp/commit-msg.txt`:
```
feat(api): enrich session GET with collection metadata and file_name
```

```
git commit -F /tmp/commit-msg.txt
```

---

## Task 3: Step 5 — Enrich Dataset Details Card + Add Fields Bar Chart

Consumes the enriched API from Task 2. Adds `collection_name`, `package_name`, `collected_at`, `file_name` to the dataset details card, and adds a horizontal bar chart to the fields breakdown card.

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`

- [ ] **Step 1: Extend the `SessionSummary` interface**

In `Step5ReviewCommit.tsx`, extend the interface:

```typescript
interface SessionSummary {
  dataset_name: string | null
  row_count: number | null
  collection_id: number | null
  collection_name: string | null
  package_name: string | null
  collected_at: string | null
  file_name: string | null
  fields: { detected_type: string; override_type: string | null }[]
  groups: { id: number; name: string; parent_id: number | null }[]
  unassigned_fields: unknown[]
  recon: ReconSummary | null
  excluded_field_keys: string[]
}
```

- [ ] **Step 2: Map new fields in the setSummary call**

In the Promise.all `.then` callback, add the new fields:

```typescript
setSummary({
  dataset_name: sess.dataset_name,
  row_count: sess.row_count,
  collection_id: sess.collection_id,
  collection_name: sess.collection_name ?? null,
  package_name: sess.package_name ?? null,
  collected_at: sess.collected_at ?? null,
  file_name: sess.file_name ?? null,
  // ... rest unchanged
})
```

- [ ] **Step 3: Add extra rows to the dataset details card**

Find the dataset details card (around line 148). After the Collection ID row, add:

```tsx
{summary.collection_name && (
  <div className="flex gap-2">
    <span className="w-28 text-muted-foreground">Collection</span>
    <span className="font-medium">{summary.collection_name}</span>
  </div>
)}
{summary.package_name && (
  <div className="flex gap-2">
    <span className="w-28 text-muted-foreground">Package</span>
    <span className="font-medium">{summary.package_name}</span>
  </div>
)}
{summary.collected_at && (
  <div className="flex gap-2">
    <span className="w-28 text-muted-foreground">Collected</span>
    <span className="font-medium">
      {new Date(summary.collected_at).toLocaleDateString()}
    </span>
  </div>
)}
{summary.file_name && (
  <div className="flex gap-2">
    <span className="w-28 text-muted-foreground">File</span>
    <span className="font-mono font-medium text-xs">{summary.file_name}</span>
  </div>
)}
```

- [ ] **Step 4: Add an inline bar chart to the fields breakdown card**

After the `{Object.entries(typeCounts).map(...)}` block, add a bar chart using CSS widths:

```tsx
{/* Mini bar chart */}
<div className="mt-2 space-y-1">
  {Object.entries(typeCounts).map(([t, n]) => (
    <div key={`bar-${t}`} className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-muted-foreground text-xs">{t}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-accent"
          style={{ width: `${Math.round((n / summary.fields.length) * 100)}%` }}
        />
      </div>
      <span className="w-6 text-right text-muted-foreground text-xs">{n}</span>
    </div>
  ))}
</div>
```

- [ ] **Step 5: Verify in browser**

Start the dev servers:
```
just dev
```

Navigate to `http://localhost:3000/datasets/upload`, create an upload session, reach Step 5. Confirm dataset details shows file name and collection fields (if any), and fields card shows bar chart.

- [ ] **Step 6: Commit**

```
git add apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx
```

Write to `/tmp/commit-msg.txt`:
```
feat(web): enrich Step 5 dataset details and add fields bar chart
```

```
git commit -F /tmp/commit-msg.txt
```

---

## Task 4: Backend — Add `sort_order` to Field PATCH + Add Field DELETE

The spec allows reordering fields (sort_order) and deleting individual fields. Both are missing.

**Files:**
- Modify: `apps/api/src/routes/uploads.py`
- Modify: `apps/api/src/repositories/upload_repo.py`
- Test: `apps/api/tests/test_uploads.py`

- [ ] **Step 1: Add `sort_order` to `FieldOverride` Pydantic model**

In `apps/api/src/routes/uploads.py`, find `FieldOverride` (around line 68):

```python
class FieldOverride(BaseModel):
    override_type: FieldType | None = None
    display_name: str | None = None
    upload_fieldgroup_id: int | None = None
    sort_order: int | None = None  # add this line
```

- [ ] **Step 2: Apply `sort_order` in the PATCH handler**

In the same file, find the `patch_field` route. Add:

```python
    if body.sort_order is not None:
        field.sort_order = body.sort_order
```

- [ ] **Step 3: Add `delete_field` repo method**

In `apps/api/src/repositories/upload_repo.py`, add:

```python
async def delete_field(
    self, session: AsyncSession, upload_session_id: int, field_id: int
) -> bool:
    field = await session.get(UploadField, field_id)
    if field is None or field.upload_session_id != upload_session_id:
        return False
    await session.delete(field)
    await session.commit()
    return True
```

- [ ] **Step 4: Add DELETE endpoint for a field**

In `apps/api/src/routes/uploads.py`, add after the PATCH field route:

```python
@router.delete("/uploads/{upload_session_id}/fields/{field_id}", status_code=204)
async def delete_field(
    upload_session_id: int,
    field_id: int,
    session: AsyncSession = Depends(get_session),
):
    deleted = await upload_repo.delete_field(session, upload_session_id, field_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Field not found")
```

- [ ] **Step 5: Write failing tests**

```python
async def test_patch_field_sort_order(client, db):
    csv_bytes = _make_csv(["a", "b"], [["1", "2"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "T"},
    )
    sess = resp.json()
    field_id = sess["fields"][0]["id"]
    patch = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}",
        json={"sort_order": 99},
    )
    assert patch.status_code == 200
    assert patch.json()["sort_order"] == 99


async def test_delete_field(client, db):
    csv_bytes = _make_csv(["x", "y"], [["1", "2"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "T"},
    )
    sess = resp.json()
    field_id = sess["fields"][0]["id"]
    del_resp = await client.delete(f"/api/v1/uploads/{sess['id']}/fields/{field_id}")
    assert del_resp.status_code == 204
    get_resp = await client.get(f"/api/v1/uploads/{sess['id']}")
    remaining_ids = [f["id"] for f in get_resp.json()["fields"]]
    assert field_id not in remaining_ids
```

- [ ] **Step 6: Run tests — expect FAIL**

```
just test-api -k "test_patch_field_sort_order or test_delete_field"
```

- [ ] **Step 7: Run tests after implementation — confirm PASS**

```
just test-api -k "test_patch_field_sort_order or test_delete_field"
```

- [ ] **Step 8: Commit**

```
git add apps/api/src/routes/uploads.py apps/api/src/repositories/upload_repo.py apps/api/tests/test_uploads.py
```

Write to `/tmp/commit-msg.txt`:
```
feat(api): add sort_order to field PATCH and field DELETE endpoint
```

```
git commit -F /tmp/commit-msg.txt
```

---

## Task 5: Backend — Levels: Migration, Field-Tree, CRUD Endpoints

The spec requires editable levels per field (categorical response options with a display label and sort order). `UploadLevel` model exists but lacks `is_inherited`. The field-tree endpoint doesn't include levels. No CRUD endpoints exist.

**Files:**
- Modify: `apps/api/src/models/upload.py`
- New migration: `apps/api/migrations/versions/<hash>_add_upload_level_is_inherited.py` (generated by alembic)
- Modify: `apps/api/src/routes/uploads.py`
- Modify: `apps/api/src/repositories/upload_repo.py`
- Test: `apps/api/tests/test_uploads.py`

- [ ] **Step 1: Add `is_inherited` to `UploadLevel` model**

In `apps/api/src/models/upload.py`, find `UploadLevelBase` or `UploadLevel`:

```python
class UploadLevelBase(SQLModel):
    upload_field_id: int = sql_field(foreign_key="upload_field.id")
    raw_value: str
    display_label: str | None = None
    sort_order: int = 0
    is_inherited: bool = False  # add this line
```

- [ ] **Step 2: Generate and review migration**

```
just db-migration "add_upload_level_is_inherited"
```

Check the generated file in `apps/api/migrations/versions/`. It should add a boolean column with a default of `false`. Verify the upgrade and downgrade functions look correct.

- [ ] **Step 3: Run migration**

```
just db-migrate
```

- [ ] **Step 4: Add `get_levels_for_field` to upload_repo (if not already present)**

In `apps/api/src/repositories/upload_repo.py`, verify `get_levels_for_field` exists. If it does, skip this step. If not, add:

```python
async def get_levels_for_field(
    self, session: AsyncSession, field_id: int
) -> list[UploadLevel]:
    result = await session.execute(
        select(UploadLevel)
        .where(UploadLevel.upload_field_id == field_id)
        .order_by(UploadLevel.sort_order)
    )
    return list(result.scalars().all())
```

- [ ] **Step 5: Add `upsert_level` and `delete_level` to upload_repo**

```python
async def upsert_level(
    self,
    session: AsyncSession,
    field_id: int,
    raw_value: str,
    display_label: str | None,
    sort_order: int,
    is_inherited: bool = False,
) -> UploadLevel:
    result = await session.execute(
        select(UploadLevel).where(
            UploadLevel.upload_field_id == field_id,
            UploadLevel.raw_value == raw_value,
        )
    )
    level = result.scalar_one_or_none()
    if level is None:
        level = UploadLevel(
            upload_field_id=field_id,
            raw_value=raw_value,
            display_label=display_label,
            sort_order=sort_order,
            is_inherited=is_inherited,
        )
        session.add(level)
    else:
        level.display_label = display_label
        level.sort_order = sort_order
        level.is_inherited = is_inherited
    await session.commit()
    await session.refresh(level)
    return level


async def delete_level(
    self, session: AsyncSession, field_id: int, level_id: int
) -> bool:
    level = await session.get(UploadLevel, level_id)
    if level is None or level.upload_field_id != field_id:
        return False
    await session.delete(level)
    await session.commit()
    return True
```

- [ ] **Step 6: Include levels in the field-tree response**

In `apps/api/src/routes/uploads.py`, find `get_field_tree`. Locate where `_field_dict` is built. Add levels to each field entry:

```python
async def _field_to_dict(field: UploadField, session: AsyncSession) -> dict:
    levels = await upload_repo.get_levels_for_field(session, field.id)
    return {
        "id": field.id,
        "field_key": field.field_key,
        "display_name": field.display_name,
        "detected_type": field.detected_type.value,
        "override_type": field.override_type.value if field.override_type else None,
        "sort_order": field.sort_order,
        "upload_fieldgroup_id": field.upload_fieldgroup_id,
        "levels": [
            {
                "id": lvl.id,
                "raw_value": lvl.raw_value,
                "display_label": lvl.display_label,
                "sort_order": lvl.sort_order,
                "is_inherited": lvl.is_inherited,
            }
            for lvl in levels
        ],
    }
```

Then call `_field_to_dict` for each field when building the tree (use `asyncio.gather` for all fields).

- [ ] **Step 7: Add levels CRUD routes**

In `apps/api/src/routes/uploads.py`, add:

```python
class LevelUpsert(BaseModel):
    raw_value: str
    display_label: str | None = None
    sort_order: int = 0
    is_inherited: bool = False


@router.put("/uploads/{upload_session_id}/fields/{field_id}/levels", status_code=200)
async def upsert_level(
    upload_session_id: int,
    field_id: int,
    body: LevelUpsert,
    session: AsyncSession = Depends(get_session),
):
    level = await upload_repo.upsert_level(
        session,
        field_id=field_id,
        raw_value=body.raw_value,
        display_label=body.display_label,
        sort_order=body.sort_order,
        is_inherited=body.is_inherited,
    )
    return level


@router.delete(
    "/uploads/{upload_session_id}/fields/{field_id}/levels/{level_id}",
    status_code=204,
)
async def delete_level(
    upload_session_id: int,
    field_id: int,
    level_id: int,
    session: AsyncSession = Depends(get_session),
):
    deleted = await upload_repo.delete_level(session, field_id, level_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Level not found")
```

- [ ] **Step 8: Write failing tests**

```python
async def test_field_tree_includes_levels(client, db):
    csv_bytes = _make_csv(["cat"], [["a"], ["b"], ["a"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "T"},
    )
    sid = resp.json()["id"]
    tree = await client.get(f"/api/v1/uploads/{sid}/field-tree")
    assert tree.status_code == 200
    all_fields = tree.json()["fields"] + tree.json()["unassigned_fields"]
    cat_field = next(f for f in all_fields if f["field_key"] == "cat")
    assert "levels" in cat_field


async def test_upsert_and_delete_level(client, db):
    csv_bytes = _make_csv(["x"], [["1"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "T"},
    )
    sid = resp.json()["id"]
    field_id = resp.json()["fields"][0]["id"]

    put_resp = await client.put(
        f"/api/v1/uploads/{sid}/fields/{field_id}/levels",
        json={"raw_value": "1", "display_label": "One", "sort_order": 0},
    )
    assert put_resp.status_code == 200
    level_id = put_resp.json()["id"]

    del_resp = await client.delete(
        f"/api/v1/uploads/{sid}/fields/{field_id}/levels/{level_id}"
    )
    assert del_resp.status_code == 204
```

- [ ] **Step 9: Run tests — expect FAIL**

```
just test-api -k "test_field_tree_includes_levels or test_upsert_and_delete_level"
```

- [ ] **Step 10: Run tests after implementation — confirm PASS**

```
just test-api -k "test_field_tree_includes_levels or test_upsert_and_delete_level"
```

- [ ] **Step 11: Commit**

```
git add apps/api/src/models/upload.py apps/api/src/repositories/upload_repo.py apps/api/src/routes/uploads.py apps/api/migrations/versions/ apps/api/tests/test_uploads.py
```

Write to `/tmp/commit-msg.txt`:
```
feat(api): add is_inherited to upload_level, levels in field-tree, and levels CRUD
```

```
git commit -F /tmp/commit-msg.txt
```

---

## Task 6: Frontend — Step 4 Field Editor Panel

Adds the missing spec features to `FieldEditorPanel`: status chip, sort_order input, Cancel button, Delete button, and levels editor.

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.stories.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx`

- [ ] **Step 1: Update the `FieldNode` type to include levels**

In `apps/web/src/app/datasets/upload/steps/FieldTree.tsx` (where `FieldNode` is defined), add `levels`:

```typescript
export interface Level {
  id: number
  raw_value: string
  display_label: string | null
  sort_order: number
  is_inherited: boolean
}

export interface FieldNode {
  id: number
  field_key: string
  display_name: string | null
  detected_type: string
  override_type: string | null
  sort_order: number
  upload_fieldgroup_id: number | null
  levels: Level[]
}
```

- [ ] **Step 2: Add status chip and sort_order to FieldEditorPanel**

In `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx`, find the JSX returned when a field is selected. Add after the display name input:

```tsx
{/* Status chip */}
<div className="flex items-center gap-2">
  <span className="text-muted-foreground text-xs">Status</span>
  <span
    className={[
      "rounded-full px-2 py-0.5 font-semibold text-xs",
      field.override_type || field.display_name
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    ].join(" ")}
  >
    {field.override_type || field.display_name ? "✓ Ready" : "⚠ Needs review"}
  </span>
</div>

{/* Sort order */}
<label className="flex flex-col gap-1">
  <span className="text-muted-foreground text-xs">Sort order</span>
  <input
    type="number"
    value={sortOrder}
    onChange={(e) => setSortOrder(Number(e.target.value))}
    className="w-24 rounded border border-border bg-background px-2 py-1 text-sm"
  />
</label>
```

Add `sortOrder` to local state (initialise from `field.sort_order`).

- [ ] **Step 3: Add Cancel and Delete buttons**

Replace the existing Save button area with:

```tsx
<div className="flex gap-2 pt-2">
  <button
    type="button"
    onClick={onCancel}
    className="rounded border border-border px-4 py-1.5 text-muted-foreground text-sm hover:bg-muted"
  >
    Cancel
  </button>
  <button
    type="submit"
    className="flex-1 rounded bg-accent px-4 py-1.5 font-semibold text-sm text-white"
  >
    Save
  </button>
  <button
    type="button"
    onClick={onDelete}
    className="rounded border border-destructive px-4 py-1.5 text-destructive text-sm hover:bg-destructive/10"
  >
    Delete
  </button>
</div>
```

Add `onCancel` and `onDelete` to the `FieldEditorPanel` props interface.

- [ ] **Step 4: Implement levels editor**

Below the group selector, add a levels section:

```tsx
{/* Levels editor */}
{(field.levels.length > 0 || field.detected_type === "categorical") && (
  <div className="space-y-1">
    <span className="text-muted-foreground text-xs">Levels</span>
    <div className="space-y-1 rounded border border-border p-2">
      {levels.map((lvl, i) => (
        <div key={lvl.id} className="flex items-center gap-1">
          <input
            type="text"
            value={lvl.display_label ?? lvl.raw_value}
            onChange={(e) =>
              setLevels((prev) =>
                prev.map((l, j) =>
                  j === i ? { ...l, display_label: e.target.value } : l,
                ),
              )
            }
            placeholder={lvl.raw_value}
            className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
          />
          <button
            type="button"
            onClick={() => handleDeleteLevel(lvl.id)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove level"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

Add `levels` state initialised from `field.levels`. On Save, upsert each level via `PUT /uploads/{sessionId}/fields/{field.id}/levels`. On level delete, call `DELETE /uploads/{sessionId}/fields/{field.id}/levels/{levelId}`.

- [ ] **Step 5: Wire onCancel and onDelete in Step4MetadataEditor**

In `Step4MetadataEditor.tsx`, update the `FieldEditorPanel` usage:

```tsx
<FieldEditorPanel
  sessionId={state.sessionId ?? 0}
  field={selectedField}
  groups={groups}
  onSaved={async () => await loadTree()}
  onCancel={() => setSelectedFieldId(null)}
  onDelete={async () => {
    if (!state.sessionId || !selectedFieldId) return
    await fetch(
      `${API_BASE}/api/v1/uploads/${state.sessionId}/fields/${selectedFieldId}`,
      { method: "DELETE" },
    )
    setSelectedFieldId(null)
    await loadTree()
  }}
/>
```

- [ ] **Step 6: Update Storybook story**

In `FieldEditorPanel.stories.tsx`, add `onCancel` and `onDelete` no-op props to all stories, and add a story with levels:

```typescript
export const WithLevels: Story = {
  args: {
    sessionId: 1,
    field: {
      id: 10,
      field_key: "gender",
      display_name: "Gender",
      detected_type: "categorical",
      override_type: null,
      sort_order: 2,
      upload_fieldgroup_id: null,
      levels: [
        { id: 1, raw_value: "M", display_label: "Male", sort_order: 0, is_inherited: false },
        { id: 2, raw_value: "F", display_label: "Female", sort_order: 1, is_inherited: false },
      ],
    },
    groups: [],
    onSaved: async () => {},
    onCancel: () => {},
    onDelete: async () => {},
  },
}
```

- [ ] **Step 7: Verify in Storybook**

```
just storybook
```

Open `http://localhost:6006`. Navigate to FieldEditorPanel stories. Confirm WithLevels story renders correctly and a11y passes.

- [ ] **Step 8: Commit**

```
git add apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx apps/web/src/app/datasets/upload/steps/FieldEditorPanel.stories.tsx apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx apps/web/src/app/datasets/upload/steps/FieldTree.tsx
```

Write to `/tmp/commit-msg.txt`:
```
feat(web): Step 4 field editor — status chip, sort order, levels, cancel, delete
```

```
git commit -F /tmp/commit-msg.txt
```

---

## Task 7: Frontend — Step 4 List View Context Menu

Adds a ⋮ per-row context menu (Edit, Move to…, Remove from group) to the List view in `FieldList.tsx`.

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldList.tsx`

- [ ] **Step 1: Add context menu state**

In `FieldList.tsx`, add:

```typescript
const [menuFieldId, setMenuFieldId] = useState<number | null>(null)
```

- [ ] **Step 2: Add ⋮ button and dropdown per row**

In the row map, replace or extend the row JSX to include:

```tsx
<div key={f.id} className="group relative flex items-center gap-1 rounded px-2 py-1 hover:bg-muted">
  {/* existing row content */}
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      setMenuFieldId(menuFieldId === f.id ? null : f.id)
    }}
    className="ml-auto opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-muted-foreground/10"
    aria-label="Field actions"
  >
    ⋮
  </button>
  {menuFieldId === f.id && (
    <div className="absolute right-0 top-6 z-10 min-w-32 rounded border border-border bg-popover shadow-md">
      <button
        type="button"
        onClick={() => { onSelectField(f.id); setMenuFieldId(null) }}
        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
      >
        Edit
      </button>
      {f.upload_fieldgroup_id !== null && (
        <button
          type="button"
          onClick={() => { onMoveField(f.id, null); setMenuFieldId(null) }}
          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
        >
          Remove from group
        </button>
      )}
      {groups.map((g) => (
        g.id !== f.upload_fieldgroup_id && (
          <button
            key={g.id}
            type="button"
            onClick={() => { onMoveField(f.id, g.id); setMenuFieldId(null) }}
            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
          >
            Move to {g.name}
          </button>
        )
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Add `onMoveField` prop to FieldList**

In `FieldList.tsx`, add `onMoveField` to the props interface:

```typescript
interface Props {
  groups: GroupNode[]
  fields: FieldNode[]
  unassignedFields: FieldNode[]
  selectedFieldId: number | null
  onSelectField: (id: number) => void
  onMoveField: (fieldId: number, groupId: number | null) => void
}
```

- [ ] **Step 4: Wire `onMoveField` in Step4MetadataEditor**

In `Step4MetadataEditor.tsx`, update the `FieldList` usage:

```tsx
<FieldList
  groups={groups}
  fields={fields}
  unassignedFields={unassigned}
  selectedFieldId={selectedFieldId}
  onSelectField={setSelectedFieldId}
  onMoveField={handleMoveField}
/>
```

- [ ] **Step 5: Close menu on outside click**

Add a `useEffect` in `FieldList.tsx`:

```typescript
useEffect(() => {
  if (menuFieldId === null) return
  const handler = () => setMenuFieldId(null)
  document.addEventListener("click", handler)
  return () => document.removeEventListener("click", handler)
}, [menuFieldId])
```

- [ ] **Step 6: Verify in browser**

Navigate to Step 4 → List view. Hover over a field row. Confirm ⋮ button appears. Click it. Confirm menu shows Edit, Move to…, Remove from group options. Click each to verify they work.

- [ ] **Step 7: Commit**

```
git add apps/web/src/app/datasets/upload/steps/FieldList.tsx apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx
```

Write to `/tmp/commit-msg.txt`:
```
feat(web): Step 4 list view — add per-row context menu (edit, move, remove)
```

```
git commit -F /tmp/commit-msg.txt
```

---

## Task 8: Frontend + Backend — Step 3 Map Actions

Adds "Map to…" (probable rows) and "Map to new field" (old_only rows) buttons in `ReconciliationRow.tsx`. Backend: add `upload_field_id` to `RowResolve`. Frontend: `FieldPicker` modal component.

**Files:**
- Modify: `apps/api/src/routes/uploads.py`
- Modify: `apps/api/src/repositories/reconciliation_repo.py`
- Create: `apps/web/src/app/datasets/upload/steps/FieldPicker.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx`

- [ ] **Step 1: Add `upload_field_id` to `RowResolve`**

In `apps/api/src/routes/uploads.py`, find `RowResolve` (around line 316):

```python
class RowResolve(BaseModel):
    ref_field_id: int | None = None
    upload_field_id: int | None = None  # add this line
    status: str
```

- [ ] **Step 2: Handle `upload_field_id` in `resolve_row` repo**

In `apps/api/src/repositories/reconciliation_repo.py`, find `resolve_row`. Add handling:

```python
async def resolve_row(
    self,
    session: AsyncSession,
    row_id: int,
    ref_field_id: int | None,
    upload_field_id: int | None,
    status: str,
) -> ReconRow | None:
    row = await session.get(ReconRow, row_id)
    if row is None:
        return None
    row.status = status
    if ref_field_id is not None:
        row.ref_field_id = ref_field_id
    if upload_field_id is not None:
        row.upload_field_id = upload_field_id
    await session.commit()
    await session.refresh(row)
    return row
```

- [ ] **Step 3: Pass `upload_field_id` through in the route**

In `apps/api/src/routes/uploads.py`, find the `resolve_recon_row` route. Pass through `upload_field_id`:

```python
    row = await recon_repo.resolve_row(
        session,
        row_id=row_id,
        ref_field_id=body.ref_field_id,
        upload_field_id=body.upload_field_id,
        status=body.status,
    )
```

- [ ] **Step 4: Write failing test**

```python
async def test_resolve_row_with_upload_field_id(client, db, recon_session):
    rows_resp = await client.get(
        f"/api/v1/uploads/{recon_session}/reconcile?group=old_only&page_size=1"
    )
    row = rows_resp.json()["items"][0]
    row_id = row["id"]

    # Get a valid upload field ID from the upload session
    sess_resp = await client.get(f"/api/v1/uploads/{recon_session}")
    upload_field_id = sess_resp.json()["fields"][0]["id"]

    patch = await client.patch(
        f"/api/v1/uploads/{recon_session}/reconcile/{row_id}",
        json={"upload_field_id": upload_field_id, "status": "confirmed"},
    )
    assert patch.status_code == 200
    assert patch.json()["upload_field_id"] == upload_field_id
```

- [ ] **Step 5: Run test — expect FAIL**

```
just test-api -k "test_resolve_row_with_upload_field_id"
```

- [ ] **Step 6: Run test after implementation — confirm PASS**

```
just test-api -k "test_resolve_row_with_upload_field_id"
```

- [ ] **Step 7: Create `FieldPicker` component**

Create `apps/web/src/app/datasets/upload/steps/FieldPicker.tsx`:

```tsx
"use client"
import { useEffect, useRef } from "react"
import type { FieldNode, GroupNode } from "./FieldTree"

interface Props {
  fields: FieldNode[]
  groups: GroupNode[]
  onPick: (fieldId: number) => void
  onClose: () => void
}

export function FieldPicker({ fields, groups, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const grouped = groups.map((g) => ({
    group: g,
    fields: fields.filter((f) => f.upload_fieldgroup_id === g.id),
  }))
  const ungrouped = fields.filter((f) => f.upload_fieldgroup_id === null)

  return (
    <div
      ref={ref}
      className="absolute z-20 max-h-56 w-56 overflow-auto rounded border border-border bg-popover shadow-lg"
    >
      {grouped.map(({ group, fields: gf }) =>
        gf.length > 0 ? (
          <div key={group.id}>
            <div className="bg-muted/50 px-2 py-1 text-muted-foreground text-xs font-semibold">
              {group.name}
            </div>
            {gf.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { onPick(f.id); onClose() }}
                className="block w-full px-3 py-1 text-left text-xs hover:bg-muted"
              >
                {f.display_name ?? f.field_key}
              </button>
            ))}
          </div>
        ) : null,
      )}
      {ungrouped.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => { onPick(f.id); onClose() }}
          className="block w-full px-3 py-1 text-left text-xs hover:bg-muted"
        >
          {f.display_name ?? f.field_key}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Add Map buttons to ReconciliationRow**

In `apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx`, for rows in the `probable` group, add a "Map to…" button that opens `FieldPicker`. For rows in the `old_only` group, add a "Map to new field" button.

Add `pickerOpen` state and `fields`/`groups` props:

```tsx
interface Props {
  row: ReconRowItem  // existing type
  sessionId: number
  fields: FieldNode[]
  groups: GroupNode[]
  onResolved: () => void
}
```

For probable rows, add next to the existing action buttons:

```tsx
<div className="relative">
  <button
    type="button"
    onClick={() => setPickerOpen(true)}
    className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
  >
    Map to…
  </button>
  {pickerOpen && (
    <FieldPicker
      fields={fields}
      groups={groups}
      onPick={async (fieldId) => {
        await fetch(`${API_BASE}/api/v1/uploads/${sessionId}/reconcile/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref_field_id: fieldId, status: "confirmed" }),
        })
        onResolved()
      }}
      onClose={() => setPickerOpen(false)}
    />
  )}
</div>
```

For old_only rows, add "Map to new field":

```tsx
<button
  type="button"
  onClick={async () => {
    await fetch(`${API_BASE}/api/v1/uploads/${sessionId}/reconcile/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_field_id: row.upload_field_id, status: "confirmed" }),
    })
    onResolved()
  }}
  className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
>
  Map to new field
</button>
```

- [ ] **Step 9: Wire fields/groups into ReconciliationRow from Step 3**

In `Step3Reconciliation.tsx` (or wherever `ReconciliationRow` is used), pass `fields` and `groups` from the field-tree fetch.

- [ ] **Step 10: Verify in browser**

Navigate to Step 3 (requires an upload session with a reference dataset). Confirm:
- Probable rows show "Map to…" button that opens a field picker
- Old_only rows show "Map to new field" button that marks them as confirmed

- [ ] **Step 11: Commit**

```
git add apps/api/src/routes/uploads.py apps/api/src/repositories/reconciliation_repo.py apps/api/tests/test_uploads.py apps/web/src/app/datasets/upload/steps/FieldPicker.tsx apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx
```

Write to `/tmp/commit-msg.txt`:
```
feat: Step 3 map actions — FieldPicker component and upload_field_id in resolve
```

```
git commit -F /tmp/commit-msg.txt
```

---

## Task 9: Backend + Frontend — Dataset CSV Download

The spec requires a "Download" action on the Datasets list page. This needs a backend endpoint that streams the committed dataset as a CSV, and a frontend link.

**Files:**
- Modify: `apps/api/src/routes/datasets.py` (or equivalent dataset routes file — check for the file that handles `GET /api/v1/datasets`)
- Modify: `apps/web/src/app/datasets/DatasetsPage.tsx`
- Test: `apps/api/tests/test_datasets.py`

- [ ] **Step 1: Locate the datasets route file**

Run: `grep -r "GET.*datasets" apps/api/src/routes/ --include="*.py" -l`

Identify which file handles `GET /api/v1/datasets`. That is the file to modify.

- [ ] **Step 2: Add CSV download endpoint**

In the datasets route file, add:

```python
from fastapi.responses import StreamingResponse
import csv
import io


@router.get("/datasets/{dataset_id}/download")
async def download_dataset_csv(
    dataset_id: int,
    session: AsyncSession = Depends(get_session),
):
    # Fetch dataset + rows from the committed dataset tables
    # Adjust model/repo names to match the existing pattern in this file
    dataset = await dataset_repo.get_by_id(session, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    rows = await dataset_repo.get_rows(session, dataset_id)
    fields = await dataset_repo.get_fields(session, dataset_id)
    field_keys = [f.field_key for f in fields]

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(field_keys)
        yield buf.getvalue()
        for row in rows:
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([row.data.get(k, "") for k in field_keys])
            yield buf.getvalue()

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="dataset-{dataset_id}.csv"'},
    )
```

Adapt `dataset_repo.get_rows` and `dataset_repo.get_fields` to match the actual repo pattern.

- [ ] **Step 3: Write failing test**

Add to `apps/api/tests/test_datasets.py` (or create the file if it doesn't exist):

```python
async def test_download_dataset_csv(client, db, committed_dataset):
    """committed_dataset fixture: ID of a committed dataset with known rows."""
    resp = await client.get(f"/api/v1/datasets/{committed_dataset}/download")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    lines = resp.text.strip().split("\n")
    assert len(lines) >= 2  # header + at least one row
```

- [ ] **Step 4: Run test — expect FAIL**

```
just test-api -k "test_download_dataset_csv"
```

- [ ] **Step 5: Run test after implementation — confirm PASS**

```
just test-api -k "test_download_dataset_csv"
```

- [ ] **Step 6: Add Download link to DatasetsPage**

In `apps/web/src/app/datasets/DatasetsPage.tsx`, find the per-row actions (likely near the Delete button). Add a download link:

```tsx
<a
  href={`${API_BASE}/api/v1/datasets/${dataset.id}/download`}
  download={`dataset-${dataset.id}.csv`}
  className="rounded border border-border px-3 py-1 text-xs hover:bg-muted"
>
  Download
</a>
```

Where `API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`.

- [ ] **Step 7: Verify in browser**

Navigate to `http://localhost:3000/datasets`. Confirm each row shows a "Download" link. Click one — the browser should download a CSV file.

- [ ] **Step 8: Commit**

```
git add apps/api/src/routes/ apps/api/tests/ apps/web/src/app/datasets/DatasetsPage.tsx
```

Write to `/tmp/commit-msg.txt`:
```
feat: dataset CSV download endpoint and Download link on datasets page
```

```
git commit -F /tmp/commit-msg.txt
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Step 5 reconciliation counts bug — Task 1
- [x] Step 5 excluded field keys bug (ref_field_key) — Task 1
- [x] Step 5 dataset details: collection_name, package_name, collected_at, file_name — Tasks 2 + 3
- [x] Step 5 fields bar chart — Task 3
- [x] Field sort_order via PATCH — Task 4
- [x] Field DELETE endpoint — Task 4
- [x] `is_inherited` on UploadLevel — Task 5
- [x] Levels in field-tree — Task 5
- [x] Levels CRUD endpoints — Task 5
- [x] Step 4 Field Editor: status chip — Task 6
- [x] Step 4 Field Editor: sort_order input — Task 6
- [x] Step 4 Field Editor: levels editor — Task 6
- [x] Step 4 Field Editor: Cancel + Delete buttons — Task 6
- [x] Step 4 List View: ⋮ context menu — Task 7
- [x] Step 3: Map to… button (probable rows) — Task 8
- [x] Step 3: Map to new field button (old_only rows) — Task 8
- [x] Dataset CSV download — Task 9

**No placeholders, no TBD items identified.**
