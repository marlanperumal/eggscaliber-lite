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

## Adding Models to Alembic

After adding a new SQLModel `table=True` class, always:

1. Import the model in `migrations/env.py` (see the comment block)
2. Run `just db-migration "describe the change"`
3. Review the generated migration — ensure `downgrade()` reverses `upgrade()` exactly
4. Run `just test-api` to confirm all 3 migration tests pass
