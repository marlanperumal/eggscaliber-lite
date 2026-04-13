from datetime import UTC, datetime

from sqlmodel import Field, SQLModel

from src.models.collection import CollectionType


class PackageBase(SQLModel):
    name: str
    slug: str
    description: str | None = None


class Package(PackageBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class PackageRead(PackageBase):
    id: int
    created_at: datetime


class CollectionSummary(SQLModel):
    id: int
    name: str
    slug: str
    collection_type: CollectionType


class PackageWithCollections(PackageRead):
    collections: list[CollectionSummary] = []
