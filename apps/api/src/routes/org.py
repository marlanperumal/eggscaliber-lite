from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import CurrentUser, get_current_user
from src.database import get_session
from src.models.package import PackageRead
from src.models.user import OrgMemberRead
from src.services import org_service

router = APIRouter(tags=["org"])


@router.get("/org/members", response_model=list[OrgMemberRead])
async def list_org_members(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all members of the current user's organisation with their roles."""
    if current_user.org_id is None:
        return []
    return await org_service.list_members(session, current_user.org_id)


@router.get("/org/subscriptions", response_model=list[PackageRead])
async def list_org_subscribed_packages(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List packages available to the current user's org (public + active private subscriptions)."""
    if current_user.org_id is None:
        return []
    return await org_service.list_subscribed_packages(session, current_user.org_id)
