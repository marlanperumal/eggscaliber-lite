from datetime import UTC, datetime
from enum import StrEnum

from sqlmodel import Field, SQLModel


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
    package_id: int = Field(foreign_key="package.id")


class Collection(CollectionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class CollectionRead(CollectionBase):
    id: int
    created_at: datetime
