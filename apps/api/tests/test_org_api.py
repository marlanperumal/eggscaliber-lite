from typing import cast

import pytest
import pytest_asyncio
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation, OrgMembership, User


@pytest_asyncio.fixture
async def org_fixtures(db, client):
    org = Organisation(clerk_org_id="org_org_test", name="Org Test Org")
    db.add(org)
    await db.flush()
    await db.refresh(org)

    user = User(clerk_id="user_org_test", email="orgtest@example.com", display_name="Org Tester")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    membership = OrgMembership(user_id=cast(int, user.id), org_id=cast(int, org.id), role="admin")
    db.add(membership)
    await db.flush()

    pub_pkg = Package(name="Public Pkg", slug="pub-pkg-org", visibility=PackageVisibility.public)
    db.add(pub_pkg)
    await db.flush()
    await db.refresh(pub_pkg)

    priv_pkg = Package(
        name="Private Pkg", slug="priv-pkg-org", visibility=PackageVisibility.private
    )
    db.add(priv_pkg)
    await db.flush()
    await db.refresh(priv_pkg)

    return {"org": org, "user": user, "pub_pkg": pub_pkg, "priv_pkg": priv_pkg}


@pytest.mark.asyncio
async def test_list_org_members(client, org_fixtures, db):
    """GET /org/members returns list with user_id and role fields."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = org_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.get("/api/v1/org/members")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    members = resp.json()
    assert isinstance(members, list)
    assert len(members) >= 1
    member = next((m for m in members if m["clerk_id"] == f["user"].clerk_id), None)
    assert member is not None
    assert "user_id" in member
    assert "role" in member
    assert member["role"] == "admin"
    assert member["email"] == f["user"].email


@pytest.mark.asyncio
async def test_list_org_subscriptions_includes_public(client, org_fixtures, db):
    """GET /org/subscriptions includes public packages."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = org_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.get("/api/v1/org/subscriptions")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    packages = resp.json()
    assert isinstance(packages, list)
    slugs = [p["slug"] for p in packages]
    assert f["pub_pkg"].slug in slugs
    assert f["priv_pkg"].slug not in slugs


@pytest.mark.asyncio
async def test_list_org_members_no_org_returns_empty(client, db):
    """User with no org gets empty list from /org/members."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    def override_user() -> CurrentUser:
        return CurrentUser(clerk_id="no_org_user", email="noorg@example.com", org_id=None)

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.get("/api/v1/org/members")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_org_subscriptions_no_org_returns_empty(client, db):
    """User with no org gets empty list from /org/subscriptions."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    def override_user() -> CurrentUser:
        return CurrentUser(clerk_id="no_org_user2", email="noorg2@example.com", org_id=None)

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.get("/api/v1/org/subscriptions")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    assert resp.json() == []
