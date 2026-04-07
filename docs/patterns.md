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
# CORRECT
@router.post("/datasets", status_code=201)
async def create_dataset(
    payload: DatasetCreate,
    session: Session = Depends(get_session),
) -> DatasetRead:
    try:
        return dataset_service.create(session, payload)
    except DatasetAlreadyExistsError:
        raise HTTPException(status_code=409, detail="Dataset already exists")

# WRONG — business logic in route handler
@router.post("/datasets")
async def create_dataset(payload: DatasetCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(Dataset).where(Dataset.name == payload.name)).first()
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
    def create(self, session: Session, payload: DatasetCreate) -> Dataset:
        if dataset_repo.get_by_name(session, payload.name):
            raise DatasetAlreadyExistsError(payload.name)
        return dataset_repo.create(session, payload)
```

### Repositories (`apps/api/src/repositories/`)
- All database queries
- Return domain models (SQLModel instances)
- No business logic

```python
class DatasetRepository:
    def get_by_name(self, session: Session, name: str) -> Dataset | None:
        return session.exec(select(Dataset).where(Dataset.name == name)).first()
```

See full detail: [docs/patterns/backend.md](patterns/backend.md)

## Frontend (Next.js)

See [docs/patterns/frontend.md](patterns/frontend.md)

## Infrastructure

See [docs/patterns/infrastructure.md](patterns/infrastructure.md)
