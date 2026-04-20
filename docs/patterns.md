# Codebase Patterns

Authoritative index of conventions enforced in this codebase. The `audit-patterns` skill reads this file.

When adding a new library, read its official docs for the installed version and add any relevant conventions here.

## Backend (FastAPI)

Strict 3-layer architecture. **No layer may reach past its immediate neighbour.**

### Route handlers (`apps/api/src/routes/`)
- Validate input with Pydantic/SQLModel schemas
- Call exactly one service method
- Map typed domain errors to HTTP responses
- No business logic, no direct DB access

```python
# CORRECT — domain errors propagate to the central @app.exception_handler(DomainError)
@router.post("/datasets", status_code=201, response_model=DatasetRead)
async def create_dataset(
    payload: DatasetCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new dataset."""
    return await dataset_service.create(session, payload)

# WRONG — business logic in route handler
@router.post("/datasets")
async def create_dataset(payload: DatasetCreate, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Dataset).where(Dataset.name == payload.name))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(...)
```

### Services (`apps/api/src/services/`)
- All business logic lives here
- Raise typed domain errors (not HTTPException)
- No raw SQL, no HTTP concerns

```python
class DatasetAlreadyExistsError(Exception): ...

class DatasetService:
    async def create(self, session: AsyncSession, payload: DatasetCreate) -> Dataset:
        if await dataset_repo.get_by_name(session, payload.name):
            raise DatasetAlreadyExistsError(payload.name)
        return await dataset_repo.create(session, payload)
```

### Repositories (`apps/api/src/repositories/`)
- All database queries
- Return domain models (SQLModel instances)
- No business logic

```python
class DatasetRepository:
    async def get_by_name(self, session: AsyncSession, name: str) -> Dataset | None:
        result = await session.execute(select(Dataset).where(Dataset.name == name))
        return result.scalars().first()
```

See full detail: [docs/patterns/backend.md](patterns/backend.md)

## Frontend (Next.js)

See [docs/patterns/frontend.md](patterns/frontend.md)

## Design System

Colour tokens, typography scale, component inventory, theme config, and
accessibility rules. See [docs/patterns/design-system.md](patterns/design-system.md)

## Infrastructure

See [docs/patterns/infrastructure.md](patterns/infrastructure.md)
