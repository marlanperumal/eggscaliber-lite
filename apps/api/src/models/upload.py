from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from sqlmodel import Field as sql_field  # noqa: N813
from sqlmodel import SQLModel

from src.models.field import FieldType


class UploadSessionStatus(StrEnum):
    pending = "pending"
    detecting = "detecting"
    reconciling = "reconciling"
    editing = "editing"
    committed = "committed"
    abandoned = "abandoned"


class UploadSessionBase(SQLModel):
    status: UploadSessionStatus = UploadSessionStatus.pending
    file_path: str
    row_count: int | None = None
    collection_id: int | None = sql_field(default=None, foreign_key="collection.id")
    dataset_name: str | None = None
    collected_at: date | None = None
    reference_dataset_id: int | None = sql_field(default=None, foreign_key="dataset.id")
    committed_dataset_id: int | None = sql_field(default=None, foreign_key="dataset.id")


class UploadSession(UploadSessionBase, table=True):
    __tablename__ = "upload_session"
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))
    updated_at: datetime = sql_field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class UploadSessionRead(UploadSessionBase):
    id: int
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------


class UploadFieldGroupBase(SQLModel):
    upload_session_id: int = sql_field(foreign_key="upload_session.id")
    name: str
    sort_order: int = 0
    parent_id: int | None = sql_field(default=None, foreign_key="upload_fieldgroup.id")


class UploadFieldGroup(UploadFieldGroupBase, table=True):
    __tablename__ = "upload_fieldgroup"
    id: int | None = sql_field(default=None, primary_key=True)
    # created_at intentionally omitted — ephemeral staging rows deleted on commit/abandon


class UploadFieldGroupRead(UploadFieldGroupBase):
    id: int


# ---------------------------------------------------------------------------


class UploadFieldBase(SQLModel):
    upload_session_id: int = sql_field(foreign_key="upload_session.id")
    field_key: str
    display_name: str | None = None
    detected_type: FieldType
    override_type: FieldType | None = None
    sort_order: int = 0
    upload_fieldgroup_id: int | None = sql_field(default=None, foreign_key="upload_fieldgroup.id")
    confidence: str = "high"
    value_sample: list[Any] | None = sql_field(
        default=None, sa_column=Column(PG_JSONB, nullable=True)
    )


class UploadField(UploadFieldBase, table=True):
    __tablename__ = "upload_field"
    id: int | None = sql_field(default=None, primary_key=True)


class UploadFieldRead(UploadFieldBase):
    id: int

    @property
    def effective_type(self) -> FieldType:
        """Python-only convenience helper — not serialized in API responses."""
        return self.override_type or self.detected_type


# ---------------------------------------------------------------------------


class UploadLevelBase(SQLModel):
    upload_field_id: int = sql_field(foreign_key="upload_field.id")
    raw_value: str
    display_label: str | None = None
    sort_order: int = 0


class UploadLevel(UploadLevelBase, table=True):
    __tablename__ = "upload_level"
    id: int | None = sql_field(default=None, primary_key=True)
    # created_at intentionally omitted — ephemeral staging rows deleted on commit/abandon


class UploadLevelRead(UploadLevelBase):
    id: int
