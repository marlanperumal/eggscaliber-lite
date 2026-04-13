from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Column, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field as sql_field  # noqa: N813
from sqlmodel import SQLModel


class ResponseBase(SQLModel):
    dataset_id: int = sql_field(foreign_key="dataset.id")
    payload: dict[str, Any] = sql_field(sa_column=Column(JSONB, nullable=False))


class Response(ResponseBase, table=True):
    __table_args__ = (Index("ix_response_payload_gin", "payload", postgresql_using="gin"),)
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(default_factory=lambda: datetime.now(UTC))


class ResponseRead(ResponseBase):
    id: int
    created_at: datetime


class ResponsePage(SQLModel):
    total: int
    page: int
    page_size: int
    items: list[ResponseRead]
