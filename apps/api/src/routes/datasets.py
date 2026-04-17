from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.errors import DatasetNotFoundError
from src.models.analytics import FieldTreeOut
from src.models.dataset import Dataset, DatasetWithFields, FieldOut
from src.models.response import ResponsePage
from src.services import analytics_service, dataset_service

router = APIRouter(tags=["datasets"])


@router.get("/datasets")
async def list_datasets(
    collection_id: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Dataset)
    if collection_id is not None:
        stmt = stmt.where(Dataset.collection_id == collection_id)
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    items = list(
        (
            await session.execute(
                stmt.order_by(Dataset.id.desc()).offset((page - 1) * page_size).limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": d.id,
                "name": d.name,
                "collection_id": d.collection_id,
                "collected_at": d.collected_at.isoformat() if d.collected_at else None,
                "created_at": d.created_at.isoformat(),
            }
            for d in items
        ],
    }


@router.get("/datasets/{dataset_id}", response_model=DatasetWithFields)
async def get_dataset(dataset_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await dataset_service.get_with_fields(session, dataset_id)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.get("/datasets/{dataset_id}/responses", response_model=ResponsePage)
async def get_dataset_responses(
    dataset_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await dataset_service.get_responses(session, dataset_id, page, page_size)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.get("/datasets/{dataset_id}/field-tree", response_model=FieldTreeOut)
async def get_field_tree(dataset_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await analytics_service.get_field_tree(session, dataset_id)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.get("/datasets/{dataset_id}/weight-fields", response_model=list[FieldOut])
async def get_weight_fields(dataset_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await analytics_service.get_weight_fields(session, dataset_id)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None
