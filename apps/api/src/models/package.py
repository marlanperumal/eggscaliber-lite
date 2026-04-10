from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class PackageBase(SQLModel):
    name: str
    slug: str
    description: str | None = None


class Package(PackageBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class PackageRead(PackageBase):
    id: int
    created_at: datetime
