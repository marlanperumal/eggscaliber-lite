from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlmodel import SQLModel

from src.database import get_session
from src.models.dataset import DatasetRead
from src.models.field import FieldType
from src.models.response import ResponseRead
from src.repositories import analytics_repo, dataset_repo

router = APIRouter(tags=["datasets"])


class LevelOut(SQLModel):
    id: int
    value: str
    display_label: str
    sort_order: int


class FieldWithLevels(SQLModel):
    id: int
    field_key: str
    display_name: str
    field_type: FieldType
    sort_order: int
    is_filterable: bool
    levels: list[LevelOut] = []


class DatasetWithFields(DatasetRead):
    fields: list[FieldWithLevels] = []


class ResponsePage(SQLModel):
    total: int
    page: int
    page_size: int
    items: list[ResponseRead]


@router.get("/datasets/{dataset_id}", response_model=DatasetWithFields)
def get_dataset(dataset_id: int, session: Session = Depends(get_session)):
    ds = dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    fields_with_levels = dataset_repo.get_fields_with_levels(session, dataset_id)
    fields_out = [
        FieldWithLevels(**f.model_dump(), levels=levels) for f, levels in fields_with_levels
    ]
    return DatasetWithFields(**ds.model_dump(), fields=fields_out)


@router.get("/datasets/{dataset_id}/responses", response_model=ResponsePage)
def get_dataset_responses(
    dataset_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_session),
):
    ds = dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    total, items = dataset_repo.get_responses(session, dataset_id, page, page_size)
    return ResponsePage(total=total, page=page, page_size=page_size, items=items)


class FieldOut(SQLModel):
    id: int
    field_key: str
    display_name: str
    field_type: FieldType
    sort_order: int
    is_filterable: bool


@router.get("/datasets/{dataset_id}/field-tree")
def get_field_tree(dataset_id: int, session: Session = Depends(get_session)):
    ds = analytics_repo.get_dataset(session, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return analytics_repo.get_field_tree(session, dataset_id)


@router.get("/datasets/{dataset_id}/weight-fields", response_model=list[FieldOut])
def get_weight_fields(dataset_id: int, session: Session = Depends(get_session)):
    ds = analytics_repo.get_dataset(session, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return analytics_repo.get_weight_fields(session, dataset_id)
