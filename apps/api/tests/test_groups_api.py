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
async def test_list_group_members_returns_members(client, db, group_fixtures):
    """GET /groups/{id}/members returns the users currently in that group."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app
    from src.models.group import GroupMembership

    f = group_fixtures

    gm = GroupMembership(group_id=cast(int, f["group"].id), user_id=cast(int, f["user"].id))
    db.add(gm)
    await db.flush()

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.get(f"/api/v1/groups/{f['group'].id}/members")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(m["email"] == f["user"].email for m in data)


@pytest.mark.asyncio
async def test_list_group_packages_returns_assigned_packages(client, db, group_fixtures):
    """GET /groups/{id}/packages returns the packages assigned to that group."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app
    from src.models.group import GroupPackage

    f = group_fixtures

    gp = GroupPackage(group_id=cast(int, f["group"].id), package_id=cast(int, f["pkg"].id))
    db.add(gp)
    await db.flush()

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.get(f"/api/v1/groups/{f['group'].id}/packages")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(p["slug"] == f["pkg"].slug for p in data)


@pytest.mark.asyncio
async def test_list_group_members_from_other_org_returns_empty(client, db, group_fixtures):
    """GET /groups/{group_id}/members returns [] when the clerk_org_id is unknown (no matching org)."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = group_fixtures

    different_org_user = CurrentUser(
        clerk_id="user_other_org",
        email="other@example.com",
        org_id="org_different_clerk_id_unknown",
        is_superuser=False,
    )
    app.dependency_overrides[get_current_user] = lambda: different_org_user
    response = await client.get(f"/api/v1/groups/{f['group'].id}/members")
    app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_group_members_from_other_org_forbidden(client, db, group_fixtures):
    """GET /groups/{group_id}/members returns 403 when group belongs to a different org."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = group_fixtures

    other_org = Organisation(clerk_org_id="org_other_members_test", name="Other Org Members")
    db.add(other_org)
    await db.flush()
    await db.refresh(other_org)
    other_user = User(clerk_id="user_other_members", email="othermembers@example.com")
    db.add(other_user)
    await db.flush()
    await db.refresh(other_user)
    membership = OrgMembership(
        user_id=cast(int, other_user.id), org_id=cast(int, other_org.id), role="admin"
    )
    db.add(membership)
    await db.flush()

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=other_user.clerk_id,
            email=other_user.email,
            org_id=other_org.clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    response = await client.get(f"/api/v1/groups/{f['group'].id}/members")
    app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_group_packages_from_other_org_returns_empty(client, db, group_fixtures):
    """GET /groups/{group_id}/packages returns [] when the clerk_org_id is unknown."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = group_fixtures

    different_org_user = CurrentUser(
        clerk_id="user_other_org2",
        email="other2@example.com",
        org_id="org_different_clerk_id_unknown2",
        is_superuser=False,
    )
    app.dependency_overrides[get_current_user] = lambda: different_org_user
    response = await client.get(f"/api/v1/groups/{f['group'].id}/packages")
    app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_group_packages_from_other_org_forbidden(client, db, group_fixtures):
    """GET /groups/{group_id}/packages returns 403 when group belongs to a different org."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = group_fixtures

    other_org = Organisation(clerk_org_id="org_other_packages_test", name="Other Org Packages")
    db.add(other_org)
    await db.flush()
    await db.refresh(other_org)
    other_user = User(clerk_id="user_other_packages", email="otherpkgs@example.com")
    db.add(other_user)
    await db.flush()
    await db.refresh(other_user)
    membership = OrgMembership(
        user_id=cast(int, other_user.id), org_id=cast(int, other_org.id), role="admin"
    )
    db.add(membership)
    await db.flush()

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=other_user.clerk_id,
            email=other_user.email,
            org_id=other_org.clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    response = await client.get(f"/api/v1/groups/{f['group'].id}/packages")
    app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 403


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
