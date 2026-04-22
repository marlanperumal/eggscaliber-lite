import hashlib
from datetime import UTC, datetime

from sqlmodel import select
from src.models.token import ApiToken
from src.models.user import User


async def _make_user(db, clerk_id: str = "test_user") -> User:
    user = User(clerk_id=clerk_id, email=f"{clerk_id}@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def test_create_token_returns_raw_token_and_prefix(client, db):
    await _make_user(db)
    response = await client.post("/api/v1/tokens", json={"name": "Claude Desktop"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Claude Desktop"
    assert data["raw_token"].startswith("eggsec_")
    assert len(data["raw_token"]) == 71  # "eggsec_" (7) + 64 hex chars
    assert data["prefix"] == data["raw_token"][:15]
    assert "raw_token" not in data.get("prefix", "")


async def test_create_token_stores_hash_not_plaintext(client, db):
    await _make_user(db)
    response = await client.post("/api/v1/tokens", json={"name": "Test"})
    assert response.status_code == 201
    raw = response.json()["raw_token"]
    token_id = response.json()["id"]

    result = await db.execute(select(ApiToken).where(ApiToken.id == token_id))
    stored = result.scalars().first()
    assert stored is not None
    assert stored.token_hash == hashlib.sha256(raw.encode()).hexdigest()


async def test_list_tokens_returns_active_only(client, db):
    user = await _make_user(db)

    active = ApiToken(user_id=user.id, name="Active", token_hash="hash1", prefix="eggsec_aaa")
    revoked = ApiToken(
        user_id=user.id,
        name="Revoked",
        token_hash="hash2",
        prefix="eggsec_bbb",
        revoked_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(active)
    db.add(revoked)
    await db.flush()

    response = await client.get("/api/v1/tokens")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Active"
    assert "raw_token" not in data[0]


async def test_revoke_token_returns_204(client, db):
    user = await _make_user(db)
    token = ApiToken(user_id=user.id, name="MyToken", token_hash="hash3", prefix="eggsec_ccc")
    db.add(token)
    await db.flush()
    await db.refresh(token)

    response = await client.delete(f"/api/v1/tokens/{token.id}")
    assert response.status_code == 204

    response = await client.get("/api/v1/tokens")
    assert len(response.json()) == 0


async def test_revoke_other_users_token_returns_404(client, db):
    await _make_user(db, "test_user")  # the authed user
    other = await _make_user(db, "other_user")
    token = ApiToken(user_id=other.id, name="Other", token_hash="hash4", prefix="eggsec_ddd")
    db.add(token)
    await db.flush()
    await db.refresh(token)

    response = await client.delete(f"/api/v1/tokens/{token.id}")
    assert response.status_code == 404
