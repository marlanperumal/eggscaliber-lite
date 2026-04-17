from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.errors import CollectionNotFoundError, DatasetNotFoundError
from src.models.analytics import (
    CrosstabRequest,
    CrosstabResponse,
    TrendRequest,
    TrendResponse,
)
from src.services import analytics_service

router = APIRouter(tags=["analytics"])


@router.post("/analytics/crosstab", response_model=CrosstabResponse)
async def run_crosstab(request: CrosstabRequest, session: AsyncSession = Depends(get_session)):
    """Run a cross-tabulation: rows × columns × optional breakdown, with optional weighting."""
    if request.row_mode == "nested" and len(request.rows) > 2:
        raise HTTPException(422, "Nested row mode supports at most 2 fields")
    if request.row_mode == "stacked" and len(request.rows) > 5:
        raise HTTPException(422, "Stacked row mode supports at most 5 fields")
    if request.col_mode == "nested" and len(request.columns) > 2:
        raise HTTPException(422, "Nested col mode supports at most 2 fields")
    try:
        return await analytics_service.run_crosstab(session, request)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.post("/analytics/trend", response_model=TrendResponse)
async def run_trend(request: TrendRequest, session: AsyncSession = Depends(get_session)):
    """Run a trend analysis: track a field's distribution across datasets in a collection over time."""
    try:
        return await analytics_service.run_trend(session, request)
    except CollectionNotFoundError:
        raise HTTPException(status_code=404, detail="Collection not found") from None
