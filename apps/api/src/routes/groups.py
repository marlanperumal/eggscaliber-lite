from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.auth import CurrentUser, get_current_user
from src.database import get_session
from src.models.group import GroupCreate, GroupRead, GroupWithCounts
from src.services import group_service

router = APIRouter(tags=["groups"])


@router.get("/groups", response_model=list[GroupWithCounts])
async def list_groups(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all groups for the current user's organisation."""
    if current_user.org_id is None:
        return []
    return await group_service.list_groups(session, current_user.org_id)


@router.post("/groups", response_model=GroupRead, status_code=201)
async def create_group(
    body: GroupCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new group in the current user's organisation."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    return await group_service.create_group(session, current_user.org_id, body, current_user)


@router.delete("/groups/{group_id}", response_model=None, status_code=204)
async def delete_group(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a group. The Default group cannot be deleted."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.delete_group(session, group_id, current_user.org_id, current_user)


class AddMemberBody(SQLModel):
    user_id: int


@router.post("/groups/{group_id}/members", response_model=None, status_code=204)
async def add_member(
    group_id: int,
    body: AddMemberBody,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add a user to a group."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.add_member(
        session, group_id, body.user_id, current_user.org_id, current_user
    )


@router.delete("/groups/{group_id}/members/{user_id}", response_model=None, status_code=204)
async def remove_member(
    group_id: int,
    user_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove a user from a group."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.remove_member(session, group_id, user_id, current_user.org_id, current_user)


class AssignPackageBody(SQLModel):
    package_id: int


@router.post("/groups/{group_id}/packages", response_model=None, status_code=204)
async def assign_package(
    group_id: int,
    body: AssignPackageBody,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Assign a package to a group."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.assign_package(
        session, group_id, body.package_id, current_user.org_id, current_user
    )


@router.delete("/groups/{group_id}/packages/{package_id}", response_model=None, status_code=204)
async def unassign_package(
    group_id: int,
    package_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove a package from a group."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.unassign_package(
        session, group_id, package_id, current_user.org_id, current_user
    )
