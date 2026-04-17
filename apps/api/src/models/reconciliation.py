from datetime import UTC, datetime
from enum import StrEnum

from sqlmodel import Field as sql_field  # noqa: N813
from sqlmodel import SQLModel


class ReconciliationGroup(StrEnum):
    exact = "exact"
    probable = "probable"
    new_only = "new_only"
    old_only = "old_only"


class ReconciliationStatus(StrEnum):
    auto_accepted = "auto_accepted"
    pending = "pending"
    confirmed = "confirmed"
    rejected = "rejected"
    excluded = "excluded"


class ReconciliationRowBase(SQLModel):
    upload_session_id: int = sql_field(foreign_key="upload_session.id")
    upload_field_id: int | None = sql_field(default=None, foreign_key="upload_field.id")
    ref_field_id: int | None = sql_field(default=None, foreign_key="field.id")
    group: ReconciliationGroup
    status: ReconciliationStatus
    confidence: float | None = None
    note: str | None = None


class ReconciliationRow(ReconciliationRowBase, table=True):
    __tablename__ = "reconciliation_row"
    id: int | None = sql_field(default=None, primary_key=True)
    created_at: datetime = sql_field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class ReconciliationRowRead(ReconciliationRowBase):
    id: int
    created_at: datetime
