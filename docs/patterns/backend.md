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
async def list_packages(session: AsyncSession = Depends(get_session)):
    return await package_repo.get_all(session)
```

As soon as an endpoint has an `{entity_id}` path parameter, there is an implicit existence question — use a service.

## Single-entity reads

Single-entity endpoints (those with an `{entity_id}` path parameter) must go through a service:

- **Service** owns existence semantics — it calls the repo, checks for `None`, and raises the appropriate typed domain error from `src/errors.py`
- **Route** only handles HTTP concerns — it calls the service and catches domain errors, mapping them to HTTP status codes

```python
# ROUTE — only HTTP concerns
@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
async def get_collection(collection_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await collection_service.get_with_datasets(session, collection_id)
    except CollectionNotFoundError:
        raise HTTPException(status_code=404, detail="Collection not found") from None

# SERVICE — owns existence semantics
async def get_with_datasets(session: AsyncSession, collection_id: int) -> CollectionWithDatasets:
    col = await collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise CollectionNotFoundError(collection_id)
    datasets = await collection_repo.get_datasets_for_collection(session, collection_id)
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
async def run_crosstab(request: CrosstabRequest, session: AsyncSession = Depends(get_session)):
    if request.row_mode == "nested" and len(request.rows) > 2:
        raise HTTPException(422, "Nested row mode supports at most 2 fields")
    try:
        return await analytics_service.run_crosstab(session, request)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")

# Service: owns all orchestration
async def run_crosstab(session: AsyncSession, request: CrosstabRequest) -> CrosstabResponse:
    dataset = await analytics_repo.get_dataset(session, request.dataset_id)
    if dataset is None:
        raise DatasetNotFoundError(request.dataset_id)
    # ... coordinate repos, workers, lower-level services
```

Request/response schemas for complex analytics endpoints live in `src/models/analytics.py` (not in the route file) so that both routes and services can import them without circular dependencies.

## Async session and query patterns

The app uses `AsyncSession` (SQLAlchemy async) everywhere. The engine and session factory are created inside `lifespan` (not at module level) so they run within the running event loop.

```python
# database.py — engine and session factory live inside lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine, SessionLocal
    engine = create_async_engine(settings.database_url)   # postgresql+asyncpg://
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    yield
    await engine.dispose()   # required — omitting causes "Event loop is closed" warnings

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
```

`expire_on_commit=False` is **required**. Without it, accessing any attribute after `session.commit()` triggers a lazy-load which raises `MissingGreenlet` in async context.

### Repository query patterns

```python
# Fetch many — always wrap .all() in list() so return type is list[T] not Sequence[T]
result = await session.execute(select(Model).where(...))
rows = list(result.scalars().all())

# Fetch one or None
result = await session.execute(select(Model).where(Model.id == id))
row = result.scalars().first()

# Fetch by PK
row = await session.get(Model, id)

# Count
result = await session.execute(select(func.count()).select_from(Model).where(...))
count = result.scalar_one()

# Insert
session.add(obj)
await session.commit()
await session.refresh(obj)   # re-reads generated fields (id, created_at, etc.)

# Delete
await session.delete(obj)
await session.commit()
```

### Route handlers — always `async def`

All route handlers are `async def`. They `await` service calls; services `await` repo calls. The session type annotation is `AsyncSession` (from `sqlalchemy.ext.asyncio`), not `Session`.

```python
@router.get("/datasets/{dataset_id}", response_model=DatasetWithFields)
async def get_dataset(
    dataset_id: int,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await dataset_service.get_with_fields(session, dataset_id)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None
```

### Workers — `async def fetch()` and `count()`

Worker classes accept `AsyncSession` and expose async methods:

```python
class JsonbResponseWorker(DataWorker):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def fetch(self, dataset_id: int, field_keys: list[str], filters: dict[str, Any]) -> list[dict[str, Any]]:
        stmt = select(Response).where(Response.dataset_id == dataset_id)
        rows = (await self._session.execute(stmt)).scalars().all()
        ...

    async def count(self, dataset_id: int, filters: dict[str, Any]) -> int:
        stmt = select(func.count()).select_from(Response).where(Response.dataset_id == dataset_id)
        return (await self._session.execute(stmt)).scalar_one()
```

### Lazy loading is banned

Accessing an unloaded relationship attribute on an `AsyncSession`-loaded object raises `MissingGreenlet` at runtime. The two allowed loading strategies:

**1. Explicit separate queries (current pattern — preferred)**  
Repos do explicit multi-step queries rather than relationship traversal. Keep it this way.

**2. Eager loading with `selectinload` (if a relationship is ever added)**
```python
stmt = select(Dataset).options(selectinload(Dataset.fields))
result = await session.execute(stmt)
```

If a `Relationship()` is ever declared on a model, add `lazy="raise"` so accidental lazy access fails loudly in tests rather than silently in production.

### Prohibited patterns

```python
# NEVER — SQLModel-only method, does not exist on AsyncSession
session.exec(select(Model))

# NEVER — lazy relationship access raises MissingGreenlet
obj = await session.get(Dataset, 1)
obj.fields   # crash if fields not eager-loaded

# NEVER — sync Session type in async route
from sqlalchemy.orm import Session
async def get_dataset(..., session: Session = Depends(get_session)): ...

# NEVER — engine or sessionmaker at module level (must be in lifespan)
engine = create_async_engine(...)   # at module scope — wrong
```

## Type-checking patterns (ty)

### SQLModel primary-key IDs are `int | None`

Table models declare `id: int | None = Field(default=None, primary_key=True)` so SQLAlchemy can auto-assign on INSERT. After a DB fetch the value is always non-`None`, but ty doesn't know that. Use `cast(int, obj.id)` when passing an ORM id to a function or constructor that expects `int`:

```python
from typing import cast

ScopeDataset(id=cast(int, d.id), name=d.name)
await repo.get_by_id(session, cast(int, ds.id))
```

When building a list of IDs to pass into a repo function, filter `None` instead of casting — the filtering is both type-safe and self-documenting:

```python
dataset_ids = [ds.id for ds in datasets if ds.id is not None]
```

### ORM → response model conversion

When a service constructs a response schema from a table model, use `model_validate(obj.model_dump())`. Direct construction or `**model.model_dump()` would pass `id: int | None` into a field typed `id: int`, producing a type error even though it always works at runtime:

```python
# correct — 1:1 field mapping
return [FieldOut.model_validate(f.model_dump()) for f in fields]

# correct — extra fields not in the ORM model (e.g. computed relations)
return DatasetWithFields.model_validate({**ds.model_dump(), "fields": fields_out})

# incorrect — id: int | None assigned to id: int
return [FieldOut(**f.model_dump()) for f in fields]
return DatasetWithFields(**ds.model_dump(), fields=fields_out)  # same problem with extra kwargs
```

### SQLAlchemy ORM false positives

ty 0.0.x can't see through SQLAlchemy's instrumented-attribute descriptor, so column comparisons (`Model.col == value`) and ORM methods (`.in_()`, `.not_in()`) appear to return primitive Python types instead of `ColumnElement`. This affects every `.where()` and `.order_by()` call. These are already downgraded to `warn` in `pyproject.toml` — do not add `# type: ignore` per line; the project-level config is the right suppression point. `# type: ignore` does not suppress `warn`-level diagnostics in ty 0.0.x anyway.

### dict lookups keyed by ORM id

When a dict is built from ORM objects using `setdefault(obj.field_id, ...)` and then looked up with another ORM id (`obj2.id`), annotate the key type as `int | None` to match SQLModel's nullable id fields:

```python
levels_by_field: dict[int | None, list[Level]] = {}
for lv in levels:
    levels_by_field.setdefault(lv.field_id, []).append(lv)
result = levels_by_field.get(f.id, [])  # f.id: int | None — now type-checks
```

## Adding Models to Alembic

After adding a new SQLModel `table=True` class, always:

1. Import the model in `migrations/env.py` (see the comment block)
2. Run `just db-migration "describe the change"`
3. Review the generated migration — ensure `downgrade()` reverses `upgrade()` exactly
4. Run `just test-api` to confirm all 3 migration tests pass
