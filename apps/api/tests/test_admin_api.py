import pytest
import pytest_asyncio
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
async def test_admin_list_orgs_as_superuser(client, admin_fixtures, db):
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
async def test_admin_subscribe_org_to_package(client, admin_fixtures, db):
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
async def test_admin_update_package_visibility(client, admin_fixtures, db):
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
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    assert resp.json()["visibility"] == "public"
