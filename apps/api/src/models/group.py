from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import UniqueConstraint
from sqlalchemy.schema import ForeignKeyConstraint
from sqlmodel import Field, SQLModel


class PackageCollectionScope(StrEnum):
    all = "all"
    selected = "selected"


class Group(SQLModel, table=True):
    __tablename__ = "groups"
    __table_args__ = (UniqueConstraint("org_id", "name"),)

    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organisations.id")
    name: str
    is_default: bool = Field(default=False)


class GroupRead(SQLModel):
    id: int
    org_id: int
    name: str
    is_default: bool


class GroupMembership(SQLModel, table=True):
    __tablename__ = "group_memberships"

    group_id: int = Field(foreign_key="groups.id", primary_key=True)
    user_id: int = Field(foreign_key="users.id", primary_key=True)


class GroupPackage(SQLModel, table=True):
    __tablename__ = "group_packages"

    group_id: int = Field(foreign_key="groups.id", primary_key=True)
    package_id: int = Field(foreign_key="package.id", primary_key=True)


class OrgSubscription(SQLModel, table=True):
    __tablename__ = "org_subscriptions"
    __table_args__ = (UniqueConstraint("org_id", "package_id"),)

    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organisations.id")
    package_id: int = Field(foreign_key="package.id")
    start_date: date
    end_date: date | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class OrgSubscriptionRead(SQLModel):
    id: int
    org_id: int
    package_id: int
    start_date: date
    end_date: date | None
    created_at: datetime


class PackageCollection(SQLModel, table=True):
    __tablename__ = "package_collections"

    package_id: int = Field(foreign_key="package.id", primary_key=True)
    collection_id: int = Field(foreign_key="collection.id", primary_key=True)
    scope: PackageCollectionScope = Field(default=PackageCollectionScope.all)


class PackageCollectionRead(SQLModel):
    package_id: int
    collection_id: int
    scope: PackageCollectionScope


class PackageCollectionDataset(SQLModel, table=True):
    __tablename__ = "package_collection_datasets"
    __table_args__ = (
        ForeignKeyConstraint(
            ["package_id", "collection_id"],
            ["package_collections.package_id", "package_collections.collection_id"],
            ondelete="CASCADE",
        ),
    )

    package_id: int = Field(primary_key=True)
    collection_id: int = Field(primary_key=True)
    dataset_id: int = Field(foreign_key="dataset.id", primary_key=True)
