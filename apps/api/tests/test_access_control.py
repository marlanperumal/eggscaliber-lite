from datetime import date, timedelta
from typing import cast
from unittest.mock import patch

import pytest
import pytest_asyncio
from src.auth import CurrentUser, _get_accessible_package_ids
from src.models.group import (
    Group,
    GroupMembership,
    GroupPackage,
    OrgSubscription,
)
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation, User
from src.repositories import package_repo


@pytest.fixture(autouse=True)
def clerk_auth_mode():
    """Force auth_mode=clerk so _get_accessible_package_ids runs real logic."""
    with patch("src.auth.settings") as mock_settings:
        mock_settings.auth_mode = "clerk"
        yield mock_settings


@pytest_asyncio.fixture
async def access_fixtures(db):
    """Org, user, public + private packages, group, subscription."""
    org = Organisation(clerk_org_id="org_test", name="Test Org")
    db.add(org)
    await db.flush()
    await db.refresh(org)

    user = User(clerk_id="user_test", email="test@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    pub_pkg = Package(name="Public Pkg", slug="pub-pkg", visibility=PackageVisibility.public)
    priv_pkg = Package(name="Private Pkg", slug="priv-pkg", visibility=PackageVisibility.private)
    other_priv = Package(
        name="Other Private", slug="other-priv", visibility=PackageVisibility.private
    )
    db.add_all([pub_pkg, priv_pkg, other_priv])
    await db.flush()
    await db.refresh(pub_pkg)
    await db.refresh(priv_pkg)
    await db.refresh(other_priv)

    grp = Group(org_id=cast(int, org.id), name="Testers")
    db.add(grp)
    await db.flush()
    await db.refresh(grp)

    sub = OrgSubscription(
        org_id=cast(int, org.id),
        package_id=cast(int, priv_pkg.id),
        start_date=date.today() - timedelta(days=1),
    )
    db.add(sub)

    gm = GroupMembership(group_id=cast(int, grp.id), user_id=cast(int, user.id))
    gp = GroupPackage(group_id=cast(int, grp.id), package_id=cast(int, priv_pkg.id))
    db.add_all([gm, gp])
    await db.flush()

    return {
        "org": org,
        "user": user,
        "pub_pkg": pub_pkg,
        "priv_pkg": priv_pkg,
        "other_priv": other_priv,
        "group": grp,
    }


@pytest.mark.asyncio
async def test_public_package_always_accessible(db, access_fixtures):
    f = access_fixtures
    current_user = CurrentUser(
        clerk_id=f["user"].clerk_id,
        email=f["user"].email,
        org_id=f["org"].clerk_org_id,
    )
    ids = await _get_accessible_package_ids(current_user, db)
    assert cast(int, f["pub_pkg"].id) in ids


@pytest.mark.asyncio
async def test_subscribed_group_member_sees_private_package(db, access_fixtures):
    f = access_fixtures
    current_user = CurrentUser(
        clerk_id=f["user"].clerk_id,
        email=f["user"].email,
        org_id=f["org"].clerk_org_id,
    )
    ids = await _get_accessible_package_ids(current_user, db)
    assert cast(int, f["priv_pkg"].id) in ids


@pytest.mark.asyncio
async def test_unsubscribed_private_package_not_accessible(db, access_fixtures):
    f = access_fixtures
    current_user = CurrentUser(
        clerk_id=f["user"].clerk_id,
        email=f["user"].email,
        org_id=f["org"].clerk_org_id,
    )
    ids = await _get_accessible_package_ids(current_user, db)
    assert cast(int, f["other_priv"].id) not in ids


@pytest.mark.asyncio
async def test_expired_subscription_denied(db, access_fixtures):
    f = access_fixtures
    expired_sub = OrgSubscription(
        org_id=cast(int, f["org"].id),
        package_id=cast(int, f["other_priv"].id),
        start_date=date.today() - timedelta(days=30),
        end_date=date.today() - timedelta(days=1),
    )
    expired_gp = GroupPackage(
        group_id=cast(int, f["group"].id),
        package_id=cast(int, f["other_priv"].id),
    )
    db.add_all([expired_sub, expired_gp])
    await db.flush()

    current_user = CurrentUser(
        clerk_id=f["user"].clerk_id,
        email=f["user"].email,
        org_id=f["org"].clerk_org_id,
    )
    ids = await _get_accessible_package_ids(current_user, db)
    assert cast(int, f["other_priv"].id) not in ids


@pytest.mark.asyncio
async def test_no_org_sees_only_public(db, access_fixtures):
    f = access_fixtures
    current_user = CurrentUser(clerk_id="no_org_user", email="noorg@test.com", org_id=None)
    ids = await _get_accessible_package_ids(current_user, db)
    assert cast(int, f["pub_pkg"].id) in ids
    assert cast(int, f["priv_pkg"].id) not in ids


def test_superuser_flag_set_from_dataclass():
    user = CurrentUser(clerk_id="super", email="super@test.com", org_id=None, is_superuser=True)
    assert user.is_superuser is True


def test_superuser_defaults_to_false():
    user = CurrentUser(clerk_id="normal", email="normal@test.com", org_id=None)
    assert user.is_superuser is False


@pytest.mark.asyncio
async def test_superuser_gets_none(db, access_fixtures):
    f = access_fixtures
    current_user = CurrentUser(
        clerk_id=f["user"].clerk_id,
        email=f["user"].email,
        org_id=f["org"].clerk_org_id,
        is_superuser=True,
    )
    result = await _get_accessible_package_ids(current_user, db)
    assert result is None


@pytest.mark.asyncio
async def test_packages_route_filters_by_accessible_ids(client, db, access_fixtures):
    from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
    from src.main import app

    f = access_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    async def override_accessible() -> set[int] | None:
        return {cast(int, f["pub_pkg"].id), cast(int, f["priv_pkg"].id)}

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_accessible_package_ids] = override_accessible

    resp = await client.get("/api/v1/packages")
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_accessible_package_ids, None)

    assert resp.status_code == 200
    pkg_ids = {p["id"] for p in resp.json()}
    assert cast(int, f["pub_pkg"].id) in pkg_ids
    assert cast(int, f["priv_pkg"].id) in pkg_ids
    assert cast(int, f["other_priv"].id) not in pkg_ids


@pytest.mark.asyncio
async def test_analytics_rejects_inaccessible_dataset(client, db, bare_dataset, access_fixtures):
    from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
    from src.main import app

    f = access_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    async def override_accessible() -> set[int] | None:
        return set()  # no packages accessible

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_accessible_package_ids] = override_accessible

    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": bare_dataset.id,
            "rows": [],
            "columns": [],
            "row_mode": "stacked",
            "col_mode": "stacked",
            "measure": {"type": "count"},
        },
    )
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_accessible_package_ids, None)

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_package_ids_for_collection(db, seeded_collection, seeded_package):
    ids = await package_repo.get_package_ids_for_collection(db, cast(int, seeded_collection.id))
    assert cast(int, seeded_package.id) in ids


@pytest.mark.asyncio
async def test_get_package_ids_for_dataset(db, bare_dataset):
    from sqlmodel import select
    from src.models.group import PackageCollection

    result = await db.execute(
        select(PackageCollection.package_id).where(
            PackageCollection.collection_id == bare_dataset.collection_id
        )
    )
    expected_pkg_id = cast(int, result.scalar_one())

    ids = await package_repo.get_package_ids_for_dataset(db, cast(int, bare_dataset.id))
    assert expected_pkg_id in ids
