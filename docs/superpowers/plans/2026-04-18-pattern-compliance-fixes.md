# Pattern Compliance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all remaining pattern violations found by the 2026-04-18 audit: extract route business-logic to services/repos in the upload wizard backend, migrate 26 raw `fetch()` calls to the typed API client, and replace hardcoded colour classes with design-system tokens.

**Architecture:** Two independent areas — (1) backend: add repo helper methods, new service methods in `upload_service.py`, then thin out route handlers to single service calls; (2) frontend: migrate all `fetch()` calls in the upload wizard to `openapi-fetch`, add `--warning` / `--success` tokens to `lib/theme.ts`, and remove manual `dark:` overrides. Both areas can be executed in parallel in separate worktrees.

**Tech Stack:** Python/FastAPI/SQLAlchemy (async), pytest-asyncio; TypeScript/Next.js/openapi-fetch, Vitest

---

## Context every agent must know

- Run ALL commands from the repo root, never `cd` into subdirectories.
- Use `just test-api` (not `uv run pytest`) and `just typecheck` (not `tsc` directly).
- Commit messages follow Conventional Commits: `fix(api): ...`, `fix(web): ...`
- Write commit message to `/tmp/commit-msg.txt` then `git commit -F /tmp/commit-msg.txt`.
- Never mock the database — tests use a real Postgres test DB via the `db` + `client` fixtures in `tests/conftest.py`.
- Never edit `packages/shared/api.d.ts` — it is auto-generated.
- API types are imported as `import type { paths } from "@shared/api"` in the frontend.
- The typed API client is `import { api } from "@/lib/api"` — it is `createClient<paths>` from `openapi-fetch`. It returns `{ data, error }` — never throws.

---

## Part 1 — Backend: Extract upload route logic to services

### Task 1: Fix lazy import in upload_repo + add domain errors

**Files:**
- Modify: `apps/api/src/repositories/upload_repo.py:1`
- Modify: `apps/api/src/errors.py`

- [ ] **Step 1: Fix lazy import in upload_repo.py**

In `delete_field` there is a lazy import `from sqlalchemy import delete as sql_delete`. Move it to the top of the file.

Replace the existing top-level import block:
```python
from sqlalchemy import select
```

With:
```python
from sqlalchemy import delete as sql_delete, select, update
```

Then in `delete_field`, remove the lazy import line:
```python
async def delete_field(session: AsyncSession, upload_session_id: int, field_id: int) -> bool:
    # remove this line: from sqlalchemy import delete as sql_delete
    field = await session.get(UploadField, field_id)
```

- [ ] **Step 2: Add domain errors for upload sub-entities**

Append to `apps/api/src/errors.py`:
```python
class FieldNotFoundError(DomainError): ...


class FieldGroupNotFoundError(DomainError): ...


class LevelNotFoundError(DomainError): ...
```

- [ ] **Step 3: Verify tests still pass**

Run: `just test-api`
Expected: 154 passed

- [ ] **Step 4: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(api): move lazy imports to top of upload_repo; add field/group/level domain errors
```
Stage: `apps/api/src/repositories/upload_repo.py apps/api/src/errors.py`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 2: Add upload_repo query helpers

**Files:**
- Modify: `apps/api/src/repositories/upload_repo.py`
- Test: `apps/api/tests/test_uploads.py`

These three methods are needed by the service layer so it can fetch fieldgroups without raw SQL in routes.

- [ ] **Step 1: Write failing tests**

Add to `apps/api/tests/test_uploads.py` (after existing imports, at the bottom of the file):

```python
async def test_get_fieldgroup_by_id_and_session_not_found(client, db):
    """Repo helper returns None when group_id or session_id don't match."""
    from src.repositories import upload_repo
    result = await upload_repo.get_fieldgroup_by_id_and_session(db, 999, 999)
    assert result is None


async def test_delete_fieldgroup_unassigns_fields(client, db):
    """delete_fieldgroup unassigns fields in the group then removes the group."""
    csv_bytes = _make_csv(["q1", "q2"], [["a", "b"]])
    r = await client.post(
        "/api/v1/uploads",
        files={"file": ("x.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "X"},
    )
    sid = r.json()["id"]
    # create group
    grp_r = await client.post(f"/api/v1/uploads/{sid}/fieldgroups", json={"name": "G1"})
    gid = grp_r.json()["id"]
    # assign a field to the group
    fields_r = await client.get(f"/api/v1/uploads/{sid}")
    fid = fields_r.json()["fields"][0]["id"]
    await client.patch(f"/api/v1/uploads/{sid}/fields/{fid}/move", json={"upload_fieldgroup_id": gid})
    # delete group - field should be unassigned
    del_r = await client.delete(f"/api/v1/uploads/{sid}/fieldgroups/{gid}")
    assert del_r.status_code == 200
    # field tree should show field in unassigned
    tree = (await client.get(f"/api/v1/uploads/{sid}/field-tree")).json()
    unassigned_ids = {f["id"] for f in tree["unassigned_fields"]}
    assert fid in unassigned_ids
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `just test-api -k "test_get_fieldgroup_by_id_and_session_not_found or test_delete_fieldgroup_unassigns_fields"`
Expected: `test_get_fieldgroup_by_id_and_session_not_found` fails with AttributeError, `test_delete_fieldgroup_unassigns_fields` passes (existing behavior)

- [ ] **Step 3: Add repo methods**

Append to `apps/api/src/repositories/upload_repo.py` (after `get_fieldgroups_for_session`):

```python
async def get_fieldgroup_by_id_and_session(
    session: AsyncSession, group_id: int, session_id: int
) -> UploadFieldGroup | None:
    return (
        (
            await session.execute(
                select(UploadFieldGroup).where(
                    UploadFieldGroup.id == group_id,
                    UploadFieldGroup.upload_session_id == session_id,
                )
            )
        )
        .scalars()
        .first()
    )


async def delete_fieldgroup(session: AsyncSession, grp: UploadFieldGroup) -> None:
    """Unassign all fields in the group then delete it."""
    await session.execute(
        update(UploadField)
        .where(UploadField.upload_fieldgroup_id == grp.id)
        .values(upload_fieldgroup_id=None)
    )
    await session.delete(grp)
    await session.flush()


async def get_upload_fields_by_ids(
    session: AsyncSession, field_ids: list[int]
) -> list[UploadField]:
    if not field_ids:
        return []
    return list(
        (
            await session.execute(select(UploadField).where(UploadField.id.in_(field_ids)))
        )
        .scalars()
        .all()
    )
```

- [ ] **Step 4: Run tests**

Run: `just test-api -k "test_get_fieldgroup_by_id_and_session_not_found or test_delete_fieldgroup_unassigns_fields"`
Expected: both PASS

- [ ] **Step 5: Full suite**

Run: `just test-api`
Expected: 156 passed

- [ ] **Step 6: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(api): add upload_repo query helpers for fieldgroup and batch field fetch
```
Stage: `apps/api/src/repositories/upload_repo.py apps/api/tests/test_uploads.py`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 3: Add dataset_repo helper + get_fields_by_ids

**Files:**
- Modify: `apps/api/src/repositories/dataset_repo.py`
- Test: `apps/api/tests/test_uploads.py`

`get_suggested_reference` in the route currently does raw SQL to find the most recent dataset in a collection. Move this query to the repo.

- [ ] **Step 1: Write failing test**

Append to `apps/api/tests/test_uploads.py`:

```python
async def test_suggested_reference_returns_none_for_empty_collection(client, db):
    """get_suggested_reference returns null dataset_id when collection has no datasets."""
    from src.models.collection import Collection, CollectionType
    from src.models.package import Package

    pkg = Package(name="Empty Pkg", slug="empty-pkg")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="Empty Col", slug="empty-col",
        package_id=pkg.id, collection_type=CollectionType.generic,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    csv_bytes = _make_csv(["q1"], [["a"]])
    r = await client.post(
        "/api/v1/uploads",
        files={"file": ("x.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "X", "collection_id": str(col.id)},
    )
    sid = r.json()["id"]
    ref_r = await client.get(f"/api/v1/uploads/{sid}/suggested-reference")
    assert ref_r.status_code == 200
    assert ref_r.json()["dataset_id"] is None
```

- [ ] **Step 2: Run test to confirm it currently passes (behaviour unchanged)**

Run: `just test-api -k "test_suggested_reference_returns_none_for_empty_collection"`
Expected: PASS (existing route works; this test documents the expectation)

- [ ] **Step 3: Add repo methods to dataset_repo.py**

Append to `apps/api/src/repositories/dataset_repo.py`:

```python
async def get_latest_for_collection(session: AsyncSession, collection_id: int) -> Dataset | None:
    """Return the most recently created dataset in a collection, or None."""
    return (
        (
            await session.execute(
                select(Dataset)
                .where(Dataset.collection_id == collection_id)
                .order_by(Dataset.id.desc())
                .limit(1)
            )
        )
        .scalars()
        .first()
    )


async def get_fields_by_ids(session: AsyncSession, field_ids: list[int]) -> list[Field]:
    if not field_ids:
        return []
    return list(
        (await session.execute(select(Field).where(Field.id.in_(field_ids)))).scalars().all()
    )
```

- [ ] **Step 4: Run full suite**

Run: `just test-api`
Expected: 157 passed

- [ ] **Step 5: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(api): add dataset_repo.get_latest_for_collection and get_fields_by_ids helpers
```
Stage: `apps/api/src/repositories/dataset_repo.py apps/api/tests/test_uploads.py`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 4: Add upload_service session management methods

**Files:**
- Modify: `apps/api/src/services/upload_service.py`
- Test: `apps/api/tests/test_uploads.py`

Extract session-level operations (get, discard, suggested reference, commit) from routes into the service.

- [ ] **Step 1: Write failing tests for 404 paths not currently covered**

Append to `apps/api/tests/test_uploads.py`:

```python
async def test_get_upload_session_not_found_returns_404(client):
    r = await client.get("/api/v1/uploads/99999")
    assert r.status_code == 404


async def test_discard_upload_session_not_found_returns_404(client):
    r = await client.delete("/api/v1/uploads/99999")
    assert r.status_code == 404


async def test_commit_upload_session_not_found_returns_404(client):
    r = await client.post("/api/v1/uploads/99999/commit")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests to see which ones already pass**

Run: `just test-api -k "test_get_upload_session_not_found_returns_404 or test_discard_upload_session_not_found_returns_404 or test_commit_upload_session_not_found_returns_404"`
Note which ones fail (these are the new behaviours we're adding).

- [ ] **Step 3: Add session management service methods**

Add imports to top of `apps/api/src/services/upload_service.py`:
```python
import asyncio
import os
from datetime import date
```
becomes (add `from typing import Any`):
```python
import asyncio
import os
from datetime import date
from typing import Any
```

Also add repo imports:
```python
from src.repositories import dataset_repo, upload_repo
```
(replace existing `from src.repositories import upload_repo`)

Then add the following functions to `apps/api/src/services/upload_service.py` (after `create_upload_session`):

```python
async def get_upload_session(session: AsyncSession, session_id: int) -> dict:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    from src.errors import UploadSessionNotFoundError

    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)
    field_list = [
        {
            "id": f.id,
            "field_key": f.field_key,
            "detected_type": f.detected_type.value,
            "override_type": f.override_type.value if f.override_type else None,
            "sort_order": f.sort_order,
            "upload_fieldgroup_id": f.upload_fieldgroup_id,
            "confidence": f.confidence,
            "value_sample": f.value_sample or [],
        }
        for f in fields
    ]
    collection_meta: dict = {}
    if sess.collection_id:
        collection_meta = await upload_repo.get_collection_meta(session, sess.collection_id) or {}
    return {
        "id": sess.id,
        "status": sess.status.value,
        "dataset_name": sess.dataset_name,
        "collection_id": sess.collection_id,
        "collection_name": collection_meta.get("collection_name"),
        "package_name": collection_meta.get("package_name"),
        "collected_at": sess.collected_at.isoformat() if sess.collected_at else None,
        "file_name": os.path.basename(sess.file_path).split("_", 2)[-1],
        "row_count": sess.row_count,
        "fields": field_list,
    }


async def discard_session(session: AsyncSession, session_id: int) -> None:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    from src.errors import UploadSessionNotFoundError

    discarded = await upload_repo.discard_session(session, session_id)
    if not discarded:
        raise UploadSessionNotFoundError(session_id)


async def get_suggested_reference(session: AsyncSession, session_id: int) -> dict:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    from src.errors import UploadSessionNotFoundError

    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    if sess.collection_id is None:
        return {"dataset_id": None, "dataset_name": None}
    ds = await dataset_repo.get_latest_for_collection(session, sess.collection_id)
    if ds is None:
        return {"dataset_id": None, "dataset_name": None}
    return {"dataset_id": ds.id, "dataset_name": ds.name}


async def commit(session: AsyncSession, session_id: int) -> int:
    """Raises UploadSessionNotFoundError if session_id does not exist.
    Returns the new dataset_id."""
    from src.errors import UploadSessionNotFoundError
    from src.services import commit_service

    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    return await commit_service.commit_upload(session, session_id)
```

Note: the `from src.errors import UploadSessionNotFoundError` inside each function avoids a circular import between `upload_service` and `errors`. If no circular import exists, move these to the module top instead.

- [ ] **Step 4: Run new tests**

Run: `just test-api -k "test_get_upload_session_not_found_returns_404 or test_discard_upload_session_not_found_returns_404 or test_commit_upload_session_not_found_returns_404"`
Expected: still failing (routes not updated yet — that's Task 6)

- [ ] **Step 5: Run full suite to ensure no regression**

Run: `just test-api`
Expected: all pass (new service methods not yet called by routes)

- [ ] **Step 6: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(api): add upload_service session management methods (get, discard, suggested-reference, commit)
```
Stage: `apps/api/src/services/upload_service.py apps/api/tests/test_uploads.py`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 5: Add upload_service field + level + group methods

**Files:**
- Modify: `apps/api/src/services/upload_service.py`

Extract field/level/group operations (override, delete, move, upsert_level, delete_level, field_tree, create_group, update_group, delete_group) into the service.

- [ ] **Step 1: Write failing tests for new 404 paths**

Append to `apps/api/tests/test_uploads.py`:

```python
async def test_update_fieldgroup_not_found_returns_404(client, db):
    csv_bytes = _make_csv(["q1"], [["a"]])
    r = await client.post(
        "/api/v1/uploads",
        files={"file": ("x.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "X"},
    )
    sid = r.json()["id"]
    r2 = await client.patch(f"/api/v1/uploads/{sid}/fieldgroups/99999", json={"name": "Y"})
    assert r2.status_code == 404


async def test_delete_fieldgroup_not_found_returns_404(client, db):
    csv_bytes = _make_csv(["q1"], [["a"]])
    r = await client.post(
        "/api/v1/uploads",
        files={"file": ("x.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "X"},
    )
    sid = r.json()["id"]
    r2 = await client.delete(f"/api/v1/uploads/{sid}/fieldgroups/99999")
    assert r2.status_code == 404
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `just test-api -k "test_update_fieldgroup_not_found or test_delete_fieldgroup_not_found"`
Expected: FAIL (routes not yet updated)

- [ ] **Step 3: Add field/level/group service methods**

Add the following to `apps/api/src/services/upload_service.py` (after `commit`):

```python
async def override_field(
    session: AsyncSession,
    session_id: int,
    field_id: int,
    *,
    override_type: Any | None,
    display_name: str | None,
    upload_fieldgroup_id: Any,
    sort_order: int | None,
    fieldgroup_id_set: bool,
) -> dict:
    """Raises UploadSessionNotFoundError / FieldNotFoundError as appropriate."""
    from src.errors import FieldNotFoundError, UploadSessionNotFoundError

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
    return {
        "id": f.id,
        "field_key": f.field_key,
        "detected_type": f.detected_type.value,
        "override_type": f.override_type.value if f.override_type else None,
        "display_name": f.display_name,
        "sort_order": f.sort_order,
        "upload_fieldgroup_id": f.upload_fieldgroup_id,
    }


async def delete_field(session: AsyncSession, session_id: int, field_id: int) -> None:
    """Raises FieldNotFoundError if field not found or doesn't belong to session."""
    from src.errors import FieldNotFoundError

    deleted = await upload_repo.delete_field(session, session_id, field_id)
    if not deleted:
        raise FieldNotFoundError(field_id)


async def move_field(
    session: AsyncSession, session_id: int, field_id: int, group_id: int | None
) -> dict:
    """Raises FieldNotFoundError if field not found or doesn't belong to session."""
    from src.errors import FieldNotFoundError

    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    f.upload_fieldgroup_id = group_id
    session.add(f)
    await session.flush()
    return {"id": f.id, "upload_fieldgroup_id": f.upload_fieldgroup_id}


async def upsert_level(
    session: AsyncSession,
    session_id: int,
    field_id: int,
    *,
    raw_value: str,
    display_label: str | None,
    sort_order: int,
    is_inherited: bool,
):
    """Raises FieldNotFoundError if field not found or doesn't belong to session."""
    from src.errors import FieldNotFoundError

    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    return await upload_repo.upsert_level(
        session,
        field_id=field_id,
        raw_value=raw_value,
        display_label=display_label,
        sort_order=sort_order,
        is_inherited=is_inherited,
    )


async def delete_level(
    session: AsyncSession, session_id: int, field_id: int, level_id: int
) -> None:
    """Raises FieldNotFoundError or LevelNotFoundError as appropriate."""
    from src.errors import FieldNotFoundError, LevelNotFoundError

    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    deleted = await upload_repo.delete_level(session, field_id, level_id)
    if not deleted:
        raise LevelNotFoundError(level_id)


async def get_field_tree(session: AsyncSession, session_id: int) -> dict:
    """Raises UploadSessionNotFoundError if session not found."""
    from src.errors import UploadSessionNotFoundError

    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    groups = await upload_repo.get_fieldgroups_for_session(session, session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)

    def _group_dict(g) -> dict:
        field_count = sum(1 for f in fields if f.upload_fieldgroup_id == g.id)
        return {
            "id": g.id,
            "name": g.name,
            "parent_id": g.parent_id,
            "sort_order": g.sort_order,
            "field_count": field_count,
        }

    async def _field_to_dict(f) -> dict:
        levels = await upload_repo.get_levels_for_field(session, f.id)
        return {
            "id": f.id,
            "field_key": f.field_key,
            "display_name": f.display_name,
            "detected_type": f.detected_type.value,
            "override_type": f.override_type.value if f.override_type else None,
            "sort_order": f.sort_order,
            "upload_fieldgroup_id": f.upload_fieldgroup_id,
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

    field_dicts = await asyncio.gather(*[_field_to_dict(f) for f in fields])
    return {
        "groups": [_group_dict(g) for g in groups],
        "fields": [d for d in field_dicts if d["upload_fieldgroup_id"] is not None],
        "unassigned_fields": [d for d in field_dicts if d["upload_fieldgroup_id"] is None],
    }


async def create_fieldgroup(
    session: AsyncSession, session_id: int, *, name: str, parent_id: int | None, sort_order: int
) -> dict:
    """Raises UploadSessionNotFoundError if session not found."""
    from src.errors import UploadSessionNotFoundError

    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    grp = await upload_repo.create_upload_fieldgroup(
        session, upload_session_id=session_id, name=name, parent_id=parent_id, sort_order=sort_order
    )
    return {"id": grp.id, "name": grp.name, "parent_id": grp.parent_id, "sort_order": grp.sort_order}


async def update_fieldgroup(
    session: AsyncSession,
    session_id: int,
    group_id: int,
    *,
    name: str | None,
    parent_id: int | None,
    parent_id_set: bool,
    sort_order: int | None,
) -> dict:
    """Raises FieldGroupNotFoundError if group not found in this session."""
    from src.errors import FieldGroupNotFoundError

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
    return {"id": grp.id, "name": grp.name, "parent_id": grp.parent_id}


async def delete_fieldgroup_svc(session: AsyncSession, session_id: int, group_id: int) -> dict:
    """Raises FieldGroupNotFoundError if group not found in this session."""
    from src.errors import FieldGroupNotFoundError

    grp = await upload_repo.get_fieldgroup_by_id_and_session(session, group_id, session_id)
    if grp is None:
        raise FieldGroupNotFoundError(group_id)
    await upload_repo.delete_fieldgroup(session, grp)
    return {"deleted": group_id}
```

Note: `delete_fieldgroup_svc` is named with `_svc` suffix to avoid shadowing the route function `delete_fieldgroup` when both are in scope.

Also add `import asyncio` to the top of `upload_service.py` if not already present.

- [ ] **Step 4: Run tests**

Run: `just test-api`
Expected: all pass (services added but routes not yet updated)

- [ ] **Step 5: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(api): add upload_service field, level, and group management methods
```
Stage: `apps/api/src/services/upload_service.py apps/api/tests/test_uploads.py`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 6: Add upload_service reconciliation orchestration methods

**Files:**
- Modify: `apps/api/src/services/upload_service.py`

Extract the `trigger_reconcile`, `list_reconcile_rows`, `get_reconcile_counts`, `resolve_row`, and `bulk_resolve` route logic into the service.

- [ ] **Step 1: Add reconciliation methods to upload_service.py**

Add the following imports to `apps/api/src/services/upload_service.py` (add to existing import block):
```python
from src.models.field import Field, FieldType
from src.models.level import Level as LiveLevel
from src.models.reconciliation import ReconciliationGroup, ReconciliationStatus
from src.repositories import dataset_repo, reconciliation_repo, upload_repo
from src.services import reconciliation_service
```
(replace existing separate repo/service imports with this combined set)

Then append to `apps/api/src/services/upload_service.py`:

```python
async def trigger_reconcile(
    session: AsyncSession, session_id: int, reference_dataset_id: int
) -> dict:
    """Raises UploadSessionNotFoundError if session not found."""
    from src.errors import UploadSessionNotFoundError

    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)

    new_fields = await upload_repo.get_fields_for_session(session, session_id)
    new_levels_by_field: dict[int, list] = {}
    for f in new_fields:
        new_levels_by_field[f.id] = await upload_repo.get_levels_for_field(session, f.id)

    ref_fields_raw = await dataset_repo.get_fields_with_levels(session, reference_dataset_id)
    ref_by_key = {f.field_key: (f, lvls) for f, lvls in ref_fields_raw}

    rows_to_create: list[dict] = []
    matched_ref_keys: set[str] = set()

    for uf in new_fields:
        stub = Field(
            field_key=uf.field_key,
            display_name=uf.field_key,
            field_type=uf.override_type or uf.detected_type,
            dataset_id=0,
        )
        best_ref = None
        best_ref_lvls: list = []
        if uf.field_key in ref_by_key:
            best_ref, best_ref_lvls = ref_by_key[uf.field_key]
        else:
            for key, (rf, rl) in ref_by_key.items():
                d = reconciliation_service.edit_distance(uf.field_key, key)
                if d < 4:
                    best_ref, best_ref_lvls = rf, rl
                    break

        upload_lvls = new_levels_by_field.get(uf.id, [])
        stub_lvls = [
            LiveLevel(value=ul.raw_value, display_label=ul.raw_value, sort_order=ul.sort_order, field_id=0)
            for ul in upload_lvls
        ]
        result = reconciliation_service.classify_row(stub, stub_lvls, best_ref, best_ref_lvls)
        if best_ref:
            matched_ref_keys.add(best_ref.field_key)
        rows_to_create.append(
            {
                "upload_session_id": session_id,
                "upload_field_id": uf.id,
                "ref_field_id": best_ref.id if best_ref else None,
                "group": result.group,
                "status": result.status,
                "confidence": result.confidence,
                "note": result.note,
            }
        )

    for key, (rf, _) in ref_by_key.items():
        if key not in matched_ref_keys:
            rows_to_create.append(
                {
                    "upload_session_id": session_id,
                    "upload_field_id": None,
                    "ref_field_id": rf.id,
                    "group": ReconciliationGroup.old_only,
                    "status": ReconciliationStatus.pending,
                    "confidence": None,
                    "note": "Present in reference, absent in new file",
                }
            )

    await reconciliation_repo.bulk_create_rows(session, rows_to_create)
    sess.reference_dataset_id = reference_dataset_id
    session.add(sess)
    await session.flush()
    return {"total": len(rows_to_create)}


async def list_reconcile_rows(
    session: AsyncSession,
    session_id: int,
    group: ReconciliationGroup | None,
    after_id: int | None,
    page_size: int,
) -> dict:
    rows = await reconciliation_repo.get_rows_page(
        session, session_id, group=group, after_id=after_id, page_size=page_size
    )
    next_cursor = rows[-1].id if len(rows) == page_size else None

    upload_field_ids = [r.upload_field_id for r in rows if r.upload_field_id]
    ref_field_ids = [r.ref_field_id for r in rows if r.ref_field_id]
    uf_map = {u.id: u for u in await upload_repo.get_upload_fields_by_ids(session, upload_field_ids) if u.id}
    rf_map = {f.id: f for f in await dataset_repo.get_fields_by_ids(session, ref_field_ids) if f.id}

    return {
        "items": [
            {
                "id": r.id,
                "group": r.group,
                "status": r.status,
                "upload_field_id": r.upload_field_id,
                "ref_field_id": r.ref_field_id,
                "field_key": uf_map[r.upload_field_id].field_key
                    if r.upload_field_id and r.upload_field_id in uf_map else None,
                "field_type": (
                    uf_map[r.upload_field_id].override_type
                    or uf_map[r.upload_field_id].detected_type
                ).value
                    if r.upload_field_id and r.upload_field_id in uf_map else None,
                "ref_field_key": rf_map[r.ref_field_id].field_key
                    if r.ref_field_id and r.ref_field_id in rf_map else None,
                "confidence": r.confidence,
                "note": r.note,
            }
            for r in rows
        ],
        "next_cursor": next_cursor,
    }


async def get_reconcile_counts(session: AsyncSession, session_id: int) -> dict:
    """Raises UploadSessionNotFoundError if session not found."""
    from src.errors import UploadSessionNotFoundError

    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    group_counts = await reconciliation_repo.get_counts_by_group(session, session_id)
    status_counts = await reconciliation_repo.get_status_counts(session, session_id)
    blocking_pending = await reconciliation_repo.get_blocking_pending_count(session, session_id)
    return {**group_counts, "status_counts": status_counts, "blocking_pending": blocking_pending}


async def resolve_reconcile_row(
    session: AsyncSession,
    session_id: int,
    row_id: int,
    status: ReconciliationStatus,
    ref_field_id: int | None,
    upload_field_id: int | None,
) -> dict:
    """Raises LevelNotFoundError (reused as RowNotFoundError) if row not found."""
    from src.errors import LevelNotFoundError

    row = await reconciliation_repo.resolve_row(
        session, row_id, status, ref_field_id=ref_field_id, upload_field_id=upload_field_id
    )
    if row is None:
        raise LevelNotFoundError(row_id)
    return {"id": row.id, "status": row.status, "upload_field_id": row.upload_field_id, "ref_field_id": row.ref_field_id}


async def bulk_resolve_rows(
    session: AsyncSession, session_id: int, ids: list[int], action: ReconciliationStatus
) -> dict:
    resolved = await reconciliation_repo.bulk_resolve(session, session_id, ids, action)
    return {"resolved": resolved}
```

Note on `resolve_reconcile_row`: it raises `LevelNotFoundError` as a stand-in for "row not found". If the naming feels wrong, add `ReconciliationRowNotFoundError` to `errors.py` first (follow the same pattern as other errors).

- [ ] **Step 2: Run full suite**

Run: `just test-api`
Expected: all pass

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(api): add upload_service reconciliation orchestration methods
```
Stage: `apps/api/src/services/upload_service.py`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 7: Update uploads.py route handlers to use services

**Files:**
- Modify: `apps/api/src/routes/uploads.py`
- Test: `apps/api/tests/test_uploads.py`

This is the largest route update. Replace every direct repo/SQL call in `uploads.py` with service method calls. After this task, no route handler (except list endpoints with no entity ID) may call a repo directly.

- [ ] **Step 1: Run existing tests first (baseline)**

Run: `just test-api`
Expected: all pass. Note the count.

- [ ] **Step 2: Update imports in uploads.py**

Replace the current import block in `apps/api/src/routes/uploads.py` with:
```python
import os
from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.errors import (
    FieldGroupNotFoundError,
    FieldNotFoundError,
    LevelNotFoundError,
    UploadSessionNotFoundError,
)
from src.models.reconciliation import ReconciliationGroup, ReconciliationStatus
from src.repositories import reconciliation_repo, upload_repo
from src.services import upload_service
from src.services.upload_service import InvalidFileTypeError

router = APIRouter(tags=["uploads"])
```

Note: `reconciliation_repo` and `upload_repo` stay for the two list endpoints (`list_upload_sessions` and `get_reconcile_ids`) which are CRUD-passthrough list endpoints (no entity ID, allowed by pattern).

- [ ] **Step 3: Replace get_upload_session route**

Replace the entire `get_upload_session` function:
```python
@router.get("/uploads/{session_id}")
async def get_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await upload_service.get_upload_session(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
```

- [ ] **Step 4: Replace discard_upload_session route**

```python
@router.delete("/uploads/{session_id}", status_code=204)
async def discard_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    """Mark an upload session as abandoned (soft delete)."""
    try:
        await upload_service.discard_session(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
```

- [ ] **Step 5: Replace override_field route**

The route currently uses a `FieldOverride` Pydantic model. Keep the model, update the handler:
```python
@router.patch("/uploads/{session_id}/fields/{field_id}")
async def override_field(
    session_id: int,
    field_id: int,
    body: FieldOverride,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.override_field(
            session,
            session_id,
            field_id,
            override_type=body.override_type,
            display_name=body.display_name,
            upload_fieldgroup_id=body.upload_fieldgroup_id,
            sort_order=body.sort_order,
            fieldgroup_id_set="upload_fieldgroup_id" in body.model_fields_set,
        )
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None
```

- [ ] **Step 6: Replace delete_field route**

```python
@router.delete("/uploads/{upload_session_id}/fields/{field_id}", status_code=204)
async def delete_field(
    upload_session_id: int,
    field_id: int,
    session: AsyncSession = Depends(get_session),
):
    try:
        await upload_service.delete_field(session, upload_session_id, field_id)
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None
```

- [ ] **Step 7: Replace trigger_reconcile route**

```python
@router.post("/uploads/{session_id}/reconcile")
async def trigger_reconcile(
    session_id: int,
    body: ReconcileTrigger,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.trigger_reconcile(session, session_id, body.reference_dataset_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
```

- [ ] **Step 8: Replace list_reconcile_rows route**

```python
@router.get("/uploads/{session_id}/reconcile")
async def list_reconcile_rows(
    session_id: int,
    group: ReconciliationGroup | None = None,
    after_id: int | None = None,
    page_size: int = 50,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.list_reconcile_rows(session, session_id, group, after_id, page_size)
```

- [ ] **Step 9: Replace get_reconcile_counts route**

```python
@router.get("/uploads/{session_id}/reconcile/counts")
async def get_reconcile_counts(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await upload_service.get_reconcile_counts(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
```

- [ ] **Step 10: Replace get_suggested_reference route**

```python
@router.get("/uploads/{session_id}/suggested-reference")
async def get_suggested_reference(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await upload_service.get_suggested_reference(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
```

- [ ] **Step 11: Replace resolve_reconcile_row route**

```python
@router.patch("/uploads/{session_id}/reconcile/{row_id}")
async def resolve_reconcile_row(
    session_id: int,
    row_id: int,
    body: RowResolve,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.resolve_reconcile_row(
            session, session_id, row_id, body.status,
            ref_field_id=body.ref_field_id, upload_field_id=body.upload_field_id,
        )
    except LevelNotFoundError:
        raise HTTPException(status_code=404, detail="Row not found") from None
```

- [ ] **Step 12: Replace bulk_resolve_rows route**

```python
@router.post("/uploads/{session_id}/reconcile/bulk")
async def bulk_resolve_rows(
    session_id: int,
    body: BulkResolve,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.bulk_resolve_rows(session, session_id, body.ids, body.action)
```

- [ ] **Step 13: Replace commit_upload_session route**

```python
@router.post("/uploads/{session_id}/commit", status_code=201)
async def commit_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        dataset_id = await upload_service.commit(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"dataset_id": dataset_id}
```

- [ ] **Step 14: Replace get_field_tree route**

```python
@router.get("/uploads/{session_id}/field-tree")
async def get_field_tree(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await upload_service.get_field_tree(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
```

- [ ] **Step 15: Replace create_fieldgroup route**

```python
@router.post("/uploads/{session_id}/fieldgroups", status_code=201)
async def create_fieldgroup(
    session_id: int,
    body: FieldGroupCreate,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.create_fieldgroup(
            session, session_id, name=body.name, parent_id=body.parent_id, sort_order=body.sort_order
        )
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
```

- [ ] **Step 16: Replace update_fieldgroup route**

```python
@router.patch("/uploads/{session_id}/fieldgroups/{group_id}")
async def update_fieldgroup(
    session_id: int,
    group_id: int,
    body: FieldGroupUpdate,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.update_fieldgroup(
            session, session_id, group_id,
            name=body.name,
            parent_id=body.parent_id,
            parent_id_set="parent_id" in body.model_fields_set,
            sort_order=body.sort_order,
        )
    except FieldGroupNotFoundError:
        raise HTTPException(status_code=404, detail="Group not found") from None
```

- [ ] **Step 17: Replace delete_fieldgroup route**

```python
@router.delete("/uploads/{session_id}/fieldgroups/{group_id}")
async def delete_fieldgroup(
    session_id: int,
    group_id: int,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.delete_fieldgroup_svc(session, session_id, group_id)
    except FieldGroupNotFoundError:
        raise HTTPException(status_code=404, detail="Group not found") from None
```

- [ ] **Step 18: Replace upsert_level_route**

```python
@router.put("/uploads/{upload_session_id}/fields/{field_id}/levels")
async def upsert_level_route(
    upload_session_id: int,
    field_id: int,
    body: LevelUpsert,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.upsert_level(
            session, upload_session_id, field_id,
            raw_value=body.raw_value,
            display_label=body.display_label,
            sort_order=body.sort_order,
            is_inherited=body.is_inherited,
        )
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None
```

- [ ] **Step 19: Replace delete_level_route**

```python
@router.delete(
    "/uploads/{upload_session_id}/fields/{field_id}/levels/{level_id}",
    status_code=204,
)
async def delete_level_route(
    upload_session_id: int,
    field_id: int,
    level_id: int,
    session: AsyncSession = Depends(get_session),
):
    try:
        await upload_service.delete_level(session, upload_session_id, field_id, level_id)
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None
    except LevelNotFoundError:
        raise HTTPException(status_code=404, detail="Level not found") from None
```

- [ ] **Step 20: Replace move_field route**

```python
@router.patch("/uploads/{session_id}/fields/{field_id}/move")
async def move_field(
    session_id: int,
    field_id: int,
    body: FieldMove,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.move_field(session, session_id, field_id, body.upload_fieldgroup_id)
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None
```

- [ ] **Step 21: Remove unused imports from uploads.py**

After all replacements, `uploads.py` should no longer import `asyncio`, `select`, `update`, `Dataset`, `Field`, `FieldType`, `LiveLevel`, `UploadField`, `UploadFieldGroup`, `dataset_repo`, `commit_service`, `reconciliation_service`. Remove those imports.

Also remove `reconciliation_repo` if `get_reconcile_ids` is the only remaining use — check if that route still calls `reconciliation_repo.get_all_ids` directly (it's a list endpoint with no entity ID, so CRUD passthrough is allowed; keep the import).

- [ ] **Step 22: Run full test suite**

Run: `just test-api`
Expected: all pass (same count as baseline in Step 1, plus 3 new tests from Tasks 4-5)

Fix any failures before continuing.

- [ ] **Step 23: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(api): refactor uploads.py routes to delegate all logic to upload_service
```
Stage: `apps/api/src/routes/uploads.py`
Commit: `git commit -F /tmp/commit-msg.txt`

---

## Part 2 — Frontend: Typed API client + design tokens

### Task 8: Add warning and success design tokens

**Files:**
- Modify: `apps/web/src/lib/theme.ts`
- Modify: `docs/patterns/design-system.md`

The upload wizard uses `bg-green-*/bg-amber-*` with `dark:` overrides for status badges. Replace with semantic tokens.

- [ ] **Step 1: Find where tokens are generated**

Read `apps/web/src/lib/theme.ts` and locate the `generateThemeCSS` function. It builds `:root` and `.dark` CSS variable blocks.

- [ ] **Step 2: Add success and warning tokens**

Inside `generateThemeCSS`, add to both `:root` and `.dark` blocks:

In `:root` block:
```css
--success: oklch(0.45 0.15 145deg);
--success-foreground: oklch(0.98 0.01 145deg);
--success-subtle: oklch(0.95 0.04 145deg);
--warning: oklch(0.55 0.15 75deg);
--warning-foreground: oklch(0.35 0.12 75deg);
--warning-subtle: oklch(0.96 0.04 75deg);
```

In `.dark` block:
```css
--success: oklch(0.65 0.15 145deg);
--success-foreground: oklch(0.15 0.05 145deg);
--success-subtle: oklch(0.25 0.06 145deg);
--warning: oklch(0.72 0.14 75deg);
--warning-foreground: oklch(0.20 0.08 75deg);
--warning-subtle: oklch(0.25 0.06 75deg);
```

- [ ] **Step 3: Document tokens in design-system.md**

Add to the colour tokens table in `docs/patterns/design-system.md`:

```markdown
| `bg-[--success]` / `text-[--success]` | Status indicators: confirmed, accepted, complete |
| `bg-[--success-subtle]` | Soft success badge backgrounds |
| `text-[--success-foreground]` | Text on success-subtle backgrounds |
| `bg-[--warning]` / `text-[--warning]` | Status indicators: pending, needs action |
| `bg-[--warning-subtle]` | Soft warning badge backgrounds |
| `text-[--warning-foreground]` | Text on warning-subtle backgrounds |
```

Usage pattern:
```tsx
// Soft success badge
<span className="rounded bg-[--success-subtle] px-1.5 py-0.5 text-xs font-semibold text-[--success-foreground]">
  Confirmed
</span>
// Soft warning badge
<span className="rounded bg-[--warning-subtle] px-1.5 py-0.5 text-xs font-semibold text-[--warning-foreground]">
  Pending
</span>
```

- [ ] **Step 4: Verify typecheck passes**

Run: `just typecheck`
Expected: no new errors

- [ ] **Step 5: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(web): add success/warning design tokens to theme system
```
Stage: `apps/web/src/lib/theme.ts docs/patterns/design-system.md`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 9: Migrate DatasetsPage — replace fetch + fix dark: overrides

**Files:**
- Modify: `apps/web/src/app/datasets/DatasetsPage.tsx`

Three `fetch()` calls: list upload sessions, delete upload session, delete dataset. Two `dark:` overrides on amber status badge.

- [ ] **Step 1: Replace `fetch` calls**

The file already imports `import { api } from "@/lib/api"`. The three `fetch()` calls are at:

**Line ~45** — list upload sessions:
```tsx
// BEFORE
const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
fetch(`${base}/api/v1/uploads`)
  .then((r) => r.json())
  .then((data) => setDrafts(data.items ?? []))

// AFTER
api.GET("/api/v1/uploads" as never).then(({ data }: any) => {
  if (data) setDrafts((data as any).items ?? [])
})
```

**Line ~90** — delete dataset:
```tsx
// BEFORE
await fetch(`${baseUrl}/api/v1/datasets/${id}`, { method: "DELETE" })

// AFTER
await api.DELETE("/api/v1/datasets/{dataset_id}" as never, {
  params: { path: { dataset_id: id } },
} as any)
```

**Line ~184** — discard upload session:
```tsx
// BEFORE
await fetch(`${base}/api/v1/uploads/${d.id}`, { method: "DELETE" })

// AFTER
await api.DELETE("/api/v1/uploads/{session_id}" as never, {
  params: { path: { session_id: d.id } },
} as any)
```

Note: The upload endpoints currently return untyped `dict` responses (no `response_model`), so their TypeScript types are `any`-like. The `as never` / `as any` casts are needed until those routes get proper `response_model` declarations — this is acceptable as a migration step.

- [ ] **Step 2: Replace dark: overrides on the amber pending badge**

Find lines with `dark:border-amber-700 dark:bg-amber-950/30` and `dark:bg-amber-800 dark:text-amber-200`.

Replace:
```tsx
// BEFORE
className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700 dark:bg-amber-950/30"
```
With:
```tsx
className="flex items-center justify-between rounded-lg border border-[--warning] bg-[--warning-subtle] px-4 py-3 text-sm"
```

Replace the inner badge span:
```tsx
// BEFORE
<span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 font-semibold text-amber-800 text-xs dark:bg-amber-800 dark:text-amber-200">
```
With:
```tsx
<span className="ml-2 rounded-full bg-[--warning-subtle] px-2 py-0.5 font-semibold text-[--warning-foreground] text-xs">
```

Also remove the `const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"` declaration if it's no longer used after the migration.

- [ ] **Step 3: Typecheck**

Run: `just typecheck`
Expected: no new errors (the `as never`/`as any` casts suppress type mismatches from untyped endpoints)

- [ ] **Step 4: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(web): migrate DatasetsPage fetch() to typed API client; replace dark: amber overrides
```
Stage: `apps/web/src/app/datasets/DatasetsPage.tsx`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 10: Migrate Step1FileHierarchy — replace fetch() calls

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx`

Five `fetch()` calls: list packages, get package collections, create package, create collection, create upload (multipart POST).

- [ ] **Step 1: Add api import**

At the top of the file add:
```tsx
import { api } from "@/lib/api"
```

- [ ] **Step 2: Replace list packages fetch**

```tsx
// BEFORE
fetch(`${API_BASE}/api/v1/packages`)
  .then((r) => r.json())
  .then((data) => setPackages(data ?? []))

// AFTER
api.GET("/api/v1/packages" as never).then(({ data }: any) => {
  if (data) setPackages(data ?? [])
})
```

- [ ] **Step 3: Replace get package collections fetch**

```tsx
// BEFORE
fetch(`${API_BASE}/api/v1/packages/${selectedPackageId}`)
  .then((r) => r.json())
  .then((pkg) => setCollections(pkg?.collections ?? []))

// AFTER
api.GET("/api/v1/packages/{package_id}" as never, {
  params: { path: { package_id: selectedPackageId } },
} as any).then(({ data }: any) => {
  if (data) setCollections((data as any)?.collections ?? [])
})
```

- [ ] **Step 4: Replace create package fetch**

```tsx
// BEFORE
const res = await fetch(`${API_BASE}/api/v1/packages`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: pkgName, slug: pkgName.toLowerCase().replace(/\s+/g, "-") }),
})
const pkg = await res.json()

// AFTER
const { data: pkg } = await api.POST("/api/v1/packages" as never, {
  body: { name: pkgName, slug: pkgName.toLowerCase().replace(/\s+/g, "-") },
} as any)
```

- [ ] **Step 5: Replace create collection fetch**

```tsx
// BEFORE
const res = await fetch(`${API_BASE}/api/v1/collections`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: colName, package_id: selectedPkgId }),
})
const col = await res.json()

// AFTER
const { data: col } = await api.POST("/api/v1/collections" as never, {
  body: { name: colName, package_id: selectedPkgId },
} as any)
```

- [ ] **Step 6: Replace multipart upload fetch**

The upload POST uses `FormData` (multipart). `openapi-fetch` passes FormData directly:

```tsx
// BEFORE
const res = await fetch(`${API_BASE}/api/v1/uploads`, { method: "POST", body: form })
const data = await res.json()

// AFTER — openapi-fetch passes FormData as-is when body is not a plain object
const { data } = await (api as any).POST("/api/v1/uploads", { body: form })
```

- [ ] **Step 7: Remove API_BASE constant if no longer used**

Delete: `const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`

- [ ] **Step 8: Typecheck**

Run: `just typecheck`
Expected: no new errors

- [ ] **Step 9: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(web): migrate Step1FileHierarchy fetch() to typed API client
```
Stage: `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 11: Migrate Step4MetadataEditor — replace fetch() calls

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx`

Seven `fetch()` calls: load field tree, move field, create group, delete group, move group (patch group parent_id), rename group (patch name), update group sort_order.

- [ ] **Step 1: Add api import**

```tsx
import { api } from "@/lib/api"
```

- [ ] **Step 2: Replace loadTree fetch**

```tsx
// BEFORE
const res = await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/field-tree`)
const data = await res.json()

// AFTER
const { data } = await (api as any).GET(`/api/v1/uploads/${state.sessionId}/field-tree`)
```

- [ ] **Step 3: Replace handleMoveField fetch**

```tsx
// BEFORE
await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/fields/${fieldId}/move`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ upload_fieldgroup_id: groupId }),
})

// AFTER
await (api as any).PATCH(`/api/v1/uploads/${state.sessionId}/fields/${fieldId}/move`, {
  body: { upload_fieldgroup_id: groupId },
})
```

- [ ] **Step 4: Replace handleCreateGroup fetch**

```tsx
// BEFORE
await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/fieldgroups`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, parent_id: parentId }),
})

// AFTER
await (api as any).POST(`/api/v1/uploads/${state.sessionId}/fieldgroups`, {
  body: { name, parent_id: parentId },
})
```

- [ ] **Step 5: Replace handleDeleteGroup fetch**

```tsx
// BEFORE
await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/fieldgroups/${id}`, {
  method: "DELETE",
})

// AFTER
await (api as any).DELETE(`/api/v1/uploads/${state.sessionId}/fieldgroups/${id}`)
```

- [ ] **Step 6: Replace handleMoveGroup fetch**

```tsx
// BEFORE
await fetch(`${API_BASE}/api/v1/uploads/${state.sessionId}/fieldgroups/${groupId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ parent_id: parentId }),
})

// AFTER
await (api as any).PATCH(`/api/v1/uploads/${state.sessionId}/fieldgroups/${groupId}`, {
  body: { parent_id: parentId },
})
```

- [ ] **Step 7: Replace any remaining group fetch calls (rename, sort)**

Apply the same `(api as any).PATCH(url, { body })` pattern to any remaining PATCH fieldgroup calls in the file.

- [ ] **Step 8: Remove API_BASE constant**

- [ ] **Step 9: Typecheck and commit**

Run: `just typecheck`

Write to `/tmp/commit-msg.txt`:
```
fix(web): migrate Step4MetadataEditor fetch() to typed API client
```
Stage: `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 12: Migrate Step3Reconciliation + ReconciliationRow — fetch + design tokens

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx`

Eight `fetch()` calls in Step3Reconciliation, two in ReconciliationRow. Also replace all `bg-green-*/bg-amber-*` raw colour classes with design tokens in ReconciliationRow and Step3Reconciliation.

- [ ] **Step 1: Add api import to both files**

In both `Step3Reconciliation.tsx` and `ReconciliationRow.tsx`:
```tsx
import { api } from "@/lib/api"
```

- [ ] **Step 2: Replace all fetch() calls in Step3Reconciliation**

Apply the `(api as any).GET/POST/PATCH` pattern to each call. Key URLs:
- `GET .../suggested-reference` → `(api as any).GET(...)`
- `GET .../reconcile/counts` → `(api as any).GET(...)`
- `GET .../field-tree` → `(api as any).GET(...)`
- `POST .../reconcile` → `(api as any).POST(..., { body: { reference_dataset_id } })`
- `GET .../reconcile?${params}` → `(api as any).GET(..., { params: { query: { group, after_id, page_size } } })`
- `PATCH .../reconcile/${rowId}` → `(api as any).PATCH(..., { body: { status, ... } })`
- `POST .../reconcile/bulk` → `(api as any).POST(..., { body: { ids, action } })`

For each, replace `.then(r => r.json())` with destructured `{ data }` from the api call.

- [ ] **Step 3: Replace group status colour map in ReconciliationRow**

Find the colour map:
```tsx
const GROUP_COLOURS: Record<ReconGroup, string> = {
  exact: "bg-green-500",
  probable: "bg-amber-500",
  new_only: "bg-blue-500",
  old_only: "bg-gray-500",
}
```

Replace with design tokens:
```tsx
const GROUP_COLOURS: Record<ReconGroup, string> = {
  exact: "bg-[--success]",
  probable: "bg-[--warning]",
  new_only: "bg-primary",
  old_only: "bg-muted-foreground",
}
```

- [ ] **Step 4: Replace status badge classes in ReconciliationRow**

Find the status badge colour map with `bg-green-100 text-green-800` etc.:
```tsx
// BEFORE
auto_accepted: "bg-green-100 text-green-800",
pending: "bg-amber-100 text-amber-800",
confirmed: "bg-green-100 text-green-800",
```

Replace with design tokens:
```tsx
auto_accepted: "bg-[--success-subtle] text-[--success-foreground]",
pending: "bg-[--warning-subtle] text-[--warning-foreground]",
confirmed: "bg-[--success-subtle] text-[--success-foreground]",
```

Apply the same replacement to any inline `bg-green-100 text-green-800 hover:bg-green-200` class strings in ReconciliationRow or Step3Reconciliation — replace with `bg-[--success-subtle] text-[--success-foreground] hover:bg-[--success]/20`.

- [ ] **Step 5: Replace fetch() calls in ReconciliationRow**

Two PATCH calls to `.../reconcile/${row.id}`. Replace with `(api as any).PATCH(...)`.

- [ ] **Step 6: Remove API_BASE from both files**

- [ ] **Step 7: Typecheck**

Run: `just typecheck`

- [ ] **Step 8: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(web): migrate Step3Reconciliation/ReconciliationRow to typed API client and design tokens
```
Stage: `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx apps/web/src/app/datasets/upload/steps/ReconciliationRow.tsx`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 13: Migrate FieldEditorPanel + Step5ReviewCommit — fetch + dark: fixes

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`

- [ ] **Step 1: Add api import to both files**

```tsx
import { api } from "@/lib/api"
```

- [ ] **Step 2: Replace fetch() in FieldEditorPanel (4 calls)**

- `DELETE .../levels/${levelId}` → `(api as any).DELETE(...)`
- `PATCH .../fields/${field.id}` (override_type, display_name, sort_order) → `(api as any).PATCH(..., { body })`
- `PATCH .../fields/${field.id}/move` → `(api as any).PATCH(..., { body })`
- `PUT .../levels` → `(api as any).PUT(..., { body })`

- [ ] **Step 3: Fix dark: overrides in FieldEditorPanel**

Find `bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300` (inherited badge):
```tsx
// BEFORE
? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"

// AFTER
? "bg-[--success-subtle] text-[--success-foreground]"
: "bg-[--warning-subtle] text-[--warning-foreground]"
```

- [ ] **Step 4: Replace fetch() in Step5ReviewCommit (6 calls)**

Apply the same `(api as any).GET/POST` pattern to all calls:
- `GET .../uploads/${sessionId}` → `(api as any).GET(...)`
- `GET .../field-tree` → `(api as any).GET(...)`
- `GET .../reconcile/counts` → `(api as any).GET(...)`
- `GET .../suggested-reference` → `(api as any).GET(...)`
- `GET .../reconcile/ids` → `(api as any).GET(...)`
- `POST .../commit` → `(api as any).POST(...)`

- [ ] **Step 5: Fix dark: overrides in Step5ReviewCommit**

Find `dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200` patterns and replace with design token equivalents (same approach as Task 9 Step 2).

- [ ] **Step 6: Remove API_BASE from both files**

- [ ] **Step 7: Typecheck**

Run: `just typecheck`

- [ ] **Step 8: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(web): migrate FieldEditorPanel/Step5ReviewCommit to typed API client; replace dark: overrides
```
Stage: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 14: Fix raw colour tokens in FieldList + Step2FieldDetection

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldList.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/Step2FieldDetection.tsx`

These files use `bg-green-500`/`bg-amber-500` and `bg-green-100 text-green-800`/`bg-amber-100 text-amber-800` for field detection status badges.

- [ ] **Step 1: Fix FieldList.tsx**

Find:
```tsx
f.display_name ? "bg-green-500" : "bg-amber-500"
```

Replace:
```tsx
f.display_name ? "bg-[--success]" : "bg-[--warning]"
```

- [ ] **Step 2: Fix Step2FieldDetection.tsx**

Find:
```tsx
? "bg-amber-100 text-amber-800"
: "bg-green-100 text-green-800"
```

Replace:
```tsx
? "bg-[--warning-subtle] text-[--warning-foreground]"
: "bg-[--success-subtle] text-[--success-foreground]"
```

- [ ] **Step 3: Typecheck + full lint**

Run: `just typecheck`
Run: `just lint`
Fix any lint warnings.

- [ ] **Step 4: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(web): replace raw green/amber colour classes with design tokens in FieldList and Step2FieldDetection
```
Stage: `apps/web/src/app/datasets/upload/steps/FieldList.tsx apps/web/src/app/datasets/upload/steps/Step2FieldDetection.tsx`
Commit: `git commit -F /tmp/commit-msg.txt`

---

### Task 15: Final verification

- [ ] **Step 1: Run full API test suite**

Run: `just test-api`
Expected: all pass

- [ ] **Step 2: Run typecheck**

Run: `just typecheck`
Expected: no errors

- [ ] **Step 3: Run lint**

Run: `just lint`
Expected: no errors (fix any remaining warnings before proceeding)

- [ ] **Step 4: Start dev server and smoke-test the upload wizard**

Run: `just dev` (starts API + web concurrently)

Manually verify:
1. Navigate to `/datasets` — drafts list loads, dataset delete works
2. Start a new upload — Step 1 (file + collection selection) works
3. Proceed through Steps 2→3 (field detection, reconciliation) — no console errors
4. Step 4 (metadata editor) — field tree loads, move/group operations work
5. Step 5 (review + commit) — summary loads, commit button works

- [ ] **Step 5: No regressions found → done**

If smoke-test reveals regressions, fix them before closing the task.
