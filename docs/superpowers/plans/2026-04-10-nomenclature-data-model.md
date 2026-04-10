# Nomenclature & Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Package → Collection → Dataset → Field → Level hierarchy,
JSONB response storage, DataWorker abstraction, consistency validation, read-only API
endpoints, and seed data for three representative dataset structures.

**Architecture:** All SQLModel models in `src/models/`, read-only repositories in
`src/repositories/`, thin route handlers in `src/routes/`. DataWorker abstraction in
`src/workers/` decouples analytics from storage. Consistency validation is a
service-layer computation in `src/services/collection_service.py`.

**Tech Stack:** FastAPI, SQLModel, SQLAlchemy (session), Alembic, Postgres/JSONB,
pytest with transaction-rollback isolation.

---

## File Map

**Create:**

```
apps/api/src/
  models/
    __init__.py          re-exports all models for Alembic and imports
    package.py           Package SQLModel
    collection.py        Collection SQLModel + CollectionType enum
    dataset.py           Dataset SQLModel + WorkerType enum
    field.py             Field SQLModel + FieldType enum
    level.py             Level SQLModel
    response.py          Response SQLModel (JSONB payload)
  workers/
    __init__.py
    base.py              DataWorker abstract base class
    jsonb_response.py    JsonbResponseWorker
    factory.py           WorkerFactory.for_dataset()
  services/
    __init__.py
    collection_service.py  check_field_consistency() + FieldInconsistency
  repositories/
    __init__.py
    package_repo.py      get_all(), get_by_id()
    collection_repo.py   get_by_id()
    dataset_repo.py      get_by_id(), get_responses()
  routes/
    packages.py          GET /packages, GET /packages/{id}
    collections.py       GET /collections/{id}, GET /collections/{id}/consistency
    datasets.py          GET /datasets/{id}, GET /datasets/{id}/responses
  errors.py              Domain error classes

apps/api/scripts/
  __init__.py
  seed.py                Brand Tracker + Customer Satisfaction + Market Report seeds

apps/api/tests/
  test_packages.py
  test_collections.py
  test_datasets.py
  test_consistency.py
  test_workers.py
```

**Modify:**

```
apps/api/src/main.py          register three new routers
apps/api/migrations/env.py    import all models for Alembic autogenerate
```

**Auto-generated (then edited):**

```
apps/api/migrations/versions/XXXX_create_data_model.py   add GIN index manually
```

---

## Task 1: Domain errors, enums, and all SQLModel models

**Files:**
- Create: `apps/api/src/errors.py`
- Create: `apps/api/src/models/__init__.py`
- Create: `apps/api/src/models/package.py`
- Create: `apps/api/src/models/collection.py`
- Create: `apps/api/src/models/dataset.py`
- Create: `apps/api/src/models/field.py`
- Create: `apps/api/src/models/level.py`
- Create: `apps/api/src/models/response.py`

- [ ] **Step 1: Create domain errors**

```python
# apps/api/src/errors.py
class DomainError(Exception): ...
class PackageNotFoundError(DomainError): ...
class CollectionNotFoundError(DomainError): ...
class DatasetNotFoundError(DomainError): ...
```

- [ ] **Step 2: Create Package model**

```python
# apps/api/src/models/package.py
from datetime import datetime
from sqlmodel import SQLModel, Field


class PackageBase(SQLModel):
    name: str
    slug: str
    description: str | None = None


class Package(PackageBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PackageRead(PackageBase):
    id: int
    created_at: datetime
```

- [ ] **Step 3: Create Collection model**

```python
# apps/api/src/models/collection.py
from datetime import datetime
from enum import Enum
from sqlmodel import SQLModel, Field


class CollectionType(str, Enum):
    survey = "survey"
    market_report = "market_report"
    demographics = "demographics"
    generic = "generic"


class CollectionBase(SQLModel):
    name: str
    slug: str
    description: str | None = None
    collection_type: CollectionType = CollectionType.generic
    package_id: int = Field(foreign_key="package.id")


class Collection(CollectionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CollectionRead(CollectionBase):
    id: int
    created_at: datetime
```

- [ ] **Step 4: Create Dataset model**

`worker_config` is a JSON column (nullable). Import `Column` and `JSON` from
`sqlalchemy` for this — SQLModel doesn't expose a clean JSON column type directly.

```python
# apps/api/src/models/dataset.py
from datetime import date, datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import SQLModel, Field


class WorkerType(str, Enum):
    jsonb_response = "jsonb_response"
    external_table = "external_table"


class DatasetBase(SQLModel):
    name: str
    slug: str
    description: str | None = None
    sort_order: int = 0
    collected_at: date | None = None
    worker_type: WorkerType = WorkerType.jsonb_response
    collection_id: int = Field(foreign_key="collection.id")


class Dataset(DatasetBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    worker_config: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DatasetRead(DatasetBase):
    id: int
    worker_config: dict[str, Any] | None = None
    created_at: datetime
```

- [ ] **Step 5: Create Field model**

`sqlmodel.Field` (the function) is aliased as `sql_field` to avoid shadowing by the
`Field` class name.

```python
# apps/api/src/models/field.py
from datetime import datetime
from enum import Enum

from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel
from sqlmodel import Field as sql_field


class FieldType(str, Enum):
    numeric = "numeric"
    ordinal = "ordinal"
    categorical = "categorical"
    multi_response = "multi_response"


class FieldBase(SQLModel):
    field_key: str
    display_name: str
    field_type: FieldType
    sort_order: int = 0
    is_filterable: bool = True
    dataset_id: int = sql_field(foreign_key="dataset.id")


class Field(FieldBase, table=True):
    __table_args__ = (UniqueConstraint("dataset_id", "field_key"),)
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(default_factory=datetime.utcnow)


class FieldRead(FieldBase):
    id: int
    created_at: datetime
```

- [ ] **Step 6: Create Level model**

```python
# apps/api/src/models/level.py
from datetime import datetime
from sqlmodel import SQLModel, Field


class LevelBase(SQLModel):
    value: str
    display_label: str
    sort_order: int = 0
    field_id: int = Field(foreign_key="field.id")


class Level(LevelBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LevelRead(LevelBase):
    id: int
    created_at: datetime
```

- [ ] **Step 7: Create Response model**

`payload` is a JSON column. In routes, alias FastAPI's `Response` if needed
(`from fastapi import Response as HTTPResponse`).

```python
# apps/api/src/models/response.py
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import SQLModel
from sqlmodel import Field as sql_field


class ResponseBase(SQLModel):
    dataset_id: int = sql_field(foreign_key="dataset.id")
    payload: dict[str, Any] = sql_field(sa_column=Column(JSON, nullable=False))


class Response(ResponseBase, table=True):
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(default_factory=datetime.utcnow)


class ResponseRead(ResponseBase):
    id: int
    created_at: datetime
```

- [ ] **Step 8: Create models `__init__.py`**

```python
# apps/api/src/models/__init__.py
from .collection import Collection, CollectionBase, CollectionRead, CollectionType  # noqa: F401
from .dataset import Dataset, DatasetBase, DatasetRead, WorkerType  # noqa: F401
from .field import Field, FieldBase, FieldRead, FieldType  # noqa: F401
from .level import Level, LevelBase, LevelRead  # noqa: F401
from .package import Package, PackageBase, PackageRead  # noqa: F401
from .response import Response, ResponseBase, ResponseRead  # noqa: F401
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/errors.py apps/api/src/models/
git commit -m "feat(api): add data model entities — Package, Collection, Dataset, Field, Level, Response"
```

---

## Task 2: Alembic migration

**Files:**
- Modify: `apps/api/migrations/env.py`
- Auto-generate + edit: `apps/api/migrations/versions/XXXX_create_data_model.py`

- [ ] **Step 1: Import models in env.py**

Add this import after the existing comment block (line 18):

```python
# apps/api/migrations/env.py  (add after line 18)
from src.models import (  # noqa: F401
    Collection,
    Dataset,
    Field,
    Level,
    Package,
    Response,
)
```

- [ ] **Step 2: Generate migration**

```bash
just db-migration "create data model"
```

Expected: a new file appears in `apps/api/migrations/versions/` named something like
`XXXX_create_data_model.py`. Open it and verify it creates all six tables with the
correct columns.

- [ ] **Step 3: Add GIN index manually**

In the generated migration file, add GIN index creation to `upgrade()` and its
removal to `downgrade()`. Find the `upgrade()` function and add after the last
`op.create_table(...)` call:

```python
# at the end of upgrade():
op.create_index(
    "ix_response_payload_gin",
    "response",
    ["payload"],
    postgresql_using="gin",
)
```

```python
# at the start of downgrade() (before table drops):
op.drop_index("ix_response_payload_gin", table_name="response")
```

- [ ] **Step 4: Run migration**

```bash
just db-migrate
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade ...`

- [ ] **Step 5: Run migration tests**

```bash
just test-api
```

Expected: all three migration tests pass (linear history, model sync, full cycle).
If `alembic check` detects drift, re-examine the generated migration and models.

- [ ] **Step 6: Commit**

```bash
git add apps/api/migrations/
git commit -m "feat(api): add Alembic migration for data model schema"
```

---

## Task 3: DataWorker ABC and JsonbResponseWorker

**Files:**
- Create: `apps/api/src/workers/__init__.py`
- Create: `apps/api/src/workers/base.py`
- Create: `apps/api/src/workers/jsonb_response.py`
- Create: `apps/api/tests/test_workers.py`

- [ ] **Step 1: Write failing worker test**

```python
# apps/api/tests/test_workers.py
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.response import Response
from src.workers.jsonb_response import JsonbResponseWorker


def _seed_worker_dataset(db):
    """Create a minimal dataset with 3 responses."""
    pkg = Package(name="P", slug="p-worker-test")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)
    col = Collection(name="C", slug="c-worker-test", package_id=pkg.id,
                     collection_type=CollectionType.survey)
    db.add(col)
    db.flush()
    db.refresh(col)

    ds = Dataset(name="W1", slug="w1", collection_id=col.id, sort_order=1)
    db.add(ds)
    db.flush()
    db.refresh(ds)

    for payload in [
        {"gender": "Male", "age_group": "18-34"},
        {"gender": "Female", "age_group": "35-54"},
        {"gender": "Male", "age_group": "18-34"},
    ]:
        db.add(Response(dataset_id=ds.id, payload=payload))
    db.flush()
    return ds


def test_jsonb_worker_fetch_all_rows(db):
    ds = _seed_worker_dataset(db)
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(ds.id, field_keys=[], filters={}))
    assert len(rows) == 3


def test_jsonb_worker_fetch_with_field_keys(db):
    ds = _seed_worker_dataset(db)
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(ds.id, field_keys=["gender"], filters={}))
    assert all(set(r.keys()) == {"gender"} for r in rows)


def test_jsonb_worker_fetch_with_filter(db):
    ds = _seed_worker_dataset(db)
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(ds.id, field_keys=[], filters={"gender": "Male"}))
    assert len(rows) == 2
    assert all(r["gender"] == "Male" for r in rows)


def test_jsonb_worker_count(db):
    ds = _seed_worker_dataset(db)
    worker = JsonbResponseWorker(db)
    assert worker.count(ds.id, filters={}) == 3
    assert worker.count(ds.id, filters={"gender": "Female"}) == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_workers.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` — `src.workers` does not exist yet.

- [ ] **Step 3: Create DataWorker ABC**

```python
# apps/api/src/workers/__init__.py
# empty
```

```python
# apps/api/src/workers/base.py
from abc import ABC, abstractmethod
from typing import Any, Iterator


class DataWorker(ABC):
    @abstractmethod
    def fetch(
        self,
        dataset_id: int,
        field_keys: list[str],
        filters: dict[str, Any],
    ) -> Iterator[dict[str, Any]]:
        """Yield normalized rows as {field_key: value}.

        Args:
            dataset_id: the Dataset to query
            field_keys: if non-empty, only include these keys in each row
            filters: {field_key: exact_value} — rows not matching all filters
                     are excluded
        """
        ...

    @abstractmethod
    def count(self, dataset_id: int, filters: dict[str, Any]) -> int:
        """Return count of matching rows — the base value denominator."""
        ...
```

- [ ] **Step 4: Implement JsonbResponseWorker**

```python
# apps/api/src/workers/jsonb_response.py
from typing import Any, Iterator

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.response import Response
from src.workers.base import DataWorker


class JsonbResponseWorker(DataWorker):
    def __init__(self, session: Session) -> None:
        self._session = session

    def fetch(
        self,
        dataset_id: int,
        field_keys: list[str],
        filters: dict[str, Any],
    ) -> Iterator[dict[str, Any]]:
        stmt = select(Response).where(Response.dataset_id == dataset_id)
        for key, value in filters.items():
            stmt = stmt.where(Response.payload[key].astext == str(value))
        rows = self._session.execute(stmt).scalars().all()
        for row in rows:
            if field_keys:
                yield {k: v for k, v in row.payload.items() if k in field_keys}
            else:
                yield dict(row.payload)

    def count(self, dataset_id: int, filters: dict[str, Any]) -> int:
        stmt = select(Response).where(Response.dataset_id == dataset_id)
        for key, value in filters.items():
            stmt = stmt.where(Response.payload[key].astext == str(value))
        return len(self._session.execute(stmt).scalars().all())
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_workers.py -v
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/workers/ apps/api/tests/test_workers.py
git commit -m "feat(api): add DataWorker ABC and JsonbResponseWorker"
```

---

## Task 4: WorkerFactory

**Files:**
- Create: `apps/api/src/workers/factory.py`
- Test: `apps/api/tests/test_workers.py` (extend)

- [ ] **Step 1: Write failing factory test**

Append to `apps/api/tests/test_workers.py`:

```python
from src.models.dataset import WorkerType
from src.workers.factory import WorkerFactory
from src.workers.jsonb_response import JsonbResponseWorker


def test_factory_returns_jsonb_worker_for_default(db):
    ds = _seed_worker_dataset(db)  # worker_type defaults to jsonb_response
    worker = WorkerFactory.for_dataset(ds, db)
    assert isinstance(worker, JsonbResponseWorker)


def test_factory_returns_jsonb_worker_explicitly(db):
    ds = _seed_worker_dataset(db)
    ds.worker_type = WorkerType.jsonb_response
    worker = WorkerFactory.for_dataset(ds, db)
    assert isinstance(worker, JsonbResponseWorker)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_workers.py::test_factory_returns_jsonb_worker_for_default -v
```

Expected: `ImportError` — `src.workers.factory` does not exist.

- [ ] **Step 3: Implement WorkerFactory**

```python
# apps/api/src/workers/factory.py
from sqlalchemy.orm import Session

from src.models.dataset import Dataset, WorkerType
from src.workers.base import DataWorker
from src.workers.jsonb_response import JsonbResponseWorker


class WorkerFactory:
    @staticmethod
    def for_dataset(dataset: Dataset, session: Session) -> DataWorker:
        match dataset.worker_type:
            case WorkerType.jsonb_response:
                return JsonbResponseWorker(session)
            case _:
                # Future: ExternalTableWorker(session, dataset.worker_config)
                return JsonbResponseWorker(session)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_workers.py -v
```

Expected: all 6 worker tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workers/factory.py apps/api/tests/test_workers.py
git commit -m "feat(api): add WorkerFactory"
```

---

## Task 5: Package endpoint

**Files:**
- Create: `apps/api/src/repositories/__init__.py`
- Create: `apps/api/src/repositories/package_repo.py`
- Create: `apps/api/src/routes/packages.py`
- Create: `apps/api/tests/test_packages.py`
- Modify: `apps/api/src/main.py`

- [ ] **Step 1: Write failing package tests**

```python
# apps/api/tests/test_packages.py
from src.models.collection import Collection, CollectionType
from src.models.package import Package


def _make_package(db, name="Test Package", slug="test-package"):
    pkg = Package(name=name, slug=slug)
    db.add(pkg)
    db.flush()
    db.refresh(pkg)
    return pkg


def test_list_packages_empty(client):
    response = client.get("/api/v1/packages")
    assert response.status_code == 200
    assert response.json() == []


def test_list_packages_returns_packages(client, db):
    _make_package(db, "Brand Suite", "brand-suite")
    _make_package(db, "Tracking Studies", "tracking-studies")

    response = client.get("/api/v1/packages")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    slugs = {p["slug"] for p in data}
    assert slugs == {"brand-suite", "tracking-studies"}


def test_get_package_not_found(client):
    response = client.get("/api/v1/packages/99999")
    assert response.status_code == 404


def test_get_package_with_collections(client, db):
    pkg = _make_package(db)
    col = Collection(
        name="Brand Tracker",
        slug="brand-tracker",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    db.flush()

    response = client.get(f"/api/v1/packages/{pkg.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Package"
    assert len(data["collections"]) == 1
    assert data["collections"][0]["name"] == "Brand Tracker"
    assert data["collections"][0]["collection_type"] == "survey"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_packages.py -v
```

Expected: `404 Not Found` or route-not-registered errors (no `/api/v1/packages` yet).

- [ ] **Step 3: Create package repository**

```python
# apps/api/src/repositories/__init__.py
# empty
```

```python
# apps/api/src/repositories/package_repo.py
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.package import Package


def get_all(session: Session) -> list[Package]:
    return session.execute(select(Package)).scalars().all()


def get_by_id(session: Session, package_id: int) -> Package | None:
    return session.execute(
        select(Package).where(Package.id == package_id)
    ).scalars().first()
```

- [ ] **Step 4: Create package route**

```python
# apps/api/src/routes/packages.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlmodel import SQLModel

from src.database import get_session
from src.models.collection import CollectionType
from src.models.package import PackageRead
from src.repositories import package_repo

router = APIRouter(tags=["packages"])


class CollectionSummary(SQLModel):
    id: int
    name: str
    slug: str
    collection_type: CollectionType


class PackageWithCollections(PackageRead):
    collections: list[CollectionSummary] = []


@router.get("/packages", response_model=list[PackageRead])
def list_packages(session: Session = Depends(get_session)):
    return package_repo.get_all(session)


@router.get("/packages/{package_id}", response_model=PackageWithCollections)
def get_package(package_id: int, session: Session = Depends(get_session)):
    pkg = package_repo.get_by_id(session, package_id)
    if pkg is None:
        raise HTTPException(status_code=404, detail="Package not found")
    from sqlalchemy import select
    from src.models.collection import Collection
    collections = session.execute(
        select(Collection).where(Collection.package_id == package_id)
    ).scalars().all()
    return PackageWithCollections(**pkg.model_dump(), collections=collections)
```

- [ ] **Step 5: Register router in main.py**

```python
# apps/api/src/main.py — add after existing router includes
from src.routes import packages

app.include_router(packages.router, prefix="/api/v1")
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_packages.py -v
```

Expected: all 4 package tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/repositories/ apps/api/src/routes/packages.py \
        apps/api/src/main.py apps/api/tests/test_packages.py
git commit -m "feat(api): add packages endpoint"
```

---

## Task 6: Collection endpoint

**Files:**
- Create: `apps/api/src/repositories/collection_repo.py`
- Create: `apps/api/src/routes/collections.py`
- Create: `apps/api/tests/test_collections.py`
- Modify: `apps/api/src/main.py`

*(Consistency endpoint added in Task 8.)*

- [ ] **Step 1: Write failing collection test**

```python
# apps/api/tests/test_collections.py
from datetime import date

from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.package import Package


def _seed_collection(db):
    pkg = Package(name="P", slug="p-col-test")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)

    col = Collection(
        name="Brand Tracker",
        slug="brand-tracker-col-test",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    db.flush()
    db.refresh(col)

    for i, wave_name in enumerate(["Wave 1", "Wave 2"], start=1):
        ds = Dataset(
            name=wave_name,
            slug=f"wave-{i}-col-test",
            collection_id=col.id,
            sort_order=i,
            collected_at=date(2026, i, 1),
        )
        db.add(ds)
    db.flush()
    return col


def test_get_collection_not_found(client):
    response = client.get("/api/v1/collections/99999")
    assert response.status_code == 404


def test_get_collection_with_datasets(client, db):
    col = _seed_collection(db)

    response = client.get(f"/api/v1/collections/{col.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Brand Tracker"
    assert data["collection_type"] == "survey"
    assert len(data["datasets"]) == 2
    sort_orders = [d["sort_order"] for d in data["datasets"]]
    assert sort_orders == sorted(sort_orders)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_collections.py -v
```

Expected: 404 or route-not-registered errors.

- [ ] **Step 3: Create collection repository**

```python
# apps/api/src/repositories/collection_repo.py
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.collection import Collection


def get_by_id(session: Session, collection_id: int) -> Collection | None:
    return session.execute(
        select(Collection).where(Collection.id == collection_id)
    ).scalars().first()
```

- [ ] **Step 4: Create collection route (without consistency)**

```python
# apps/api/src/routes/collections.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlmodel import SQLModel

from src.database import get_session
from src.models.collection import CollectionRead
from src.models.dataset import DatasetRead, WorkerType
from src.repositories import collection_repo

router = APIRouter(tags=["collections"])


class DatasetSummary(SQLModel):
    id: int
    name: str
    slug: str
    sort_order: int
    worker_type: WorkerType


class CollectionWithDatasets(CollectionRead):
    datasets: list[DatasetSummary] = []


@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
def get_collection(collection_id: int, session: Session = Depends(get_session)):
    col = collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    from src.models.dataset import Dataset
    datasets = session.execute(
        select(Dataset)
        .where(Dataset.collection_id == collection_id)
        .order_by(Dataset.sort_order)
    ).scalars().all()
    return CollectionWithDatasets(**col.model_dump(), datasets=datasets)
```

- [ ] **Step 5: Register router in main.py**

```python
# apps/api/src/main.py — add after packages router
from src.routes import collections

app.include_router(collections.router, prefix="/api/v1")
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_collections.py -v
```

Expected: all 2 collection tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/repositories/collection_repo.py \
        apps/api/src/routes/collections.py \
        apps/api/src/main.py apps/api/tests/test_collections.py
git commit -m "feat(api): add collections endpoint"
```

---

## Task 7: Dataset endpoint

**Files:**
- Create: `apps/api/src/repositories/dataset_repo.py`
- Create: `apps/api/src/routes/datasets.py`
- Create: `apps/api/tests/test_datasets.py`
- Modify: `apps/api/src/main.py`

- [ ] **Step 1: Write failing dataset tests**

```python
# apps/api/tests/test_datasets.py
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response


def _seed_dataset(db):
    pkg = Package(name="P", slug="p-ds-test")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)

    col = Collection(name="C", slug="c-ds-test", package_id=pkg.id,
                     collection_type=CollectionType.survey)
    db.add(col)
    db.flush()
    db.refresh(col)

    ds = Dataset(name="Wave 1", slug="wave-1-ds-test",
                 collection_id=col.id, sort_order=1)
    db.add(ds)
    db.flush()
    db.refresh(ds)

    f = Field(field_key="gender", display_name="Gender",
              field_type=FieldType.categorical, dataset_id=ds.id)
    db.add(f)
    db.flush()
    db.refresh(f)

    for i, (val, label) in enumerate([("male", "Male"), ("female", "Female")]):
        db.add(Level(value=val, display_label=label, sort_order=i, field_id=f.id))

    db.add(Response(dataset_id=ds.id, payload={"gender": "male"}))
    db.add(Response(dataset_id=ds.id, payload={"gender": "female"}))
    db.flush()
    return ds


def test_get_dataset_not_found(client):
    response = client.get("/api/v1/datasets/99999")
    assert response.status_code == 404


def test_get_dataset_with_fields_and_levels(client, db):
    ds = _seed_dataset(db)
    response = client.get(f"/api/v1/datasets/{ds.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Wave 1"
    assert len(data["fields"]) == 1
    field = data["fields"][0]
    assert field["field_key"] == "gender"
    assert field["field_type"] == "categorical"
    assert len(field["levels"]) == 2
    level_values = {lv["value"] for lv in field["levels"]}
    assert level_values == {"male", "female"}


def test_get_dataset_responses_paginated(client, db):
    ds = _seed_dataset(db)
    response = client.get(f"/api/v1/datasets/{ds.id}/responses")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["page"] == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_datasets.py -v
```

Expected: route-not-registered errors.

- [ ] **Step 3: Create dataset repository**

```python
# apps/api/src/repositories/dataset_repo.py
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.dataset import Dataset
from src.models.response import Response


def get_by_id(session: Session, dataset_id: int) -> Dataset | None:
    return session.execute(
        select(Dataset).where(Dataset.id == dataset_id)
    ).scalars().first()


def get_responses(
    session: Session, dataset_id: int, page: int = 1, page_size: int = 100
) -> tuple[int, list[Response]]:
    stmt = select(Response).where(Response.dataset_id == dataset_id)
    total = len(session.execute(stmt).scalars().all())
    items = session.execute(
        stmt.offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()
    return total, items
```

- [ ] **Step 4: Create dataset route**

```python
# apps/api/src/routes/datasets.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlmodel import SQLModel

from src.database import get_session
from src.models.dataset import DatasetRead
from src.models.field import FieldRead, FieldType
from src.models.level import LevelRead
from src.models.response import ResponseRead
from src.repositories import dataset_repo

router = APIRouter(tags=["datasets"])


class LevelOut(SQLModel):
    id: int
    value: str
    display_label: str
    sort_order: int


class FieldWithLevels(SQLModel):
    id: int
    field_key: str
    display_name: str
    field_type: FieldType
    sort_order: int
    is_filterable: bool
    levels: list[LevelOut] = []


class DatasetWithFields(DatasetRead):
    fields: list[FieldWithLevels] = []


class ResponsePage(SQLModel):
    total: int
    page: int
    page_size: int
    items: list[ResponseRead]


@router.get("/datasets/{dataset_id}", response_model=DatasetWithFields)
def get_dataset(dataset_id: int, session: Session = Depends(get_session)):
    ds = dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    from src.models.field import Field
    from src.models.level import Level
    fields = session.execute(
        select(Field)
        .where(Field.dataset_id == dataset_id)
        .order_by(Field.sort_order)
    ).scalars().all()
    fields_out = []
    for f in fields:
        levels = session.execute(
            select(Level).where(Level.field_id == f.id).order_by(Level.sort_order)
        ).scalars().all()
        fields_out.append(FieldWithLevels(**f.model_dump(), levels=levels))
    return DatasetWithFields(**ds.model_dump(), fields=fields_out)


@router.get("/datasets/{dataset_id}/responses", response_model=ResponsePage)
def get_dataset_responses(
    dataset_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_session),
):
    ds = dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    total, items = dataset_repo.get_responses(session, dataset_id, page, page_size)
    return ResponsePage(total=total, page=page, page_size=page_size, items=items)
```

- [ ] **Step 5: Register router in main.py**

```python
# apps/api/src/main.py — add after collections router
from src.routes import datasets

app.include_router(datasets.router, prefix="/api/v1")
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_datasets.py -v
```

Expected: all 3 dataset tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/repositories/dataset_repo.py \
        apps/api/src/routes/datasets.py \
        apps/api/src/main.py apps/api/tests/test_datasets.py
git commit -m "feat(api): add datasets endpoint"
```

---

## Task 8: Consistency service and endpoint

**Files:**
- Create: `apps/api/src/services/__init__.py`
- Create: `apps/api/src/services/collection_service.py`
- Create: `apps/api/tests/test_consistency.py`
- Modify: `apps/api/src/routes/collections.py`

- [ ] **Step 1: Write failing consistency tests**

```python
# apps/api/tests/test_consistency.py
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.services.collection_service import (
    FieldInconsistency,
    InconsistencyType,
    check_field_consistency,
)


def _make_collection(db):
    pkg = Package(name="P", slug="p-con-test")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)
    col = Collection(name="C", slug="c-con-test", package_id=pkg.id,
                     collection_type=CollectionType.survey)
    db.add(col)
    db.flush()
    db.refresh(col)
    return col


def _add_dataset(db, col, name, slug, sort_order):
    ds = Dataset(name=name, slug=slug, collection_id=col.id, sort_order=sort_order)
    db.add(ds)
    db.flush()
    db.refresh(ds)
    return ds


def _add_field(db, ds, key, ftype):
    f = Field(field_key=key, display_name=key, field_type=ftype, dataset_id=ds.id)
    db.add(f)
    db.flush()
    db.refresh(f)
    return f


def _add_levels(db, field, values):
    for i, v in enumerate(values):
        db.add(Level(value=v, display_label=v, sort_order=i, field_id=field.id))
    db.flush()


def test_consistent_collection_returns_empty(db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-con", 1)
    ds2 = _add_dataset(db, col, "W2", "w2-con", 2)
    for ds in [ds1, ds2]:
        f = _add_field(db, ds, "gender", FieldType.categorical)
        _add_levels(db, f, ["male", "female"])

    result = check_field_consistency(col.id, db)
    assert result == []


def test_detects_type_mismatch(db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-tm", 1)
    ds2 = _add_dataset(db, col, "W2", "w2-tm", 2)
    _add_field(db, ds1, "score", FieldType.numeric)
    _add_field(db, ds2, "score", FieldType.ordinal)

    result = check_field_consistency(col.id, db)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.type_mismatch in types
    assert all(r.field_key == "score" for r in result)


def test_detects_missing_field(db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-mf", 1)
    ds2 = _add_dataset(db, col, "W2", "w2-mf", 2)
    _add_field(db, ds1, "brand_awareness", FieldType.categorical)
    # ds2 intentionally has no brand_awareness field

    result = check_field_consistency(col.id, db)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.missing_field in types


def test_detects_level_inconsistency(db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-la", 1)
    ds2 = _add_dataset(db, col, "W2", "w2-la", 2)
    f1 = _add_field(db, ds1, "media", FieldType.multi_response)
    f2 = _add_field(db, ds2, "media", FieldType.multi_response)
    _add_levels(db, f1, ["tv", "radio"])
    _add_levels(db, f2, ["tv", "radio", "podcast"])  # podcast added in wave 2

    result = check_field_consistency(col.id, db)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.level_added in types


def test_consistency_endpoint(client, db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-ep", 1)
    ds2 = _add_dataset(db, col, "W2", "w2-ep", 2)
    f1 = _add_field(db, ds1, "score", FieldType.numeric)
    f2 = _add_field(db, ds2, "score", FieldType.ordinal)  # type mismatch

    response = client.get(f"/api/v1/collections/{col.id}/consistency")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert any(item["inconsistency_type"] == "type_mismatch" for item in data)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_consistency.py -v
```

Expected: `ImportError` — `src.services.collection_service` does not exist.

- [ ] **Step 3: Create services package and consistency service**

```python
# apps/api/src/services/__init__.py
# empty
```

```python
# apps/api/src/services/collection_service.py
from dataclasses import dataclass
from enum import Enum

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level


class InconsistencyType(str, Enum):
    type_mismatch = "type_mismatch"
    level_added = "level_added"
    level_removed = "level_removed"
    missing_field = "missing_field"


@dataclass
class FieldInconsistency:
    field_key: str
    inconsistency_type: InconsistencyType
    detail: str


def check_field_consistency(
    collection_id: int, session: Session
) -> list[FieldInconsistency]:
    datasets = session.execute(
        select(Dataset)
        .where(Dataset.collection_id == collection_id)
        .order_by(Dataset.sort_order)
    ).scalars().all()

    if len(datasets) <= 1:
        return []

    # Build {field_key: {dataset_id: (field_type, frozenset[level_values])}}
    field_map: dict[str, dict[int, tuple[FieldType, frozenset[str]]]] = {}
    for ds in datasets:
        fields = session.execute(
            select(Field).where(Field.dataset_id == ds.id)
        ).scalars().all()
        for f in fields:
            levels = session.execute(
                select(Level).where(Level.field_id == f.id)
            ).scalars().all()
            level_values = frozenset(lv.value for lv in levels)
            field_map.setdefault(f.field_key, {})[ds.id] = (f.field_type, level_values)

    dataset_ids = [ds.id for ds in datasets]
    result: list[FieldInconsistency] = []

    for field_key, by_dataset in field_map.items():
        # Missing field
        for did in dataset_ids:
            if did not in by_dataset:
                result.append(FieldInconsistency(
                    field_key=field_key,
                    inconsistency_type=InconsistencyType.missing_field,
                    detail=f"Field '{field_key}' absent from dataset {did}",
                ))

        present = list(by_dataset.values())
        if not present:
            continue

        # Type mismatch
        types = {ft for ft, _ in present}
        if len(types) > 1:
            result.append(FieldInconsistency(
                field_key=field_key,
                inconsistency_type=InconsistencyType.type_mismatch,
                detail=f"Field '{field_key}' has conflicting types: "
                       f"{', '.join(t.value for t in types)}",
            ))

        # Level inconsistency — compare ordered datasets
        ordered_levels = [
            by_dataset[did][1] for did in dataset_ids if did in by_dataset
        ]
        if len(ordered_levels) > 1:
            first = ordered_levels[0]
            for later in ordered_levels[1:]:
                added = later - first
                removed = first - later
                for val in added:
                    result.append(FieldInconsistency(
                        field_key=field_key,
                        inconsistency_type=InconsistencyType.level_added,
                        detail=f"Level '{val}' added in a later dataset for "
                               f"field '{field_key}'",
                    ))
                for val in removed:
                    result.append(FieldInconsistency(
                        field_key=field_key,
                        inconsistency_type=InconsistencyType.level_removed,
                        detail=f"Level '{val}' removed in a later dataset for "
                               f"field '{field_key}'",
                    ))

    return result
```

- [ ] **Step 4: Add consistency endpoint to collections route**

Add to `apps/api/src/routes/collections.py`:

```python
# add after existing CollectionWithDatasets class (SQLModel already imported at top)
class InconsistencyOut(SQLModel):
    field_key: str
    inconsistency_type: str
    detail: str


# add after existing get_collection endpoint
@router.get(
    "/collections/{collection_id}/consistency",
    response_model=list[InconsistencyOut],
)
def get_collection_consistency(
    collection_id: int, session: Session = Depends(get_session)
):
    col = collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    from src.services.collection_service import check_field_consistency
    issues = check_field_consistency(collection_id, session)
    return [
        InconsistencyOut(
            field_key=i.field_key,
            inconsistency_type=i.inconsistency_type.value,
            detail=i.detail,
        )
        for i in issues
    ]
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && uv run --no-env-file pytest tests/test_consistency.py -v
```

Expected: all 5 consistency tests pass.

- [ ] **Step 6: Run full test suite**

```bash
just test-api
```

Expected: all tests pass (health, migrations, workers, packages, collections,
datasets, consistency).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/ apps/api/src/routes/collections.py \
        apps/api/tests/test_consistency.py
git commit -m "feat(api): add consistency validation service and endpoint"
```

---

## Task 9: Seed data

**Files:**
- Create: `apps/api/scripts/__init__.py`
- Create: `apps/api/scripts/seed.py`

- [ ] **Step 1: Create seed script**

The script is idempotent — it checks for the Demo Data package before inserting.

```python
# apps/api/scripts/__init__.py
# empty
```

```python
# apps/api/scripts/seed.py
"""Seed script: just db-seed runs this as `python -m scripts.seed` from apps/api/."""
import random
from datetime import date

from sqlalchemy import select

from src.database import SessionLocal
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response

random.seed(42)


def run():
    session = SessionLocal()
    try:
        _seed(session)
        session.commit()
        print("Seed complete.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _seed(session):
    existing = session.execute(
        select(Package).where(Package.slug == "demo-data")
    ).scalars().first()
    if existing:
        print("Demo Data package already exists — skipping.")
        return

    pkg = Package(name="Demo Data", slug="demo-data",
                  description="Seed data for development and testing")
    session.add(pkg)
    session.flush()
    session.refresh(pkg)

    _seed_brand_tracker(session, pkg.id)
    _seed_customer_satisfaction(session, pkg.id)
    _seed_market_report(session, pkg.id)


# ─── Seed 1: Brand Tracker ────────────────────────────────────────────────────

def _seed_brand_tracker(session, package_id):
    col = Collection(
        name="Brand Tracker", slug="brand-tracker",
        collection_type=CollectionType.survey, package_id=package_id,
        description="Two-wave brand awareness tracker",
    )
    session.add(col)
    session.flush()
    session.refresh(col)

    for wave_num, wave_name, collected in [
        (1, "Wave 1", date(2025, 10, 1)),
        (2, "Wave 2", date(2026, 1, 1)),
    ]:
        ds = Dataset(
            name=wave_name, slug=f"brand-tracker-wave-{wave_num}",
            collection_id=col.id, sort_order=wave_num, collected_at=collected,
        )
        session.add(ds)
        session.flush()
        session.refresh(ds)
        _define_brand_tracker_fields(session, ds.id, wave_num)
        _add_brand_tracker_responses(session, ds.id, wave_num, n=50)


def _define_brand_tracker_fields(session, dataset_id, wave_num):
    fields = [
        ("brand_awareness", "Brand Awareness", FieldType.categorical,
         [("aware", "Aware"), ("not_aware", "Not Aware")]),
        ("brand_rating", "Brand Rating", FieldType.ordinal,
         [("very_poor", "Very Poor"), ("poor", "Poor"), ("neutral", "Neutral"),
          ("good", "Good"), ("excellent", "Excellent")]),
        ("media_used", "Media Used", FieldType.multi_response,
         [("tv", "TV"), ("radio", "Radio"), ("social", "Social Media"),
          ("print", "Print"), ("other", "Other")] +
         ([("podcast", "Podcast")] if wave_num == 2 else [])),
        ("age_group", "Age Group", FieldType.categorical,
         [("18_34", "18–34"), ("35_54", "35–54"), ("55_plus", "55+")]),
        ("gender", "Gender", FieldType.categorical,
         [("male", "Male"), ("female", "Female"),
          ("non_binary", "Non-binary"), ("prefer_not", "Prefer not to say")]),
    ]
    for i, (key, name, ftype, levels) in enumerate(fields):
        f = Field(field_key=key, display_name=name, field_type=ftype,
                  sort_order=i, is_filterable=True, dataset_id=dataset_id)
        session.add(f)
        session.flush()
        session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label,
                              sort_order=j, field_id=f.id))
    session.flush()


def _add_brand_tracker_responses(session, dataset_id, wave_num, n):
    media_options = ["tv", "radio", "social", "print"]
    if wave_num == 2:
        media_options.append("podcast")

    for _ in range(n):
        chosen_media = random.sample(media_options, k=random.randint(1, 3))
        if random.random() < 0.1:
            chosen_media.append("other")

        payload: dict = {
            "brand_awareness": random.choice(["aware", "not_aware"]),
            "brand_rating": random.choice(
                ["very_poor", "poor", "neutral", "good", "excellent"]
            ),
            "media_used": chosen_media,
            "age_group": random.choice(["18_34", "35_54", "55_plus"]),
            "gender": random.choice(["male", "female", "non_binary", "prefer_not"]),
        }
        if "other" in chosen_media:
            payload["media_used_other"] = random.choice(
                ["TikTok", "YouTube", "Newsletter", "Word of mouth"]
            )
        session.add(Response(dataset_id=dataset_id, payload=payload))
    session.flush()


# ─── Seed 2: Customer Satisfaction ───────────────────────────────────────────

def _seed_customer_satisfaction(session, package_id):
    col = Collection(
        name="Customer Satisfaction", slug="customer-satisfaction",
        collection_type=CollectionType.survey, package_id=package_id,
        description="Single-wave customer satisfaction survey",
    )
    session.add(col)
    session.flush()
    session.refresh(col)

    ds = Dataset(
        name="2026 Survey", slug="customer-satisfaction-2026",
        collection_id=col.id, sort_order=1, collected_at=date(2026, 2, 1),
    )
    session.add(ds)
    session.flush()
    session.refresh(ds)
    _define_csat_fields(session, ds.id)
    _add_csat_responses(session, ds.id, n=50)


def _define_csat_fields(session, dataset_id):
    fields = [
        ("overall_satisfaction", "Overall Satisfaction", FieldType.ordinal,
         [("very_dissatisfied", "Very Dissatisfied"),
          ("dissatisfied", "Dissatisfied"),
          ("neutral", "Neutral"),
          ("satisfied", "Satisfied"),
          ("very_satisfied", "Very Satisfied")]),
        ("product_used", "Product Used", FieldType.categorical,
         [("product_a", "Product A"), ("product_b", "Product B"),
          ("product_c", "Product C")]),
        ("issues_experienced", "Issues Experienced", FieldType.multi_response,
         [("delivery", "Delivery"), ("quality", "Quality"),
          ("support", "Support"), ("pricing", "Pricing"), ("other", "Other")]),
    ]
    for i, (key, name, ftype, levels) in enumerate(fields):
        f = Field(field_key=key, display_name=name, field_type=ftype,
                  sort_order=i, is_filterable=(ftype != FieldType.multi_response),
                  dataset_id=dataset_id)
        session.add(f)
        session.flush()
        session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label,
                              sort_order=j, field_id=f.id))

    # NPS score — numeric, no levels
    f = Field(field_key="nps_score", display_name="NPS Score",
              field_type=FieldType.numeric, sort_order=len(fields),
              is_filterable=False, dataset_id=dataset_id)
    session.add(f)
    session.flush()


def _add_csat_responses(session, dataset_id, n):
    issue_options = ["delivery", "quality", "support", "pricing"]
    for _ in range(n):
        issues = random.sample(issue_options, k=random.randint(0, 2))
        if random.random() < 0.08:
            issues.append("other")
        payload: dict = {
            "overall_satisfaction": random.choice([
                "very_dissatisfied", "dissatisfied", "neutral",
                "satisfied", "very_satisfied",
            ]),
            "nps_score": random.randint(0, 10),
            "product_used": random.choice(["product_a", "product_b", "product_c"]),
        }
        if issues:
            payload["issues_experienced"] = issues
            if "other" in issues:
                payload["issues_experienced_other"] = random.choice(
                    ["Too expensive", "Poor UX", "Missing feature"]
                )
        session.add(Response(dataset_id=dataset_id, payload=payload))
    session.flush()


# ─── Seed 3: Market Report ────────────────────────────────────────────────────

def _seed_market_report(session, package_id):
    col = Collection(
        name="Market Share Report", slug="market-share-report",
        collection_type=CollectionType.market_report, package_id=package_id,
        description="Quarterly market share by segment",
    )
    session.add(col)
    session.flush()
    session.refresh(col)

    for period_num, period_name, collected in [
        (1, "Q3 2025", date(2025, 9, 30)),
        (2, "Q4 2025", date(2025, 12, 31)),
    ]:
        ds = Dataset(
            name=period_name, slug=f"market-share-{period_name.lower().replace(' ', '-')}",
            collection_id=col.id, sort_order=period_num, collected_at=collected,
        )
        session.add(ds)
        session.flush()
        session.refresh(ds)
        _define_market_fields(session, ds.id)
        _add_market_responses(session, ds.id, n=30)


def _define_market_fields(session, dataset_id):
    fields_def = [
        ("segment", "Segment", FieldType.categorical,
         [("enterprise", "Enterprise"), ("mid_market", "Mid-market"),
          ("smb", "SMB"), ("consumer", "Consumer")]),
    ]
    for i, (key, name, ftype, levels) in enumerate(fields_def):
        f = Field(field_key=key, display_name=name, field_type=ftype,
                  sort_order=i, is_filterable=True, dataset_id=dataset_id)
        session.add(f)
        session.flush()
        session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label,
                              sort_order=j, field_id=f.id))

    # Numeric fields — no levels
    for i, (key, name) in enumerate(
        [("market_share", "Market Share (%)"), ("growth_rate", "Growth Rate (%)")],
        start=len(fields_def),
    ):
        session.add(Field(field_key=key, display_name=name, field_type=FieldType.numeric,
                          sort_order=i, is_filterable=False, dataset_id=dataset_id))
    session.flush()


def _add_market_responses(session, dataset_id, n):
    segments = ["enterprise", "mid_market", "smb", "consumer"]
    for _ in range(n):
        session.add(Response(dataset_id=dataset_id, payload={
            "segment": random.choice(segments),
            "market_share": round(random.uniform(5.0, 40.0), 1),
            "growth_rate": round(random.uniform(-5.0, 15.0), 1),
        }))
    session.flush()


if __name__ == "__main__":
    run()
```

- [ ] **Step 2: Run seed script**

```bash
just db-seed
```

Expected: `Seed complete.`

- [ ] **Step 3: Smoke-test seed data against API**

Start the API with `just api` in a separate terminal, then:

```bash
curl -s http://localhost:8000/api/v1/packages | python3 -m json.tool
```

Expected: one package ("Demo Data") with three collections.

```bash
curl -s http://localhost:8000/api/v1/collections/1/consistency | python3 -m json.tool
```

Expected: one inconsistency — `level_added` for `media_used` (Podcast in Wave 2).

- [ ] **Step 4: Run full test suite to confirm nothing broke**

```bash
just test-api
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/
git commit -m "feat(api): add seed data — Brand Tracker, Customer Satisfaction, Market Report"
```

---

## Task 10: Generate OpenAPI types and update ROADMAP

**Files:**
- Auto-generate: `packages/shared/api.d.ts`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Ensure API is running**

```bash
just api
```

In a second terminal, confirm the OpenAPI spec is available:

```bash
curl -s http://localhost:8000/openapi.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d['paths'].keys()))"
```

Expected: list includes `/api/v1/packages`, `/api/v1/collections/{collection_id}`, etc.

- [ ] **Step 2: Generate TypeScript types**

```bash
just generate-types
```

Expected: `packages/shared/api.d.ts` updated with new types for Package, Collection,
Dataset, Field, Level, Response, FieldInconsistency etc.

- [ ] **Step 3: Verify no type drift**

```bash
just check-types
```

Expected: exits 0 (no drift detected).

- [ ] **Step 4: Update ROADMAP**

In `docs/ROADMAP.md`, update Sub-project 2 status from `🔜 Next` to `✅ Complete`
and add spec/plan links:

```markdown
| 2 | Nomenclature & Data Model | ✅ Complete | [spec](superpowers/specs/2026-04-10-nomenclature-data-model-design.md) | [plan](superpowers/plans/2026-04-10-nomenclature-data-model.md) |
```

And update Sub-project 3 from `⏳ Pending` to `🔜 Next`.

- [ ] **Step 5: Run complete test suite one final time**

```bash
just test
```

Expected: all pytest and vitest tests pass.

- [ ] **Step 6: Final commit**

```bash
git add packages/shared/api.d.ts docs/ROADMAP.md
git commit -m "chore: generate OpenAPI types and mark Sub-project 2 complete"
```
