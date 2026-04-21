from typing import cast

import pytest
import pytest_asyncio
from src.models.group import Group
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation, OrgMembership, User


@pytest_asyncio.fixture
async def group_fixtures(db, client):
    org = Organisation(clerk_org_id="org_grp_test", name="Group Test Org")
    db.add(org)
    await db.flush()
    await db.refresh(org)

    user = User(clerk_id="user_grp_test", email="grptest@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    membership = OrgMembership(user_id=cast(int, user.id), org_id=cast(int, org.id), role="admin")
    db.add(membership)

    grp = Group(org_id=cast(int, org.id), name="Test Group")
    db.add(grp)
    await db.flush()
    await db.refresh(grp)

    pkg = Package(name="Test Pkg", slug="test-pkg-grp", visibility=PackageVisibility.private)
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    return {"org": org, "user": user, "group": grp, "pkg": pkg}


@pytest.mark.asyncio
async def test_list_groups_for_org(client, group_fixtures, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = group_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.get("/api/v1/groups")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    groups = resp.json()
    assert any(g["name"] == "Test Group" for g in groups)


@pytest.mark.asyncio
async def test_create_group(client, group_fixtures, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = group_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.post("/api/v1/groups", json={"name": "New Group"})
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 201
    assert resp.json()["name"] == "New Group"


@pytest.mark.asyncio
async def test_cannot_delete_default_group(client, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    org = Organisation(clerk_org_id="org_del_grp", name="Del Grp Org")
    db.add(org)
    await db.flush()
    await db.refresh(org)
    user = User(clerk_id="user_del_grp", email="delgrp@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)
    membership = OrgMembership(user_id=cast(int, user.id), org_id=cast(int, org.id), role="admin")
    db.add(membership)
    await db.flush()
    default_grp = Group(org_id=cast(int, org.id), name="Default", is_default=True)
    db.add(default_grp)
    await db.flush()
    await db.refresh(default_grp)

    def override_user() -> CurrentUser:
        return CurrentUser(clerk_id=user.clerk_id, email=user.email, org_id=org.clerk_org_id)

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.delete(f"/api/v1/groups/{default_grp.id}")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_cannot_manage_other_org_group(client, db, group_fixtures):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    other_org = Organisation(clerk_org_id="other_org_grp", name="Other Org")
    db.add(other_org)
    await db.flush()
    await db.refresh(other_org)
    other_grp = Group(org_id=cast(int, other_org.id), name="Other Group")
    db.add(other_grp)
    await db.flush()
    await db.refresh(other_grp)

    f = group_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.delete(f"/api/v1/groups/{other_grp.id}")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 403
