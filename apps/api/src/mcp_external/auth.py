import asyncio
import hashlib
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from src.auth import CurrentUser
from src.config import settings
from src.database import SessionLocal
from src.models.token import ApiToken
from src.models.user import User
from src.repositories import token_repo


async def resolve_token_hash(session: AsyncSession, token_hash: str) -> CurrentUser | None:
    """Look up a PAT by hash and return CurrentUser if valid. Returns None if invalid/revoked."""
    token = await token_repo.find_by_hash(session, token_hash)
    if token is None:
        return None

    result = await session.execute(select(User).where(User.id == token.user_id))
    user = result.scalars().first()
    if user is None:
        return None

    return CurrentUser(
        clerk_id=user.clerk_id,
        email=user.email,
        org_id=None,  # resolved from DB at access-check time via user.clerk_id
        is_superuser=False,
    )


async def _update_last_used(token_hash: str) -> None:
    assert SessionLocal is not None
    async with SessionLocal() as session:
        result = await session.execute(select(ApiToken).where(ApiToken.token_hash == token_hash))
        token = result.scalars().first()
        if token:
            token.last_used_at = datetime.now(UTC).replace(tzinfo=None)
            await session.commit()


class PATAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if settings.auth_mode == "dev":
            request.state.current_user = CurrentUser(
                clerk_id="dev_user",
                email="dev@example.com",
                org_id=None,
                is_superuser=settings.dev_superuser,
            )
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer eggsec_"):
            return JSONResponse({"error": "Invalid or missing API token"}, status_code=401)

        raw_token = auth_header.removeprefix("Bearer ")
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        assert SessionLocal is not None
        async with SessionLocal() as session:
            user = await resolve_token_hash(session, token_hash)

        if user is None:
            return JSONResponse({"error": "Invalid or revoked API token"}, status_code=401)

        request.state.current_user = user

        # fire-and-forget last_used_at update
        asyncio.ensure_future(_update_last_used(token_hash))

        return await call_next(request)
