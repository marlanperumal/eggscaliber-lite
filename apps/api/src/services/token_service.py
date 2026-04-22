import hashlib
import secrets
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.errors import ForbiddenError, TokenNotFoundError
from src.models.token import ApiTokenCreated, ApiTokenRead
from src.models.user import User
from src.repositories import token_repo


def _generate_raw_token() -> str:
    return f"eggsec_{secrets.token_hex(32)}"


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _prefix(raw: str) -> str:
    return raw[:15]


async def _resolve_user_id(session: AsyncSession, clerk_id: str) -> int:
    result = await session.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalars().first()
    if user is None:
        raise ForbiddenError("User not found")
    return cast(int, user.id)


async def generate(session: AsyncSession, clerk_id: str, name: str) -> ApiTokenCreated:
    user_id = await _resolve_user_id(session, clerk_id)
    raw = _generate_raw_token()
    token = await token_repo.create(
        session,
        user_id=user_id,
        name=name,
        token_hash=_hash_token(raw),
        prefix=_prefix(raw),
    )
    return ApiTokenCreated(
        id=cast(int, token.id),
        name=token.name,
        prefix=token.prefix,
        created_at=token.created_at,
        raw_token=raw,
    )


async def list_tokens(session: AsyncSession, clerk_id: str) -> list[ApiTokenRead]:
    user_id = await _resolve_user_id(session, clerk_id)
    tokens = await token_repo.list_active(session, user_id)
    return [ApiTokenRead.model_validate(t.model_dump()) for t in tokens]


async def revoke(session: AsyncSession, token_id: int, clerk_id: str) -> None:
    user_id = await _resolve_user_id(session, clerk_id)
    revoked = await token_repo.revoke(session, token_id=token_id, user_id=user_id)
    if revoked is None:
        raise TokenNotFoundError()
