from typing import Literal

from sqlmodel import SQLModel

from src.models.field import FieldType

# --- Request schemas ---


class FieldSelection(SQLModel):
    field_key: str


class FilterSpec(SQLModel):
    field_key: str
    levels: list[str] | None = None
    value_range: tuple[float, float] | None = None


class MeasureSpec(SQLModel):
    type: Literal["count", "weighted", "value_field"]
    field_key: str | None = None
    aggregation: Literal["sum", "mean"] | None = None
    display: Literal["pct_col", "pct_row", "n"] = "n"


class CrosstabRequest(SQLModel):
    dataset_id: int
    rows: list[FieldSelection]
    row_mode: Literal["stacked", "nested"] = "stacked"
    columns: list[FieldSelection] = []
    col_mode: Literal["stacked", "nested"] = "stacked"
    filters: list[FilterSpec] = []
    measure: MeasureSpec


class TrendRequest(SQLModel):
    collection_id: int
    fields: list[FieldSelection]
    breakdown: FieldSelection | None = None
    filters: list[FilterSpec] = []
    measure: MeasureSpec


# --- Response schemas ---


class MetaField(SQLModel):
    field_key: str
    display_name: str


class ResultRow(SQLModel):
    key: list[str]
    values: dict[str, float]


class CrosstabMeta(SQLModel):
    mode: str = "crosstab"
    row_fields: list[MetaField]
    col_fields: list[MetaField]
    row_mode: str
    col_mode: str
    measure: MeasureSpec
    dataset_name: str
    base_n: int


class CrosstabResponse(SQLModel):
    meta: CrosstabMeta
    rows: list[ResultRow]


class TrendMeta(SQLModel):
    mode: str = "trend"
    fields: list[MetaField]
    breakdown: MetaField | None = None
    measure: MeasureSpec
    collection_name: str


class TrendResponse(SQLModel):
    meta: TrendMeta
    rows: list[ResultRow]


# --- Field tree response schemas ---


class FieldTreeFieldOut(SQLModel):
    id: int
    field_key: str
    display_name: str
    field_type: FieldType
    sort_order: int
    is_filterable: bool


class FieldTreeGroupOut(SQLModel):
    id: int
    name: str
    slug: str
    sort_order: int
    fields: list[FieldTreeFieldOut] = []
    children: list["FieldTreeGroupOut"] = []


FieldTreeGroupOut.model_rebuild()


class FieldTreeOut(SQLModel):
    groups: list[FieldTreeGroupOut] = []
    ungrouped_fields: list[FieldTreeFieldOut] = []
