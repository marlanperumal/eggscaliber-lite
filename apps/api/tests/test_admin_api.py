import datetime

import pytest
import pytest_asyncio
from src.models.group import OrgSubscription
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation


@pytest_asyncio.fixture
async def admin_fixtures(db):
    org = Organisation(clerk_org_id="org_admin_test", name="Admin Test Org")
    db.add(org)
    await db.flush()
    await db.refresh(org)
    pkg = Package(name="Admin Pkg", slug="admin-pkg", visibility=PackageVisibility.private)
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    return {"org": org, "pkg": pkg}


@pytest.mark.asyncio
async def test_admin_list_orgs_requires_superuser(client):
    resp = await client.get("/api/v1/admin/orgs")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_list_orgs_as_superuser_includes_seeded_org(client, admin_fixtures, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    resp = await client.get("/api/v1/admin/orgs")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    orgs = resp.json()
    assert any(o["name"] == "Admin Test Org" for o in orgs)


@pytest.mark.asyncio
async def test_admin_subscribe_org_to_package_returns_201_with_package_id(
    client, admin_fixtures, db
):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = admin_fixtures

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    resp = await client.post(
        f"/api/v1/admin/orgs/{f['org'].id}/subscriptions",
        json={"package_id": f["pkg"].id, "start_date": "2026-01-01"},
    )
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 201
    data = resp.json()
    assert data["package_id"] == f["pkg"].id


@pytest.mark.asyncio
async def test_admin_update_package_visibility_persists_change(client, admin_fixtures, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = admin_fixtures

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    resp = await client.patch(
        f"/api/v1/admin/packages/{f['pkg'].id}",
        json={"visibility": "public"},
    )
    assert resp.status_code == 200
    assert resp.json()["visibility"] == "public"

    # Re-fetch via GET to confirm the visibility change actually persisted.
    get_resp = await client.get(f"/api/v1/packages/{f['pkg'].id}")
    app.dependency_overrides.pop(get_current_user, None)

    assert get_resp.status_code == 200
    assert get_resp.json()["visibility"] == "public"


@pytest.mark.asyncio
async def test_admin_list_packages_requires_superuser(client):
    response = await client.get("/api/v1/admin/packages")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_list_packages_as_superuser_returns_all_packages(client, seeded_package, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    response = await client.get("/api/v1/admin/packages")
    app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    ids = [p["id"] for p in response.json()]
    assert seeded_package.id in ids


@pytest.mark.asyncio
async def test_admin_create_package_auto_generates_slug(client, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    response = await client.post(
        "/api/v1/admin/packages",
        json={"name": "Test Package", "description": "A test"},
    )
    app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Package"
    assert data["slug"] == "test-package"


@pytest.mark.asyncio
async def test_admin_list_collections_requires_superuser(client):
    response = await client.get("/api/v1/admin/collections")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_list_collections_as_superuser_returns_all_collections(
    client, seeded_collection, db
):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    response = await client.get("/api/v1/admin/collections")
    app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()]
    assert seeded_collection.id in ids


@pytest.mark.asyncio
async def test_admin_create_package_requires_superuser(client):
    """POST /admin/packages returns 403 for non-superuser (default client fixture user)."""
    response = await client.post("/api/v1/admin/packages", json={"name": "Test"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_create_subscription_requires_superuser(client, admin_fixtures):
    """POST /admin/orgs/{org_id}/subscriptions returns 403 for non-superuser."""
    f = admin_fixtures
    response = await client.post(
        f"/api/v1/admin/orgs/{f['org'].id}/subscriptions",
        json={"package_id": f["pkg"].id, "start_date": "2024-01-01"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_update_package_requires_superuser(client, admin_fixtures):
    """PATCH /admin/packages/{id} returns 403 for non-superuser (default client fixture user)."""
    f = admin_fixtures
    response = await client.patch(
        f"/api/v1/admin/packages/{f['pkg'].id}",
        json={"visibility": "public"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_delete_subscription_requires_superuser(
    client, admin_fixtures, seed_subscription
):
    """DELETE /admin/orgs/{org_id}/subscriptions/{package_id} returns 403 for non-superuser."""
    f = admin_fixtures
    response = await client.delete(f"/api/v1/admin/orgs/{f['org'].id}/subscriptions/{f['pkg'].id}")
    assert response.status_code == 403


@pytest_asyncio.fixture
async def seed_subscription(db, admin_fixtures):
    """An OrgSubscription row for the admin_fixtures org + package."""
    f = admin_fixtures
    sub = OrgSubscription(
        org_id=f["org"].id,
        package_id=f["pkg"].id,
        start_date=datetime.date(2024, 1, 1),
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return sub


@pytest.mark.asyncio
async def test_admin_delete_subscription(client, admin_fixtures, seed_subscription, db):
    """DELETE /admin/orgs/{org_id}/subscriptions/{package_id} removes the subscription."""
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = admin_fixtures

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    response = await client.delete(f"/api/v1/admin/orgs/{f['org'].id}/subscriptions/{f['pkg'].id}")
    app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 204

    app.dependency_overrides[get_current_user] = override_superuser
    list_resp = await client.get(f"/api/v1/admin/orgs/{f['org'].id}/subscriptions")
    app.dependency_overrides.pop(get_current_user, None)

    ids = [s["package_id"] for s in list_resp.json()]
    assert f["pkg"].id not in ids
