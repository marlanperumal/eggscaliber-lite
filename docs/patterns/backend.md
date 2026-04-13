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

For **pure read-only endpoints** with no business logic (no validation, aggregation, cross-entity mutation), routes may call a single repository function directly without an intermediate service. The rule is: **as soon as any business logic appears, introduce a service**.

```python
# ALLOWED — pure read, no business logic
@router.get("/packages", response_model=list[PackageRead])
def list_packages(session: Session = Depends(get_session)):
    return package_repo.get_all(session)

# WRONG — business logic belongs in a service, not the route
@router.get("/packages/{package_id}/summary")
def package_summary(package_id: int, session: Session = Depends(get_session)):
    pkg = package_repo.get_by_id(session, package_id)
    # ← any logic beyond a single repo call belongs in a service
    summary = compute_summary(pkg)
    return summary
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

## Adding Models to Alembic

After adding a new SQLModel `table=True` class, always:

1. Import the model in `migrations/env.py` (see the comment block)
2. Run `just db-migration "describe the change"`
3. Review the generated migration — ensure `downgrade()` reverses `upgrade()` exactly
4. Run `just test-api` to confirm all 3 migration tests pass
