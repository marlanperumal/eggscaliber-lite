from datetime import UTC, datetime

from sqlmodel import Field as sql_field  # noqa: N813
from sqlmodel import SQLModel


class FieldGroupBase(SQLModel):
    name: str
    slug: str
    sort_order: int = 0
    dataset_id: int = sql_field(foreign_key="dataset.id")
    parent_id: int | None = sql_field(default=None, foreign_key="fieldgroup.id")


class FieldGroup(FieldGroupBase, table=True):
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class FieldGroupRead(FieldGroupBase):
    id: int
    created_at: datetime
