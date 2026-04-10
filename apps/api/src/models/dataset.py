from datetime import date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


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
        default=None, sa_column=Column(JSON, nullable=True)
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DatasetRead(DatasetBase):
    id: int
    worker_config: dict[str, Any] | None = None
    created_at: datetime
