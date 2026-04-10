from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field as sql_field  # noqa: N813
from sqlmodel import SQLModel


class ResponseBase(SQLModel):
    dataset_id: int = sql_field(foreign_key="dataset.id")
    payload: dict[str, Any] = sql_field(sa_column=Column(JSON, nullable=False))


class Response(ResponseBase, table=True):
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(default_factory=datetime.utcnow)


class ResponseRead(ResponseBase):
    id: int
    created_at: datetime
