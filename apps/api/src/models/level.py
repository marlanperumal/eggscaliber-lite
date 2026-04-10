from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class LevelBase(SQLModel):
    value: str
    display_label: str
    sort_order: int = 0
    field_id: int = Field(foreign_key="field.id")


class Level(LevelBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class LevelRead(LevelBase):
    id: int
    created_at: datetime
