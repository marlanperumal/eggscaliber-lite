from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.token import ApiToken


async def create(
    session: AsyncSession,
    *,
    user_id: int,
    name: str,
    token_hash: str,
    prefix: str,
) -> ApiToken:
    token = ApiToken(user_id=user_id, name=name, token_hash=token_hash, prefix=prefix)
    session.add(token)
    await session.flush()
    await session.refresh(token)
    return token


async def list_active(session: AsyncSession, user_id: int) -> list[ApiToken]:
    return list(
        (
            await session.execute(
                select(ApiToken)
                .where(ApiToken.user_id == user_id, ApiToken.revoked_at.is_(None))
                .order_by(ApiToken.created_at.desc())
            )
        )
        .scalars()
        .all()
    )


async def revoke(session: AsyncSession, token_id: int, user_id: int) -> ApiToken | None:
    token = (
        (
            await session.execute(
                select(ApiToken).where(
                    ApiToken.id == token_id,
                    ApiToken.user_id == user_id,
                )
            )
        )
        .scalars()
        .first()
    )
    if token is None:
        return None
    token.revoked_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(token)
    await session.flush()
    await session.refresh(token)
    return token


async def find_by_hash(session: AsyncSession, token_hash: str) -> ApiToken | None:
    return (
        (
            await session.execute(
                select(ApiToken).where(
                    ApiToken.token_hash == token_hash,
                    ApiToken.revoked_at.is_(None),
                )
            )
        )
        .scalars()
        .first()
    )


async def update_last_used(session: AsyncSession, token_id: int) -> None:
    token = (
        (await session.execute(select(ApiToken).where(ApiToken.id == token_id))).scalars().first()
    )
    if token is None:
        return
    token.last_used_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(token)
    await session.flush()
