from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_accessible_package_ids
from src.database import get_session
from src.models.analytics import (
    CrosstabRequest,
    CrosstabResponse,
    TrendRequest,
    TrendResponse,
)
from src.services import analytics_service

router = APIRouter(tags=["analytics"])


@router.post("/analytics/crosstab", response_model=CrosstabResponse)
async def run_crosstab(
    request: CrosstabRequest,
    accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
    session: AsyncSession = Depends(get_session),
):
    """Run a cross-tabulation: rows × columns × optional breakdown, with optional weighting."""
    if request.row_mode == "nested" and len(request.rows) > 2:
        raise HTTPException(422, "Nested row mode supports at most 2 fields")
    if request.row_mode == "stacked" and len(request.rows) > 5:
        raise HTTPException(422, "Stacked row mode supports at most 5 fields")
    if request.col_mode == "nested" and len(request.columns) > 2:
        raise HTTPException(422, "Nested col mode supports at most 2 fields")
    return await analytics_service.run_crosstab(session, request, accessible_ids)


@router.post("/analytics/trend", response_model=TrendResponse)
async def run_trend(
    request: TrendRequest,
    accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
    session: AsyncSession = Depends(get_session),
):
    """Run a trend analysis: track a field's distribution across datasets in a collection over time."""
    return await analytics_service.run_trend(session, request, accessible_ids)
