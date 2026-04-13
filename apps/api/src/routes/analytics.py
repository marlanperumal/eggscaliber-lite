from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
def run_crosstab(request: CrosstabRequest, session: Session = Depends(get_session)):
    if request.row_mode == "nested" and len(request.rows) > 2:
        raise HTTPException(422, "Nested row mode supports at most 2 fields")
    if request.row_mode == "stacked" and len(request.rows) > 5:
        raise HTTPException(422, "Stacked row mode supports at most 5 fields")
    if request.col_mode == "nested" and len(request.columns) > 2:
        raise HTTPException(422, "Nested col mode supports at most 2 fields")
    try:
        return analytics_service.run_crosstab(session, request)
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.post("/analytics/trend", response_model=TrendResponse)
def run_trend(request: TrendRequest, session: Session = Depends(get_session)):
    try:
        return analytics_service.run_trend(session, request)
    except CollectionNotFoundError:
        raise HTTPException(status_code=404, detail="Collection not found") from None
