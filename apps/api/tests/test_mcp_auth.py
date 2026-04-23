import hashlib
from datetime import UTC, datetime

import src.database as database
import src.mcp_external.auth as mcp_auth
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import select
from src.mcp_external.auth import _update_last_used, resolve_token_hash
from src.models.token import ApiToken
from src.models.user import User


async def _make_user_and_token(db, clerk_id: str = "test_user") -> tuple[User, str]:
    user = User(clerk_id=clerk_id, email=f"{clerk_id}@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    raw = "eggsec_" + "a" * 64
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    token = ApiToken(user_id=user.id, name="Test", token_hash=token_hash, prefix=raw[:15])
    db.add(token)
    await db.flush()
    return user, raw


async def test_resolve_valid_token_returns_current_user(db):
    user, raw = await _make_user_and_token(db)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()

    result = await resolve_token_hash(db, token_hash)
    assert result is not None
    assert result.clerk_id == user.clerk_id
    assert result.email == user.email


async def test_resolve_unknown_hash_returns_none(db):
    result = await resolve_token_hash(db, "nonexistent_hash")
    assert result is None


async def test_resolve_revoked_token_returns_none(db):
    user = User(clerk_id="revoke_user", email="r@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    raw = "eggsec_" + "b" * 64
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    token = ApiToken(
        user_id=user.id,
        name="Revoked",
        token_hash=token_hash,
        prefix=raw[:15],
        revoked_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(token)
    await db.flush()

    result = await resolve_token_hash(db, token_hash)
    assert result is None


async def test_update_last_used_advances_timestamp(async_engine, monkeypatch):
    """Middleware fire-and-forget path: _update_last_used writes a fresh timestamp.

    Uses a dedicated committed session bound to the test engine (not the rolled-back
    `db` fixture) because _update_last_used opens its own session via SessionLocal.
    """
    sessionmaker = async_sessionmaker(async_engine, expire_on_commit=False)
    monkeypatch.setattr(database, "SessionLocal", sessionmaker)
    monkeypatch.setattr(mcp_auth, "SessionLocal", sessionmaker)

    raw = "eggsec_" + "c" * 64
    token_hash = hashlib.sha256(raw.encode()).hexdigest()

    async with sessionmaker() as setup:
        user = User(clerk_id="lastused_user", email="lu@example.com")
        setup.add(user)
        await setup.flush()
        await setup.refresh(user)

        token = ApiToken(
            user_id=user.id,
            name="LastUsed",
            token_hash=token_hash,
            prefix=raw[:15],
        )
        setup.add(token)
        await setup.commit()
        token_id = token.id
        assert token.last_used_at is None

    try:
        await _update_last_used(token_hash)

        async with sessionmaker() as verify:
            fetched = (
                (await verify.execute(select(ApiToken).where(ApiToken.id == token_id)))
                .scalars()
                .first()
            )
            assert fetched is not None
            assert fetched.last_used_at is not None
            # Timestamp should be recent (within the last few seconds).
            now = datetime.now(UTC).replace(tzinfo=None)
            assert (now - fetched.last_used_at).total_seconds() < 5
    finally:
        async with sessionmaker() as cleanup:
            await cleanup.execute(ApiToken.__table__.delete().where(ApiToken.id == token_id))
            await cleanup.execute(User.__table__.delete().where(User.id == user.id))
            await cleanup.commit()
