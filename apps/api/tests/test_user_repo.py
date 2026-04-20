from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories import user_repo


@pytest.mark.asyncio
async def test_upsert_user_creates_new(db: AsyncSession):
    user = await user_repo.upsert_user(
        db, clerk_id="user_abc", email="a@example.com", display_name="Alice"
    )
    assert user.id is not None
    assert user.clerk_id == "user_abc"
    assert user.email == "a@example.com"
    assert user.display_name == "Alice"


@pytest.mark.asyncio
async def test_upsert_user_updates_existing(db: AsyncSession):
    await user_repo.upsert_user(db, clerk_id="user_abc", email="old@example.com", display_name=None)
    updated = await user_repo.upsert_user(
        db, clerk_id="user_abc", email="new@example.com", display_name="Alice Updated"
    )
    assert updated.email == "new@example.com"
    assert updated.display_name == "Alice Updated"


@pytest.mark.asyncio
async def test_upsert_organisation_creates_new(db: AsyncSession):
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_xyz", name="Acme")
    assert org.id is not None
    assert org.clerk_org_id == "org_xyz"
    assert org.name == "Acme"


@pytest.mark.asyncio
async def test_upsert_organisation_updates_existing(db: AsyncSession):
    await user_repo.upsert_organisation(db, clerk_org_id="org_xyz", name="Old Name")
    updated = await user_repo.upsert_organisation(db, clerk_org_id="org_xyz", name="New Name")
    assert updated.name == "New Name"


@pytest.mark.asyncio
async def test_upsert_membership_creates(db: AsyncSession):
    user = await user_repo.upsert_user(
        db, clerk_id="user_m1", email="m@example.com", display_name=None
    )
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_m1", name="Org M")
    membership = await user_repo.upsert_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id), role="admin"
    )
    assert membership.id is not None
    assert membership.role == "admin"


@pytest.mark.asyncio
async def test_upsert_membership_updates_role(db: AsyncSession):
    user = await user_repo.upsert_user(
        db, clerk_id="user_m2", email="m2@example.com", display_name=None
    )
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_m2", name="Org M2")
    uid, oid = cast(int, user.id), cast(int, org.id)
    await user_repo.upsert_membership(db, user_id=uid, org_id=oid, role="member")
    updated = await user_repo.upsert_membership(db, user_id=uid, org_id=oid, role="admin")
    assert updated.role == "admin"


@pytest.mark.asyncio
async def test_delete_membership_removes_row(db: AsyncSession):
    user = await user_repo.upsert_user(
        db, clerk_id="user_m3", email="m3@example.com", display_name=None
    )
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_m3", name="Org M3")
    await user_repo.upsert_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id), role="member"
    )
    await user_repo.delete_membership(db, user_clerk_id="user_m3", org_clerk_id="org_m3")
    membership = await user_repo.get_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id)
    )
    assert membership is None


@pytest.mark.asyncio
async def test_delete_membership_noop_when_missing(db: AsyncSession):
    await user_repo.delete_membership(db, user_clerk_id="nonexistent", org_clerk_id="nonexistent")


@pytest.mark.asyncio
async def test_get_user_by_clerk_id_returns_none_for_missing(db: AsyncSession):
    result = await user_repo.get_user_by_clerk_id(db, "does_not_exist")
    assert result is None


@pytest.mark.asyncio
async def test_get_org_by_clerk_id_returns_none_for_missing(db: AsyncSession):
    result = await user_repo.get_org_by_clerk_id(db, "does_not_exist")
    assert result is None
