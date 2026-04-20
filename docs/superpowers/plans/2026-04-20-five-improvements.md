# Five Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement five codebase improvements: (1) centralised domain-error middleware, (2) migration safety docs, (3) `useApiError` frontend hook, (4) shared test fixtures, and (5) Storybook patterns documentation.

**Architecture:** The backend gains a single FastAPI exception handler that maps `DomainError` subclasses to a typed `ErrorResponse(status, code, detail)` JSON body; routes are simplified by removing their individual try/except blocks. The frontend gains a `useApiError` hook that narrows the typed error to expose `isNotFound`, `isRetryable`, and `code`. Docs gain migration-safety and Storybook pattern guides.

**Tech Stack:** FastAPI 0.135+, SQLModel, Next.js 16 App Router, TypeScript, Vitest, `@testing-library/react`

---

## File Map

**Create:**
- `apps/api/src/models/error.py` — `ErrorResponse` Pydantic schema
- `apps/web/src/lib/useApiError.ts` — error-shape type guard + state hook
- `apps/web/src/lib/useApiError.test.ts` — Vitest tests for the hook
- `docs/patterns/migrations.md` — reversible/irreversible migration guide
- `docs/patterns/storybook.md` — async state, error-state, mock strategy guide
- `apps/web/src/stories/AsyncPatterns.stories.tsx` — live example story

**Modify:**
- `apps/api/src/errors.py` — add `status_code` + `code` attrs; absorb `InvalidFileTypeError`
- `apps/api/src/main.py` — register `domain_error_handler`
- `apps/api/src/services/upload_service.py` — remove `InvalidFileTypeError` class, update import
- `apps/api/src/routes/packages.py` — remove try/except, drop unused `HTTPException` import
- `apps/api/src/routes/collections.py` — remove try/except, drop unused `HTTPException` import
- `apps/api/src/routes/datasets.py` — remove try/except, drop unused `HTTPException` import
- `apps/api/src/routes/analytics.py` — remove try/except (keep input-validation HTTPExceptions)
- `apps/api/src/routes/uploads.py` — remove try/except DomainError blocks; update `InvalidFileTypeError` import; keep the bare `except Exception` catch-all in `commit_upload_session`
- `apps/api/tests/conftest.py` — add `seeded_package`, `seeded_collection` fixtures
- `docs/patterns/infrastructure.md` — add link to new migrations.md

---

## Task 1 — Add error metadata to DomainError classes

**Files:**
- Modify: `apps/api/src/errors.py`
- Modify: `apps/api/src/services/upload_service.py` (remove class, update import)

- [ ] **Step 1: Write the failing test**

Add to a new file `apps/api/tests/test_error_metadata.py`:

```python
from src.errors import (
    AIServiceError,
    CollectionNotFoundError,
    DatasetNotFoundError,
    FieldGroupNotFoundError,
    FieldNotFoundError,
    InvalidFileTypeError,
    LevelNotFoundError,
    PackageNotFoundError,
    ReconciliationRowNotFoundError,
    UploadSessionNotFoundError,
)


def test_all_domain_errors_have_metadata():
    cases = [
        (PackageNotFoundError, 404, "package_not_found"),
        (CollectionNotFoundError, 404, "collection_not_found"),
        (DatasetNotFoundError, 404, "dataset_not_found"),
        (UploadSessionNotFoundError, 404, "upload_session_not_found"),
        (FieldNotFoundError, 404, "field_not_found"),
        (FieldGroupNotFoundError, 404, "field_group_not_found"),
        (LevelNotFoundError, 404, "level_not_found"),
        (ReconciliationRowNotFoundError, 404, "reconciliation_row_not_found"),
        (AIServiceError, 502, "ai_service_error"),
        (InvalidFileTypeError, 422, "invalid_file_type"),
    ]
    for cls, expected_status, expected_code in cases:
        err = cls()
        assert err.status_code == expected_status, f"{cls.__name__}.status_code"
        assert err.code == expected_code, f"{cls.__name__}.code"
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
just test-api -k test_all_domain_errors_have_metadata
```

Expected: FAIL — `AttributeError: 'PackageNotFoundError' object has no attribute 'status_code'` (or `ImportError: cannot import name 'InvalidFileTypeError' from 'src.errors'`)

- [ ] **Step 3: Replace `apps/api/src/errors.py` with the updated version**

```python
class DomainError(Exception):
    status_code: int = 500
    code: str = "internal_error"


class PackageNotFoundError(DomainError):
    status_code = 404
    code = "package_not_found"


class CollectionNotFoundError(DomainError):
    status_code = 404
    code = "collection_not_found"


class DatasetNotFoundError(DomainError):
    status_code = 404
    code = "dataset_not_found"


class UploadSessionNotFoundError(DomainError):
    status_code = 404
    code = "upload_session_not_found"


class FieldNotFoundError(DomainError):
    status_code = 404
    code = "field_not_found"


class FieldGroupNotFoundError(DomainError):
    status_code = 404
    code = "field_group_not_found"


class LevelNotFoundError(DomainError):
    status_code = 404
    code = "level_not_found"


class ReconciliationRowNotFoundError(DomainError):
    status_code = 404
    code = "reconciliation_row_not_found"


class AIServiceError(DomainError):
    status_code = 502
    code = "ai_service_error"


class InvalidFileTypeError(DomainError):
    status_code = 422
    code = "invalid_file_type"
```

- [ ] **Step 4: Remove `InvalidFileTypeError` from `upload_service.py` and update its import**

In `apps/api/src/services/upload_service.py`, find the class definition at line ~62:
```python
class InvalidFileTypeError(Exception): ...
```
Delete that line entirely.

Then update the import block at the top of the file (currently importing from `src.errors`). Add `InvalidFileTypeError` to the existing import:

```python
from src.errors import (
    FieldGroupNotFoundError,
    FieldNotFoundError,
    InvalidFileTypeError,
    LevelNotFoundError,
    ReconciliationRowNotFoundError,
    UploadSessionNotFoundError,
)
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
just test-api -k test_all_domain_errors_have_metadata
```

Expected: PASS

- [ ] **Step 6: Run the full test suite to verify no regressions**

```bash
just test-api
```

Expected: all tests pass (the `uploads.py` route still imports `InvalidFileTypeError` from `upload_service` — fix that in Task 3)

- [ ] **Step 7: Commit**

Write to `/tmp/commit-msg.txt`:
```
feat(api): add status_code + code to DomainError subclasses; move InvalidFileTypeError to errors.py

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Then:
```bash
git add apps/api/src/errors.py apps/api/src/services/upload_service.py apps/api/tests/test_error_metadata.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 2 — Create ErrorResponse model + register exception handler

**Files:**
- Create: `apps/api/src/models/error.py`
- Modify: `apps/api/src/main.py`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/tests/test_error_metadata.py` (extend the existing file):

```python
import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_domain_error_returns_error_response_shape(client: AsyncClient):
    response = await client.get("/api/v1/packages/99999")
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "package_not_found"
    assert body["status"] == 404
    assert "detail" in body
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
just test-api -k test_domain_error_returns_error_response_shape
```

Expected: FAIL — response body is `{"detail": "Package not found"}` (no `code` key)

- [ ] **Step 3: Create `apps/api/src/models/error.py`**

```python
from sqlmodel import SQLModel


class ErrorResponse(SQLModel):
    status: int
    code: str
    detail: str
```

- [ ] **Step 4: Register the exception handler in `apps/api/src/main.py`**

Add these imports at the top (alongside the existing imports):

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
```

Replace the existing `from fastapi import FastAPI` line with the combined import above. Then add the handler registration after `app.add_middleware(...)` and before `app.include_router(...)`:

```python
from src.errors import DomainError
from src.models.error import ErrorResponse


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    detail = exc.code.replace("_", " ").capitalize()
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            status=exc.status_code, code=exc.code, detail=detail
        ).model_dump(),
    )
```

The full `main.py` after changes:

```python
import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastmcp import FastMCP
from fastmcp.server.providers.openapi import MCPType, RouteMap
from fastmcp.utilities.lifespan import combine_lifespans

from src.config import settings
from src.database import lifespan as db_lifespan
from src.errors import DomainError
from src.models.error import ErrorResponse
from src.routes import (
    ai,
    analytics,
    collections,
    datasets,
    health,
    packages,
    scope,
    sentry,
    uploads,
)

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )

app = FastAPI(title="Eggscaliber-Lite API", version="0.1.0", lifespan=db_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    detail = exc.code.replace("_", " ").capitalize()
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            status=exc.status_code, code=exc.code, detail=detail
        ).model_dump(),
    )


app.include_router(health.router, prefix="/api/v1")
app.include_router(sentry.router, prefix="/api/v1")
app.include_router(packages.router, prefix="/api/v1")
app.include_router(scope.router, prefix="/api/v1")
app.include_router(collections.router, prefix="/api/v1")
app.include_router(datasets.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")

mcp = FastMCP.from_fastapi(
    app,
    name="Eggscaliber",
    route_maps=[
        RouteMap(tags={"packages"}, mcp_type=MCPType.TOOL),
        RouteMap(tags={"scope"}, mcp_type=MCPType.TOOL),
        RouteMap(tags={"collections"}, mcp_type=MCPType.TOOL),
        RouteMap(tags={"datasets"}, mcp_type=MCPType.TOOL),
        RouteMap(tags={"analytics"}, mcp_type=MCPType.TOOL),
        RouteMap(mcp_type=MCPType.EXCLUDE),
    ],
)
mcp_app = mcp.http_app(path="/")
app.router.lifespan_context = combine_lifespans(db_lifespan, mcp_app.lifespan)
app.mount("/mcp", mcp_app)
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
just test-api -k test_domain_error_returns_error_response_shape
```

Expected: PASS

- [ ] **Step 6: Run the full test suite to verify no regressions**

```bash
just test-api
```

Expected: all tests pass (routes still have try/except, so errors are still caught per-route — the handler is a belt-and-suspenders addition at this stage)

- [ ] **Step 7: Commit**

Write to `/tmp/commit-msg.txt`:
```
feat(api): add domain-error exception handler returning typed ErrorResponse(status, code, detail)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Then:
```bash
git add apps/api/src/models/error.py apps/api/src/main.py apps/api/tests/test_error_metadata.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 3 — Simplify all routes: remove try/except DomainError blocks

**Files:**
- Modify: `apps/api/src/routes/packages.py`
- Modify: `apps/api/src/routes/collections.py`
- Modify: `apps/api/src/routes/datasets.py`
- Modify: `apps/api/src/routes/analytics.py`
- Modify: `apps/api/src/routes/uploads.py`

The exception handler registered in Task 2 now catches all `DomainError` subclasses. Routes no longer need their individual try/except blocks.

**Critical exception — keep these try/except blocks unchanged:**
1. `uploads.py` → `commit_upload_session`: the bare `except Exception as exc` catch-all (not a DomainError handler — it guards against unexpected errors in the complex commit operation)
2. `analytics.py` → input validation `raise HTTPException(422, ...)` — these are NOT domain errors, keep them

- [ ] **Step 1: Update `apps/api/src/routes/packages.py`**

Replace the entire file:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.database import get_session
from src.models.package import PackageRead, PackageWithCollections
from src.repositories import package_repo
from src.services import package_service

router = APIRouter(tags=["packages"])


class PackageCreate(SQLModel):
    name: str
    slug: str | None = None
    description: str | None = None


@router.post("/packages", response_model=PackageRead, status_code=201)
async def create_package(body: PackageCreate, session: AsyncSession = Depends(get_session)):
    """Create a new package."""
    return await package_service.create_package(
        session, name=body.name, slug=body.slug, description=body.description
    )


@router.get("/packages", response_model=list[PackageRead])
async def list_packages(session: AsyncSession = Depends(get_session)):
    """List all packages (top-level groupings of survey collections)."""
    return await package_repo.get_all(session)


@router.get("/packages/{package_id}", response_model=PackageWithCollections)
async def get_package(package_id: int, session: AsyncSession = Depends(get_session)):
    """Get a package with its collections."""
    return await package_service.get_with_collections(session, package_id)
```

- [ ] **Step 2: Update `apps/api/src/routes/collections.py`**

Replace the entire file:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.collection import (
    CollectionCreate,
    CollectionRead,
    CollectionWithDatasets,
    InconsistencyOut,
)
from src.services import collection_service

router = APIRouter(tags=["collections"])


@router.post("/collections", response_model=CollectionRead, status_code=201)
async def create_collection(body: CollectionCreate, session: AsyncSession = Depends(get_session)):
    """Create a new collection within a package."""
    return await collection_service.create_collection(session, body)


@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
async def get_collection(collection_id: int, session: AsyncSession = Depends(get_session)):
    """Get a collection with all its datasets."""
    return await collection_service.get_with_datasets(session, collection_id)


@router.get(
    "/collections/{collection_id}/consistency",
    response_model=list[InconsistencyOut],
)
async def get_collection_consistency(
    collection_id: int, session: AsyncSession = Depends(get_session)
):
    """List field inconsistencies across datasets in a collection (e.g. mismatched types or labels)."""
    return await collection_service.get_consistency(session, collection_id)
```

- [ ] **Step 3: Update `apps/api/src/routes/datasets.py`**

Replace the entire file:

```python
import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.analytics import FieldTreeOut
from src.models.dataset import DatasetListPage, DatasetWithFields, FieldOut
from src.models.response import ResponsePage
from src.repositories import dataset_repo
from src.services import analytics_service, dataset_service

router = APIRouter(tags=["datasets"])


@router.get("/datasets", response_model=DatasetListPage)
async def list_datasets(
    collection_id: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    """List datasets, optionally filtered by collection_id."""
    total, items = await dataset_repo.list_enriched(
        session, collection_id=collection_id, page=page, page_size=page_size
    )
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/datasets/{dataset_id}", response_model=DatasetWithFields)
async def get_dataset(dataset_id: int, session: AsyncSession = Depends(get_session)):
    """Get a dataset with all its fields and metadata."""
    return await dataset_service.get_with_fields(session, dataset_id)


@router.delete("/datasets/{dataset_id}", status_code=204, response_model=None)
async def delete_dataset(dataset_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a dataset and all associated fields, levels, and responses."""
    await dataset_service.delete_dataset(session, dataset_id)


@router.get("/datasets/{dataset_id}/responses", response_model=ResponsePage)
async def get_dataset_responses(
    dataset_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    """Get paginated raw survey responses for a dataset."""
    return await dataset_service.get_responses(session, dataset_id, page, page_size)


@router.get("/datasets/{dataset_id}/field-tree", response_model=FieldTreeOut)
async def get_field_tree(dataset_id: int, session: AsyncSession = Depends(get_session)):
    """Get the hierarchical field tree for a dataset (groups and fields for use in query builder)."""
    return await analytics_service.get_field_tree(session, dataset_id)


@router.get("/datasets/{dataset_id}/weight-fields", response_model=list[FieldOut])
async def get_weight_fields(dataset_id: int, session: AsyncSession = Depends(get_session)):
    """Get the numeric fields available as weighting variables for a dataset."""
    return await analytics_service.get_weight_fields(session, dataset_id)


@router.get("/datasets/{dataset_id}/download")
# Exception: no response_model — this route returns a StreamingResponse (text/csv file download),
# not JSON. response_model= would conflict with StreamingResponse and is not applicable here.
async def download_dataset_csv(
    dataset_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Stream all responses for a dataset as a CSV file."""
    field_keys, rows = await dataset_service.get_csv_data(session, dataset_id)

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(field_keys)
        yield buf.getvalue()
        for row in rows:
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([row.payload.get(k, "") for k in field_keys])
            yield buf.getvalue()

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="dataset-{dataset_id}.csv"'},
    )
```

- [ ] **Step 4: Update `apps/api/src/routes/analytics.py`**

Remove the try/except around the service calls, but keep the input-validation `raise HTTPException` guards at the top of each handler. Replace the entire file:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.analytics import (
    CrosstabRequest,
    CrosstabResponse,
    TrendRequest,
    TrendResponse,
)
from src.services import analytics_service

router = APIRouter(tags=["analytics"])


@router.post("/analytics/crosstab", response_model=CrosstabResponse)
async def run_crosstab(request: CrosstabRequest, session: AsyncSession = Depends(get_session)):
    """Run a cross-tabulation: rows × columns × optional breakdown, with optional weighting."""
    if request.row_mode == "nested" and len(request.rows) > 2:
        raise HTTPException(422, "Nested row mode supports at most 2 fields")
    if request.row_mode == "stacked" and len(request.rows) > 5:
        raise HTTPException(422, "Stacked row mode supports at most 5 fields")
    if request.col_mode == "nested" and len(request.columns) > 2:
        raise HTTPException(422, "Nested col mode supports at most 2 fields")
    return await analytics_service.run_crosstab(session, request)


@router.post("/analytics/trend", response_model=TrendResponse)
async def run_trend(request: TrendRequest, session: AsyncSession = Depends(get_session)):
    """Run a trend analysis: track a field's distribution across datasets in a collection over time."""
    return await analytics_service.run_trend(session, request)
```

- [ ] **Step 5: Update `apps/api/src/routes/uploads.py`**

Remove all `try/except DomainError` blocks and update the `InvalidFileTypeError` import. The `commit_upload_session` handler keeps its bare `except Exception` catch-all. Replace the top of the file imports section:

Old import (line 41):
```python
from src.services.upload_service import InvalidFileTypeError
```

New import (change to import from `src.errors` instead):
```python
from src.errors import InvalidFileTypeError
```

Then remove all `try:/except XxxNotFoundError:/raise HTTPException(...)` blocks throughout `uploads.py`. The simplified handlers look like:

```python
@router.get("/uploads/{session_id}", response_model=UploadSessionDetail)
async def get_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    return await upload_service.get_upload_session(session, session_id)


@router.patch("/uploads/{session_id}/fields/{field_id}", response_model=UploadFieldOverrideOut)
async def override_field(
    session_id: int,
    field_id: int,
    body: FieldOverride,
    session: AsyncSession = Depends(get_session),
):
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


@router.delete(
    "/uploads/{upload_session_id}/fields/{field_id}", status_code=204, response_model=None
)
async def delete_field(
    upload_session_id: int,
    field_id: int,
    session: AsyncSession = Depends(get_session),
):
    await upload_service.delete_field(session, upload_session_id, field_id)


@router.post("/uploads/{session_id}/reconcile", response_model=ReconcileTriggerOut)
async def trigger_reconcile(
    session_id: int,
    body: ReconcileTrigger,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.trigger_reconcile(
        session, session_id, body.reference_dataset_id
    )


@router.get("/uploads/{session_id}/reconcile/counts", response_model=ReconcileCountsOut)
async def get_reconcile_counts(session_id: int, session: AsyncSession = Depends(get_session)):
    return await upload_service.get_reconcile_counts(session, session_id)


@router.get("/uploads/{session_id}/suggested-reference", response_model=SuggestedReferenceOut)
async def get_suggested_reference(session_id: int, session: AsyncSession = Depends(get_session)):
    return await upload_service.get_suggested_reference(session, session_id)


@router.patch("/uploads/{session_id}/reconcile/{row_id}", response_model=ReconcileRowResolvedOut)
async def resolve_reconcile_row(
    session_id: int,
    row_id: int,
    body: RowResolve,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.resolve_reconcile_row(
        session,
        session_id,
        row_id,
        body.status,
        ref_field_id=body.ref_field_id,
        upload_field_id=body.upload_field_id,
    )


@router.post("/uploads/{session_id}/commit", status_code=201, response_model=CommitOut)
async def commit_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        dataset_id = await upload_service.commit(session, session_id)
    except Exception as exc:
        # Exception: catch-all safety net for commit — the commit service coordinates
        # many sub-operations (migration, reconciliation, dataset creation) and can surface
        # unexpected errors. Prefer typed domain errors for new failure modes here.
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return CommitOut(dataset_id=dataset_id)


@router.get("/uploads/{session_id}/field-tree", response_model=UploadFieldTreeOut)
async def get_field_tree(session_id: int, session: AsyncSession = Depends(get_session)):
    return await upload_service.get_field_tree(session, session_id)


@router.post("/uploads/{session_id}/fieldgroups", status_code=201, response_model=FieldGroupDetail)
async def create_fieldgroup(
    session_id: int,
    body: FieldGroupCreate,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.create_fieldgroup(
        session,
        session_id,
        name=body.name,
        parent_id=body.parent_id,
        sort_order=body.sort_order,
    )


@router.patch("/uploads/{session_id}/fieldgroups/{group_id}", response_model=FieldGroupDetail)
async def update_fieldgroup(
    session_id: int,
    group_id: int,
    body: FieldGroupUpdate,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.update_fieldgroup(
        session,
        session_id,
        group_id,
        name=body.name,
        parent_id=body.parent_id,
        parent_id_set="parent_id" in body.model_fields_set,
        sort_order=body.sort_order,
    )


@router.delete("/uploads/{session_id}/fieldgroups/{group_id}", response_model=DeletedOut)
async def delete_fieldgroup(
    session_id: int,
    group_id: int,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.delete_fieldgroup_svc(session, session_id, group_id)


@router.put(
    "/uploads/{upload_session_id}/fields/{field_id}/levels",
    status_code=200,
    response_model=UploadLevelRead,
)
async def upsert_level_route(
    upload_session_id: int,
    field_id: int,
    body: LevelUpsert,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.upsert_level(
        session,
        upload_session_id,
        field_id,
        raw_value=body.raw_value,
        display_label=body.display_label,
        sort_order=body.sort_order,
        is_inherited=body.is_inherited,
    )


@router.delete(
    "/uploads/{upload_session_id}/fields/{field_id}/levels/{level_id}",
    status_code=204,
    response_model=None,
)
async def delete_level_route(
    upload_session_id: int,
    field_id: int,
    level_id: int,
    session: AsyncSession = Depends(get_session),
):
    await upload_service.delete_level(session, upload_session_id, field_id, level_id)


@router.patch("/uploads/{session_id}/fields/{field_id}/move", response_model=FieldMoveOut)
async def move_field(
    session_id: int,
    field_id: int,
    body: FieldMove,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.move_field(
        session, session_id, field_id, body.upload_fieldgroup_id
    )
```

Also remove the now-unused error imports in the route file header:
```python
# Remove these from uploads.py imports (they are no longer caught in the route):
from src.errors import (
    FieldGroupNotFoundError,
    FieldNotFoundError,
    LevelNotFoundError,
    ReconciliationRowNotFoundError,
    UploadSessionNotFoundError,
)
# Keep only:
from src.errors import InvalidFileTypeError
```

Also check: does `HTTPException` remain needed in uploads.py? Yes — `commit_upload_session` still raises it in the bare `except Exception` block. Keep the `from fastapi import ... HTTPException ...` import.

- [ ] **Step 6: Run the full test suite**

```bash
just test-api
```

Expected: all tests pass

- [ ] **Step 7: Commit**

Write to `/tmp/commit-msg.txt`:
```
refactor(api): remove per-route try/except; domain errors handled by central exception handler

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Then:
```bash
git add apps/api/src/routes/packages.py apps/api/src/routes/collections.py apps/api/src/routes/datasets.py apps/api/src/routes/analytics.py apps/api/src/routes/uploads.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 4 — Add conftest fixtures + error code assertions in tests

**Files:**
- Modify: `apps/api/tests/conftest.py`
- Modify: `apps/api/tests/test_packages.py`
- Modify: `apps/api/tests/test_collections.py`

- [ ] **Step 1: Write a failing test that uses the new fixtures**

Add to `apps/api/tests/test_packages.py` (at the bottom):

```python
async def test_get_package_not_found_returns_error_code(client):
    response = await client.get("/api/v1/packages/99999")
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "package_not_found"
    assert body["status"] == 404


async def test_seeded_package_fixture_is_retrievable(client, seeded_package):
    response = await client.get(f"/api/v1/packages/{seeded_package.id}")
    assert response.status_code == 200
    assert response.json()["name"] == seeded_package.name
```

Add to `apps/api/tests/test_collections.py` (at the bottom):

```python
async def test_get_collection_not_found_returns_error_code(client):
    response = await client.get("/api/v1/collections/99999")
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "collection_not_found"
    assert body["status"] == 404


async def test_seeded_collection_fixture_is_retrievable(client, seeded_collection):
    response = await client.get(f"/api/v1/collections/{seeded_collection.id}")
    assert response.status_code == 200
    assert response.json()["name"] == seeded_collection.name
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
just test-api -k "seeded_package_fixture or seeded_collection_fixture"
```

Expected: FAIL — fixture `seeded_package` not found

- [ ] **Step 3: Add fixtures to `apps/api/tests/conftest.py`**

Add these imports at the top (alongside existing imports):
```python
from src.models.collection import Collection, CollectionType
from src.models.package import Package
```
(These are already imported — do not duplicate them.)

Add at the end of the file:

```python
@pytest_asyncio.fixture
async def seeded_package(db: AsyncSession):
    """A single Package, ready for route-level tests that need only a package."""
    pkg = Package(name="Seeded Package", slug="seeded-pkg-fixture")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    return pkg


@pytest_asyncio.fixture
async def seeded_collection(db: AsyncSession, seeded_package):
    """A Collection under seeded_package, ready for route-level tests."""
    col = Collection(
        name="Seeded Collection",
        slug="seeded-col-fixture",
        package_id=seeded_package.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    return col
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
just test-api -k "seeded_package_fixture or seeded_collection_fixture or error_code"
```

Expected: PASS for all new tests

- [ ] **Step 5: Run the full test suite**

```bash
just test-api
```

Expected: all tests pass

- [ ] **Step 6: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): add seeded_package + seeded_collection fixtures; assert error code shape in 404 tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Then:
```bash
git add apps/api/tests/conftest.py apps/api/tests/test_packages.py apps/api/tests/test_collections.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 5 — Create `useApiError` hook + tests

**Files:**
- Create: `apps/web/src/lib/useApiError.ts`
- Create: `apps/web/src/lib/useApiError.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/useApiError.test.ts`:

```typescript
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { isApiError, useApiError } from "./useApiError"

describe("isApiError", () => {
  it("returns true for a well-formed ApiError", () => {
    expect(isApiError({ status: 404, code: "dataset_not_found", detail: "Dataset not found" })).toBe(
      true,
    )
  })

  it("returns false for null", () => {
    expect(isApiError(null)).toBe(false)
  })

  it("returns false when code is missing", () => {
    expect(isApiError({ status: 404, detail: "something" })).toBe(false)
  })

  it("returns false when status is not a number", () => {
    expect(isApiError({ status: "404", code: "dataset_not_found", detail: "..." })).toBe(false)
  })

  it("returns false for plain strings", () => {
    expect(isApiError("Network Error")).toBe(false)
  })
})

describe("useApiError", () => {
  it("returns isApiError=false and all nulls for non-error input", () => {
    const { result } = renderHook(() => useApiError(null))
    expect(result.current.isApiError).toBe(false)
    expect(result.current.code).toBeNull()
    expect(result.current.detail).toBeNull()
    expect(result.current.isNotFound).toBe(false)
    expect(result.current.isRetryable).toBe(false)
  })

  it("identifies a 404 not-found error", () => {
    const { result } = renderHook(() =>
      useApiError({ status: 404, code: "dataset_not_found", detail: "Dataset not found" }),
    )
    expect(result.current.isApiError).toBe(true)
    expect(result.current.code).toBe("dataset_not_found")
    expect(result.current.detail).toBe("Dataset not found")
    expect(result.current.isNotFound).toBe(true)
    expect(result.current.isRetryable).toBe(false)
  })

  it("identifies all not-found codes", () => {
    const notFoundCodes = [
      "package_not_found",
      "collection_not_found",
      "dataset_not_found",
      "upload_session_not_found",
      "field_not_found",
      "field_group_not_found",
      "level_not_found",
      "reconciliation_row_not_found",
    ]
    for (const code of notFoundCodes) {
      const { result } = renderHook(() => useApiError({ status: 404, code, detail: "" }))
      expect(result.current.isNotFound).toBe(true)
    }
  })

  it("identifies retryable errors", () => {
    for (const status of [408, 429, 502, 503, 504]) {
      const { result } = renderHook(() =>
        useApiError({ status, code: "ai_service_error", detail: "..." }),
      )
      expect(result.current.isRetryable).toBe(true)
    }
  })

  it("returns isRetryable=false for 404", () => {
    const { result } = renderHook(() =>
      useApiError({ status: 404, code: "dataset_not_found", detail: "..." }),
    )
    expect(result.current.isRetryable).toBe(false)
  })

  it("returns isApiError=false for unknown error shape (missing code)", () => {
    const { result } = renderHook(() => useApiError({ message: "Network error" }))
    expect(result.current.isApiError).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
just test-web -t "useApiError"
```

Expected: FAIL — `Cannot find module './useApiError'`

- [ ] **Step 3: Create `apps/web/src/lib/useApiError.ts`**

```typescript
export interface ApiError {
  status: number
  code: string
  detail: string
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "status" in value &&
    "detail" in value &&
    typeof (value as Record<string, unknown>).code === "string" &&
    typeof (value as Record<string, unknown>).status === "number"
  )
}

const NOT_FOUND_CODES = new Set([
  "package_not_found",
  "collection_not_found",
  "dataset_not_found",
  "upload_session_not_found",
  "field_not_found",
  "field_group_not_found",
  "level_not_found",
  "reconciliation_row_not_found",
])

const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504])

export interface ApiErrorState {
  isApiError: boolean
  code: string | null
  detail: string | null
  isNotFound: boolean
  isRetryable: boolean
}

export function useApiError(error: unknown): ApiErrorState {
  if (!isApiError(error)) {
    return { isApiError: false, code: null, detail: null, isNotFound: false, isRetryable: false }
  }
  return {
    isApiError: true,
    code: error.code,
    detail: error.detail,
    isNotFound: NOT_FOUND_CODES.has(error.code),
    isRetryable: RETRYABLE_STATUSES.has(error.status),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
just test-web -t "useApiError"
```

Expected: all tests PASS

- [ ] **Step 5: Run the full frontend test suite**

```bash
just test-web
```

Expected: all tests pass

- [ ] **Step 6: Commit**

Write to `/tmp/commit-msg.txt`:
```
feat(web): add useApiError hook for typed error narrowing (isNotFound, isRetryable, code)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Then:
```bash
git add apps/web/src/lib/useApiError.ts apps/web/src/lib/useApiError.test.ts
git commit -F /tmp/commit-msg.txt
```

---

## Task 6 — Migration safety docs

**Files:**
- Create: `docs/patterns/migrations.md`
- Modify: `docs/patterns/infrastructure.md`

- [ ] **Step 1: Create `docs/patterns/migrations.md`**

```markdown
# Migration Safety Patterns

Supplement to the Alembic setup in `docs/patterns/infrastructure.md`. This guide
covers which schema changes are safe to apply directly and which require a
multi-step strategy to avoid data loss or downtime.

## Reversible vs Irreversible

### Safe — apply in one migration

| Change | Notes |
|--------|-------|
| Add nullable column (`nullable=True` or Python `\| None`) | Default is `NULL`; no data at risk |
| Add index | Non-blocking on Postgres with `CONCURRENTLY` (add manually in migration) |
| Add table | No existing data |
| Rename table | Test `downgrade()` locally — Alembic may not auto-detect renames |
| Increase column width | Safe for text columns |

### Requires multi-step strategy

**Dropping a column** — data is permanently lost on `upgrade()`:
1. Confirm the column is unused in application code (grep across `apps/api/src/`)
2. Document a retention decision in the commit message (e.g. "data archived to S3 before drop" or "column was always NULL")
3. Only then generate the migration

**Adding a NOT NULL column to a non-empty table** — `ALTER TABLE` will fail if existing rows cannot satisfy the constraint:
```
# Step 1: Add nullable column with application-level default
# Step 2: Backfill existing rows (in a separate migration or an `op.execute`)
# Step 3: Add NOT NULL constraint in a third migration
```

Example (three-migration approach):
```python
# migration 001: add nullable
op.add_column("dataset", sa.Column("slug", sa.String(), nullable=True))

# migration 002: backfill
op.execute("UPDATE dataset SET slug = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g')) WHERE slug IS NULL")

# migration 003: constrain
op.alter_column("dataset", "slug", nullable=False)
```

**Renaming a column** — requires coordinated deploy (old name in code, migration, new name in code):
1. Add new column, copy data, update code to write both, deploy
2. Migration: drop old column
3. Code update: remove old-column writes

## Migration Checklist

Before every migration commit:

- [ ] `downgrade()` reverses `upgrade()` exactly — tested locally with `just db-reset`
- [ ] If dropping a column: retention decision documented in commit message
- [ ] If adding NOT NULL: backfill migration exists and ran before constraint migration
- [ ] `just test-api` passes (all 3 migration tests green)
- [ ] For tables with > 1 M rows: tested on a production clone or with `CONCURRENTLY`

## Alembic Autogenerate Gaps

Alembic cannot auto-detect these changes — write them manually in the migration:

- Table or column renames (`op.rename_table`, `op.alter_column(new_column_name=...)`)
- `CREATE INDEX CONCURRENTLY` (autogenerate emits a blocking `CREATE INDEX`)
- Partial indexes (`WHERE` clause)
- Custom Postgres types, sequences, or triggers

## Running Migrations

```bash
just db-migration "describe the change"   # generate from model diff
just db-migrate                            # apply pending migrations
just db-reset                              # wipe + remigrate from scratch (dev only)
```

After any migration: `just test-api` to confirm all 3 migration tests pass.
```

- [ ] **Step 2: Update `docs/patterns/infrastructure.md`**

In the `## Migrations` section, add a link to the new doc at the end of the section:

```markdown
## Migrations

Always generate migrations with `just db-migration "describe change"`. Never write migrations by hand unless autogenerate cannot detect the change. Always implement `downgrade()` — it is tested in CI.

After any model change, run `just test-api` before committing to ensure all 3 migration tests pass.

For reversible vs irreversible changes and the full migration checklist, see [docs/patterns/migrations.md](migrations.md).
```

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
docs(docs): add migration safety patterns — reversible/irreversible guide + checklist

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Then:
```bash
git add docs/patterns/migrations.md docs/patterns/infrastructure.md
git commit -F /tmp/commit-msg.txt
```

---

## Task 7 — Storybook patterns docs + example story

**Files:**
- Create: `docs/patterns/storybook.md`
- Create: `apps/web/src/stories/AsyncPatterns.stories.tsx`
- Modify: `docs/patterns/frontend.md` (add link)

- [ ] **Step 1: Create `docs/patterns/storybook.md`**

```markdown
# Storybook Patterns

Companion to `docs/patterns/frontend.md`. Covers async data, error states, and
mock strategy in Storybook 10 with `@storybook/nextjs-vite`.

## Stories vs Tests — what goes where

| Concern | Where |
|---------|-------|
| Visual states (loading, empty, error, success) | `.stories.tsx` |
| Interaction demos (hover, open menu, fill form) | `.stories.tsx` `play()` |
| Behaviour assertions (`expect(...)`) | `.test.tsx` with Vitest |
| Accessibility (a11y addon) | `.stories.tsx` — a11y must pass on every story |

Stories are for **showing** states; tests are for **asserting** outcomes. Do not
write `expect(...)` calls inside `play()` functions.

## Async Data Fetching — use props, not a real API

Stories run without a backend. Represent async states by defining explicit story
variants that pass the right props directly. Never call `api.GET(...)` inside a
story component.

```tsx
// ✅ Three variants covering all async states
export const Loading: Story = { args: { isLoading: true } }
export const Success: Story = { args: { data: mockData } }
export const Error: Story = { args: { error: "Failed to load — please retry." } }
```

For components that own their own data fetching (e.g. a panel that calls the API
internally), wrap the component with a mock via `parameters.msw` (MSW addon) —
see **Props mock vs MSW** below.

## Error State Coverage

Every component that can display an error must have an `Error` story variant.
Pair it with a `Success` variant so reviewers can compare both states side-by-side.

Name the variant `Error`, `ErrorState`, or `WithError` — use one name consistently
within a component family.

## Props mock vs MSW

| Situation | Mock strategy |
|-----------|---------------|
| Single, isolated UI primitive (`Button`, `Badge`, `Textarea`) | Props only — no network |
| Feature component with internal API calls (`QueryBuilderPanel`, `ReconciliationRow`) | `parameters.msw` from `msw-storybook-addon` |
| Component that receives API data as props from a parent | Props mock on the story, MSW on the parent's story |

## Interaction demos with `play()`

Use `play()` to demonstrate UI interactions — not to assert outcomes:

```tsx
import { userEvent, within } from "@storybook/test"

// ✅ demo: show the menu opening
export const MenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Options" }))
  },
}

// ❌ don't assert in stories — use .test.tsx
export const BadExample: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Submit" }))
    expect(canvas.getByText("Success")).toBeInTheDocument()  // belongs in .test.tsx
  },
}
```

## Accessibility

Every story must pass the a11y addon check. If a story inherits a violation from
a parent layout (e.g. missing skip-link), disable only the specific rule:

```tsx
export const Default: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "skip-link", enabled: false }] } },
  },
}
```

Never disable a11y globally (`parameters: { a11y: { disable: true } }`).
```

- [ ] **Step 2: Create `apps/web/src/stories/AsyncPatterns.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

interface DataCardProps {
  isLoading?: boolean
  data?: { label: string; value: number }[]
  error?: string
}

function DataCard({ isLoading, data, error }: DataCardProps) {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading data"
        className="flex h-32 w-64 items-center justify-center rounded-md border border-border bg-card"
      >
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex h-32 w-64 flex-col items-center justify-center gap-2 rounded-md border border-border bg-card p-4"
      >
        <span className="text-sm text-[--warning]">{error}</span>
        <button className="text-xs text-muted-foreground underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="w-64 rounded-md border border-border bg-card p-4">
      <ul className="space-y-1">
        {(data ?? []).map(({ label, value }) => (
          <li key={label} className="flex justify-between text-sm text-foreground">
            <span>{label}</span>
            <span className="text-muted-foreground">{value}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const meta = {
  title: "Patterns/AsyncDataCard",
  component: DataCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof DataCard>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: { isLoading: true },
}

export const Success: Story = {
  args: {
    data: [
      { label: "Strongly agree", value: 32 },
      { label: "Agree", value: 41 },
      { label: "Neutral", value: 15 },
      { label: "Disagree", value: 8 },
      { label: "Strongly disagree", value: 4 },
    ],
  },
}

export const Error: Story = {
  args: { error: "Failed to load — please retry." },
}

export const Empty: Story = {
  args: { data: [] },
}
```

- [ ] **Step 3: Add a link to the Storybook doc in `docs/patterns/frontend.md`**

In the `## Storybook` section, add at the end:

```markdown
For async data patterns, error-state coverage, play() guidance, and mock strategy,
see [docs/patterns/storybook.md](storybook.md).
```

- [ ] **Step 4: Verify Storybook builds without errors**

```bash
just storybook
```

Navigate to `http://localhost:6006` and verify:
- `Patterns/AsyncDataCard` appears in the sidebar with Loading, Success, Error, Empty variants
- All four stories render without console errors
- a11y panel shows no violations

- [ ] **Step 5: Commit**

Write to `/tmp/commit-msg.txt`:
```
docs(docs,web): add Storybook patterns doc + AsyncDataCard example story

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Then:
```bash
git add docs/patterns/storybook.md apps/web/src/stories/AsyncPatterns.stories.tsx docs/patterns/frontend.md
git commit -F /tmp/commit-msg.txt
```

---

## Self-Review

### Spec coverage
- ✅ Proposal 1 (centralised error handler): Tasks 1–3
- ✅ Proposal 2 (migration safety docs): Task 6
- ✅ Proposal 3 (useApiError hook): Task 5
- ✅ Proposal 4 (shared test fixtures): Task 4
- ✅ Proposal 5 (Storybook patterns doc): Task 7

### Placeholder scan
- No TBDs, TODOs, or "similar to Task N" references found

### Type consistency
- `ErrorResponse` defined in Task 2, used by exception handler in same task — no drift
- `ApiError`, `ApiErrorState`, `isApiError`, `useApiError` defined in Task 5 implementation, matched in tests
- `seeded_package` / `seeded_collection` defined in conftest additions in Task 4, referenced in test additions in same task

### Patterns compliance
- All Python routes keep `response_model=` — no new routes added
- All Python service returns stay typed (`ErrorResponse` is a `SQLModel` subclass)
- `useApiError` returns a plain object, no `as any` casts — type guard narrows `unknown` to `ApiError`
- No raw hex colors or design token violations in `AsyncPatterns.stories.tsx` (`text-[--warning]` is a semantic token, `border-border`/`bg-card`/`text-foreground`/`text-muted-foreground` are all token utilities)
