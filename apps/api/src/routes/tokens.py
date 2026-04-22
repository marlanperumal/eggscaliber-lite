from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.auth import CurrentUser, get_current_user
from src.database import get_session
from src.models.token import ApiTokenCreated, ApiTokenRead
from src.services import token_service

router = APIRouter(tags=["tokens"])


class TokenCreate(SQLModel):
    name: str


@router.post("/tokens", response_model=ApiTokenCreated, status_code=201)
async def create_token(
    body: TokenCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new personal access token. The raw token is returned once and never stored."""
    return await token_service.generate(session, current_user.clerk_id, body.name)


@router.get("/tokens", response_model=list[ApiTokenRead])
async def list_tokens(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all active API tokens for the current user."""
    return await token_service.list_tokens(session, current_user.clerk_id)


@router.delete("/tokens/{token_id}", response_model=None, status_code=204)
async def revoke_token(
    token_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Revoke an API token. The token is immediately invalidated."""
    await token_service.revoke(session, token_id=token_id, clerk_id=current_user.clerk_id)
