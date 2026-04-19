from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.models.field import FieldType


class WorkerType(StrEnum):
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
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class DatasetRead(DatasetBase):
    id: int
    worker_config: dict[str, Any] | None = None
    created_at: datetime


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


class FieldOut(SQLModel):
    id: int
    field_key: str
    display_name: str
    field_type: FieldType
    sort_order: int
    is_filterable: bool


class DatasetListItem(SQLModel):
    id: int
    name: str
    collection_id: int
    collection_name: str
    package_name: str
    collected_at: str | None
    created_at: str
    field_count: int
    response_count: int
    status: str


class DatasetListPage(SQLModel):
    total: int
    page: int
    page_size: int
    items: list[DatasetListItem]
