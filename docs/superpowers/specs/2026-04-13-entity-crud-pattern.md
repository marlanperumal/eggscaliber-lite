# Entity CRUD Pattern

**Date:** 2026-04-13  
**Status:** Ready to implement

## Problem

Several route handlers currently perform existence checks directly:

```python
# datasets.py, collections.py, packages.py — current (wrong) pattern
col = collection_repo.get_by_id(session, collection_id)
if col is None:
    raise HTTPException(status_code=404, detail="Collection not found")
datasets = collection_repo.get_datasets_for_collection(session, collection_id)
return CollectionWithDatasets(**col.model_dump(), datasets=datasets)
```

This is a layer violation. "Does this entity exist?" is a domain concern, not an
HTTP concern. Routes shouldn't inspect `None`.

---

## Pattern

Three rules, applied consistently:

**1. Repos return `Model | None` — never raise, never check**

Repos are pure data access. They report what storage returned. Absence is
represented as `None`. They have no opinion on what `None` means.

**2. Services own not-found semantics — they never return `None` to a caller who
didn't ask for it**

When a service fetches an entity that is required to exist, it checks for `None`
from the repo and raises the appropriate typed domain error from `src/errors.py`.

**3. Routes never check for `None` — they only catch domain errors**

Routes speak in domain errors and HTTP codes. They call a service, catch a typed
error, map it to an HTTP status code.

```python
# ROUTE — only HTTP concerns
@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
async def get_collection(collection_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await collection_service.get_with_datasets(session, collection_id)
    except CollectionNotFoundError:
        raise HTTPException(status_code=404, detail="Collection not found")

# SERVICE — owns existence semantics and fetch logic
async def get_with_datasets(session: AsyncSession, collection_id: int) -> CollectionWithDatasets:
    col = await collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise CollectionNotFoundError(collection_id)
    datasets = await collection_repo.get_datasets_for_collection(session, collection_id)
    return CollectionWithDatasets(**col.model_dump(), datasets=datasets)

# REPO — pure data access, returns None, no opinions
async def get_by_id(session: AsyncSession, collection_id: int) -> Collection | None:
    result = await session.execute(select(Collection).where(Collection.id == collection_id))
    return result.scalars().first()
```

### CRUD passthrough — list endpoints only

The CRUD passthrough exception (route calls repo directly, no service) is valid
**only for list endpoints** — endpoints with no entity ID in the path, where
there is no existence question:

```python
# ALLOWED — no entity ID, no existence question
@router.get("/packages", response_model=list[PackageRead])
async def list_packages(session: AsyncSession = Depends(get_session)):
    return await package_repo.get_all(session)
```

Any endpoint with an `{entity_id}` path parameter has an implicit existence
question and must go through a service.

---

## What changes

### 1. Response schemas move to `src/models/`

Services will return the combined view types, so they can no longer be defined
in route files (circular import). Move each to the relevant model file:

| Current location | Schema | Move to |
|---|---|---|
| `routes/datasets.py` | `LevelOut`, `FieldWithLevels`, `DatasetWithFields`, `FieldOut` | `src/models/dataset.py` |
| `routes/datasets.py` | `ResponsePage` | `src/models/response.py` |
| `routes/collections.py` | `DatasetSummary`, `CollectionWithDatasets` | `src/models/collection.py` |
| `routes/collections.py` | `InconsistencyOut` | `src/models/collection.py` |
| `routes/packages.py` | `CollectionSummary`, `PackageWithCollections` | `src/models/package.py` |

### 2. New service: `src/services/dataset_service.py`

```python
async def get_with_fields(session: AsyncSession, dataset_id: int) -> DatasetWithFields:
    """Raises DatasetNotFoundError if dataset_id does not exist."""

async def get_responses(
    session: AsyncSession, dataset_id: int, page: int, page_size: int
) -> ResponsePage:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
```

### 3. Update `src/services/collection_service.py`

Add two functions:

```python
async def get_with_datasets(session: AsyncSession, collection_id: int) -> CollectionWithDatasets:
    """Raises CollectionNotFoundError if collection_id does not exist."""

async def get_consistency(session: AsyncSession, collection_id: int) -> list[FieldInconsistency]:
    """Raises CollectionNotFoundError if collection_id does not exist.
    Replaces the current route-level existence check before check_field_consistency."""
```

The existing `check_field_consistency` function stays as-is (internal helper).
`get_consistency` wraps it with the existence check.

### 4. New service: `src/services/package_service.py`

```python
async def get_with_collections(session: AsyncSession, package_id: int) -> PackageWithCollections:
    """Raises PackageNotFoundError if package_id does not exist."""
```

### 5. Add analytics service methods for field-tree / weight-fields

`datasets.py` currently calls `analytics_repo` directly from two route handlers.
These belong in `analytics_service` since they use the analytics repo:

```python
# src/services/analytics_service.py — add:
async def get_field_tree(session: AsyncSession, dataset_id: int) -> FieldTreeOut:
    """Raises DatasetNotFoundError if dataset_id does not exist."""

async def get_weight_fields(session: AsyncSession, dataset_id: int) -> list[FieldOut]:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
```

### 6. Update routes

All route handlers that currently do existence checks are rewritten to call
services and catch domain errors.

`src/routes/datasets.py` — 4 handlers:

| Handler | Service call | Domain error caught |
|---|---|---|
| `get_dataset` | `dataset_service.get_with_fields` | `DatasetNotFoundError` → 404 |
| `get_dataset_responses` | `dataset_service.get_responses` | `DatasetNotFoundError` → 404 |
| `get_field_tree` | `analytics_service.get_field_tree` | `DatasetNotFoundError` → 404 |
| `get_weight_fields` | `analytics_service.get_weight_fields` | `DatasetNotFoundError` → 404 |

`src/routes/collections.py` — 2 handlers:

| Handler | Service call | Domain error caught |
|---|---|---|
| `get_collection` | `collection_service.get_with_datasets` | `CollectionNotFoundError` → 404 |
| `get_collection_consistency` | `collection_service.get_consistency` | `CollectionNotFoundError` → 404 |

`src/routes/packages.py` — 1 handler:

| Handler | Service call | Domain error caught |
|---|---|---|
| `get_package` | `package_service.get_with_collections` | `PackageNotFoundError` → 404 |

### 7. Update `docs/patterns/backend.md`

- Remove the "Existence-check + data-fetch variant" sub-section entirely
- Update the CRUD passthrough section to make explicit it only applies to list
  endpoints (no entity ID in path)
- Add a "Single-entity reads" section documenting the service pattern
- Remove the exception comment added to `collections.py` during audit-patterns

---

## Files changed

| File | Change |
|---|---|
| `src/models/dataset.py` | Add `LevelOut`, `FieldWithLevels`, `DatasetWithFields`, `FieldOut` |
| `src/models/response.py` | Add `ResponsePage` |
| `src/models/collection.py` | Add `DatasetSummary`, `CollectionWithDatasets`, `InconsistencyOut` |
| `src/models/package.py` | Add `CollectionSummary`, `PackageWithCollections` |
| `src/services/dataset_service.py` | **New** — `get_with_fields`, `get_responses` |
| `src/services/collection_service.py` | Add `get_with_datasets`, `get_consistency` |
| `src/services/package_service.py` | **New** — `get_with_collections` |
| `src/services/analytics_service.py` | Add `get_field_tree`, `get_weight_fields` |
| `src/routes/datasets.py` | Remove existence checks, call services, remove inline schemas |
| `src/routes/collections.py` | Remove existence checks, call services, remove inline schemas |
| `src/routes/packages.py` | Remove existence checks, call services, remove inline schemas |
| `docs/patterns/backend.md` | Update CRUD passthrough, add single-entity read pattern, remove exception |

`src/errors.py` — no changes needed. All three required errors already exist:
`DatasetNotFoundError`, `CollectionNotFoundError`, `PackageNotFoundError`.

---

## Verification

```
just test-api     # all 53 tests must pass
just typecheck    # no type errors
just lint         # clean
```

The test suite already covers the 404 paths (e.g. `test_get_dataset_not_found`,
`test_get_collection_not_found`, `test_get_package_not_found`) so regressions
will be caught automatically. No new tests are required — the refactor is
behaviour-preserving.

---

## Relationship to async migration

This spec is independent of the async SQLAlchemy migration
(`2026-04-13-async-sqlalchemy-migration.md`). The two can be implemented in
either order or combined into one session. If combined, write all new service
methods as `async def` from the start and save the repo/route conversion pass.

The service signatures above are written in async form on the assumption they
will be implemented alongside or after the async migration. If implementing
before the async migration, use sync `def` and `Session` from `sqlalchemy.orm`
— the signatures are otherwise identical.
