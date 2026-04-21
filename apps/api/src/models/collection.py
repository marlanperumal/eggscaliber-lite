from datetime import UTC, datetime
from enum import StrEnum

from sqlmodel import Field, SQLModel

from src.models.dataset import WorkerType


class InconsistencyType(StrEnum):
    type_mismatch = "type_mismatch"
    level_added = "level_added"
    level_removed = "level_removed"
    missing_field = "missing_field"


class CollectionType(StrEnum):
    survey = "survey"
    market_report = "market_report"
    demographics = "demographics"
    generic = "generic"


class CollectionBase(SQLModel):
    name: str
    slug: str
    description: str | None = None
    collection_type: CollectionType = CollectionType.generic


class CollectionCreate(SQLModel):
    name: str
    slug: str | None = None
    description: str | None = None
    collection_type: CollectionType = CollectionType.generic
    package_id: int


class Collection(CollectionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class CollectionRead(CollectionBase):
    id: int
    created_at: datetime


class DatasetSummary(SQLModel):
    id: int
    name: str
    slug: str
    sort_order: int
    worker_type: WorkerType


class CollectionWithDatasets(CollectionRead):
    datasets: list[DatasetSummary] = []


class InconsistencyOut(SQLModel):
    field_key: str
    inconsistency_type: InconsistencyType
    detail: str
