import hashlib
from datetime import UTC, datetime

from src.mcp_external.auth import resolve_token_hash
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
