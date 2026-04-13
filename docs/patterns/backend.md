# Backend Patterns

## 3-Layer Architecture

Layer order: `routes/` → `services/` → `repositories/`. No skipping.

## File Naming

- Route files match the resource: `datasets.py`, `collections.py`
- Service files: `dataset_service.py`
- Repository files: `dataset_repo.py`
- Domain error classes defined in `src/errors.py`

## Models

SQLModel is used for both Pydantic validation and SQLAlchemy ORM. Three model variants per entity:

```python
class DatasetBase(SQLModel):
    name: str
    description: str | None = None

class Dataset(DatasetBase, table=True):  # DB model
    id: int | None = Field(default=None, primary_key=True)

class DatasetCreate(DatasetBase): ...    # input schema
class DatasetRead(DatasetBase):          # output schema
    id: int
```

## Error Handling

Define typed errors in `src/errors.py`:

```python
class DomainError(Exception): ...
class DatasetAlreadyExistsError(DomainError): ...
class DatasetNotFoundError(DomainError): ...
```

Routes catch these and map to HTTP codes. Never raise `HTTPException` in services.

## CRUD Passthrough Exception

The CRUD passthrough exception applies to **list endpoints** — endpoints with no entity ID in the path, where there is no existence question. Routes may call a single repository function directly for these.

```python
# ALLOWED — list endpoint, no entity ID, no existence question
@router.get("/packages", response_model=list[PackageRead])
def list_packages(session: Session = Depends(get_session)):
    return package_repo.get_all(session)
```

As soon as an endpoint has an `{entity_id}` path parameter, there is an implicit existence question — use a service.

## Single-entity reads

Single-entity endpoints (those with an `{entity_id}` path parameter) must go through a service:

- **Service** owns existence semantics — it calls the repo, checks for `None`, and raises the appropriate typed domain error from `src/errors.py`
- **Route** only handles HTTP concerns — it calls the service and catches domain errors, mapping them to HTTP status codes

```python
# ROUTE — only HTTP concerns
@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
def get_collection(collection_id: int, session: Session = Depends(get_session)):
    try:
        return collection_service.get_with_datasets(session, collection_id)
    except CollectionNotFoundError:
        raise HTTPException(status_code=404, detail="Collection not found") from None

# SERVICE — owns existence semantics
def get_with_datasets(session: Session, collection_id: int) -> CollectionWithDatasets:
    col = collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise CollectionNotFoundError(collection_id)
    datasets = collection_repo.get_datasets_for_collection(session, collection_id)
    return CollectionWithDatasets(**col.model_dump(), datasets=datasets)
```

Repos return `Model | None` — they never raise and have no opinion on what `None` means.

## Route-specific response schemas

All view schemas live in `src/models/` so they can be shared between routes and services without circular dependencies.

```python
# models/collection.py — shared between routes AND services
class CollectionWithDatasets(CollectionRead):
    datasets: list[DatasetRead] = []

# models/analytics.py — shared between routes AND services
class CrosstabRequest(SQLModel): ...
class CrosstabResponse(SQLModel): ...
```

## Analytics / Orchestration Services

Complex endpoints that coordinate multiple repos, workers, or lower-level services belong in an **orchestration service**. The route handles input validation and error-to-HTTP mapping only; the service owns the logic.

```python
# Route: validates input, calls one service method, maps errors
@router.post("/analytics/crosstab", response_model=CrosstabResponse)
def run_crosstab(request: CrosstabRequest, session: Session = Depends(get_session)):
    if request.row_mode == "nested" and len(request.rows) > 2:
        raise HTTPException(422, "Nested row mode supports at most 2 fields")
    try:
        return analytics_service.run_crosstab(session, request)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")

# Service: owns all orchestration
def run_crosstab(session: Session, request: CrosstabRequest) -> CrosstabResponse:
    dataset = analytics_repo.get_dataset(session, request.dataset_id)
    if dataset is None:
        raise DatasetNotFoundError(request.dataset_id)
    # ... coordinate repos, workers, lower-level services
```

Request/response schemas for complex analytics endpoints live in `src/models/analytics.py` (not in the route file) so that both routes and services can import them without circular dependencies.

## Async vs sync route handlers

Use `def` (sync) for all route handlers. FastAPI runs sync handlers in a thread-pool executor, which is the correct pattern for blocking SQLAlchemy calls. `async def` without any `await` blocks the event loop unnecessarily.

```python
# CORRECT
@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

# WRONG — async with no await blocks the event loop
@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

Only use `async def` when the handler genuinely awaits an async operation (e.g. an async HTTP call or async queue push).

## Adding Models to Alembic

After adding a new SQLModel `table=True` class, always:

1. Import the model in `migrations/env.py` (see the comment block)
2. Run `just db-migration "describe the change"`
3. Review the generated migration — ensure `downgrade()` reverses `upgrade()` exactly
4. Run `just test-api` to confirm all 3 migration tests pass
