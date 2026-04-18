import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.errors import DatasetNotFoundError
from src.models.analytics import FieldTreeOut
from src.models.dataset import DatasetWithFields, FieldOut
from src.models.response import ResponsePage
from src.repositories import dataset_repo
from src.services import analytics_service, dataset_service

router = APIRouter(tags=["datasets"])


@router.get("/datasets")
async def list_datasets(
    collection_id: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    """List datasets, optionally filtered by collection_id."""
    total, items = await dataset_repo.list_enriched(
        session, collection_id=collection_id, page=page, page_size=page_size
    )
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/datasets/{dataset_id}", response_model=DatasetWithFields)
async def get_dataset(dataset_id: int, session: AsyncSession = Depends(get_session)):
    """Get a dataset with all its fields and metadata."""
    try:
        return await dataset_service.get_with_fields(session, dataset_id)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.delete("/datasets/{dataset_id}", status_code=204)
async def delete_dataset(dataset_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a dataset and all associated fields, levels, and responses."""
    try:
        await dataset_service.delete_dataset(session, dataset_id)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.get("/datasets/{dataset_id}/responses", response_model=ResponsePage)
async def get_dataset_responses(
    dataset_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    """Get paginated raw survey responses for a dataset."""
    try:
        return await dataset_service.get_responses(session, dataset_id, page, page_size)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.get("/datasets/{dataset_id}/field-tree", response_model=FieldTreeOut)
async def get_field_tree(dataset_id: int, session: AsyncSession = Depends(get_session)):
    """Get the hierarchical field tree for a dataset (groups and fields for use in query builder)."""
    try:
        return await analytics_service.get_field_tree(session, dataset_id)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.get("/datasets/{dataset_id}/weight-fields", response_model=list[FieldOut])
async def get_weight_fields(dataset_id: int, session: AsyncSession = Depends(get_session)):
    """Get the numeric fields available as weighting variables for a dataset."""
    try:
        return await analytics_service.get_weight_fields(session, dataset_id)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.get("/datasets/{dataset_id}/download")
async def download_dataset_csv(
    dataset_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Stream all responses for a dataset as a CSV file."""
    try:
        field_keys, rows = await dataset_service.get_csv_data(session, dataset_id)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(field_keys)
        yield buf.getvalue()
        for row in rows:
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([row.payload.get(k, "") for k in field_keys])
            yield buf.getvalue()

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="dataset-{dataset_id}.csv"'},
    )
