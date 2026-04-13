from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import UniqueConstraint
from sqlmodel import Field as sql_field  # noqa: N813
from sqlmodel import SQLModel


class FieldType(StrEnum):
    numeric = "numeric"
    ordinal = "ordinal"
    categorical = "categorical"
    multi_response = "multi_response"
    identifier = "identifier"
    weight = "weight"


class FieldBase(SQLModel):
    field_key: str
    display_name: str
    field_type: FieldType
    sort_order: int = 0
    is_filterable: bool = True
    dataset_id: int = sql_field(foreign_key="dataset.id")
    group_id: int | None = sql_field(default=None, foreign_key="fieldgroup.id")


class Field(FieldBase, table=True):
    __table_args__ = (
        UniqueConstraint("dataset_id", "field_key", name="uq_field_dataset_id_field_key"),
    )
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class FieldRead(FieldBase):
    id: int
    created_at: datetime
