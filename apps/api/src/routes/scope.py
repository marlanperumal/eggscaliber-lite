from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.scope import ScopePackage
from src.services import package_service

router = APIRouter(tags=["scope"])


@router.get("/scope", response_model=list[ScopePackage])
async def get_scope(session: AsyncSession = Depends(get_session)):
    """Get the full data hierarchy: packages → collections → datasets with field metadata."""
    return await package_service.get_scope(session)
