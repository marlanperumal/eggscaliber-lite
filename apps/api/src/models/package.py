from datetime import datetime

from sqlmodel import Field, SQLModel


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
