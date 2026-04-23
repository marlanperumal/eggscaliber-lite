import json
from typing import cast
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.user import Organisation, User
from src.repositories import user_repo


@pytest.mark.asyncio
async def test_invalid_signature_returns_400(client: AsyncClient):
    payload = {"type": "user.created", "data": {"id": "user_abc"}}
    response = await client.post(
        "/api/v1/webhooks/clerk",
        content=json.dumps(payload),
        headers={
            "content-type": "application/json",
            "svix-id": "msg_test",
            "svix-timestamp": "1234567890",
            "svix-signature": "v1,invalidsig",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_user_created_upserts_user(client: AsyncClient, db: AsyncSession):
    payload = {
        "type": "user.created",
        "data": {
            "id": "user_wh1",
            "email_addresses": [{"email_address": "wh@example.com"}],
            "first_name": "Webhook",
            "last_name": "User",
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )

    assert response.status_code == 200
    user = await user_repo.get_user_by_clerk_id(db, "user_wh1")
    assert user is not None
    assert user.email == "wh@example.com"
    assert user.display_name == "Webhook User"


@pytest.mark.asyncio
async def test_user_updated_updates_user(client: AsyncClient, db: AsyncSession):
    await user_repo.upsert_user(
        db, clerk_id="user_wh2", email="old@example.com", display_name="Old"
    )
    payload = {
        "type": "user.updated",
        "data": {
            "id": "user_wh2",
            "email_addresses": [{"email_address": "new@example.com"}],
            "first_name": "New",
            "last_name": "Name",
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )

    assert response.status_code == 200
    user = await user_repo.get_user_by_clerk_id(db, "user_wh2")
    assert user is not None
    assert user.email == "new@example.com"
    assert user.display_name == "New Name"


@pytest.mark.asyncio
async def test_organization_created_upserts_org(client: AsyncClient, db: AsyncSession):
    payload = {
        "type": "organization.created",
        "data": {"id": "org_wh1", "name": "Webhook Org"},
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )

    assert response.status_code == 200
    org = await user_repo.get_org_by_clerk_id(db, "org_wh1")
    assert org is not None
    assert org.name == "Webhook Org"


@pytest.mark.asyncio
async def test_membership_created_upserts_membership(client: AsyncClient, db: AsyncSession):
    await user_repo.upsert_user(
        db, clerk_id="user_mem1", email="mem@example.com", display_name=None
    )
    await user_repo.upsert_organisation(db, clerk_org_id="org_mem1", name="Mem Org")
    payload = {
        "type": "organizationMembership.created",
        "data": {
            "organization": {"id": "org_mem1"},
            "public_user_data": {"user_id": "user_mem1"},
            "role": "org:admin",
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )

    assert response.status_code == 200
    user = await user_repo.get_user_by_clerk_id(db, "user_mem1")
    org = await user_repo.get_org_by_clerk_id(db, "org_mem1")
    membership = await user_repo.get_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id)
    )
    assert membership is not None
    assert membership.role == "admin"


@pytest.mark.asyncio
async def test_membership_deleted_removes_membership(client: AsyncClient, db: AsyncSession):
    user = await user_repo.upsert_user(
        db, clerk_id="user_del1", email="del@example.com", display_name=None
    )
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_del1", name="Del Org")
    await user_repo.upsert_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id), role="member"
    )
    payload = {
        "type": "organizationMembership.deleted",
        "data": {
            "organization": {"id": "org_del1"},
            "public_user_data": {"user_id": "user_del1"},
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )

    assert response.status_code == 200
    membership = await user_repo.get_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id)
    )
    assert membership is None


@pytest.mark.asyncio
async def test_unknown_event_type_returns_200(client: AsyncClient):
    payload = {"type": "session.created", "data": {}}
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_organization_updated_updates_org_name(client: AsyncClient, db: AsyncSession):
    await user_repo.upsert_organisation(db, clerk_org_id="org_upd1", name="Old Name")
    payload = {
        "type": "organization.updated",
        "data": {"id": "org_upd1", "name": "New Name"},
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )

    assert response.status_code == 200
    org = await user_repo.get_org_by_clerk_id(db, "org_upd1")
    assert org is not None
    assert org.name == "New Name"


@pytest.mark.asyncio
async def test_membership_created_noop_when_user_not_synced(client: AsyncClient, db: AsyncSession):
    await user_repo.upsert_organisation(db, clerk_org_id="org_noop1", name="Noop Org")
    payload = {
        "type": "organizationMembership.created",
        "data": {
            "organization": {"id": "org_noop1"},
            "public_user_data": {"user_id": "user_never_synced"},
            "role": "org:member",
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_user_updated_updates_user_returns_200(client: AsyncClient, db: AsyncSession):
    await user_repo.upsert_user(
        db, clerk_id="user_wh2b", email="old@example.com", display_name="Old"
    )
    payload = {
        "type": "user.updated",
        "data": {
            "id": "user_wh2b",
            "email_addresses": [{"email_address": "new2@example.com"}],
            "first_name": "New",
            "last_name": "Name",
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )

    assert response.status_code == 200
    user = await user_repo.get_user_by_clerk_id(db, "user_wh2b")
    assert user is not None
    assert user.email == "new2@example.com"


def _make_mock_webhook(payload):
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload
    return mock_wh


async def _post_webhook(client: AsyncClient, payload: dict) -> None:
    mock_wh = _make_mock_webhook(payload)
    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        resp = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={
                "content-type": "application/json",
                "svix-id": "m",
                "svix-timestamp": "1",
                "svix-signature": "v1,x",
            },
        )
    return resp


@pytest.mark.asyncio
async def test_org_created_creates_default_group(client: AsyncClient, db: AsyncSession):
    from src.models.group import Group

    payload = {
        "type": "organization.created",
        "data": {"id": "org_webhook_test", "name": "Webhook Test Org"},
    }
    resp = await _post_webhook(client, payload)
    assert resp.status_code == 200

    org_result = await db.execute(
        select(Organisation).where(Organisation.clerk_org_id == "org_webhook_test")
    )
    org = org_result.scalars().first()
    assert org is not None

    grp_result = await db.execute(
        select(Group).where(Group.org_id == org.id, Group.is_default == True)  # noqa: E712
    )
    grp = grp_result.scalars().first()
    assert grp is not None
    assert grp.name == "Default"


@pytest.mark.asyncio
async def test_membership_created_adds_user_to_default_group(client: AsyncClient, db: AsyncSession):
    from src.models.group import Group, GroupMembership

    await _post_webhook(
        client,
        {
            "type": "organization.created",
            "data": {"id": "org_mem_test", "name": "Mem Test Org"},
        },
    )
    await _post_webhook(
        client,
        {
            "type": "user.created",
            "data": {
                "id": "user_mem_test",
                "first_name": "Test",
                "last_name": "User",
                "email_addresses": [{"email_address": "memtest@example.com"}],
            },
        },
    )

    resp = await _post_webhook(
        client,
        {
            "type": "organizationMembership.created",
            "data": {
                "role": "org:member",
                "public_user_data": {"user_id": "user_mem_test"},
                "organization": {"id": "org_mem_test"},
            },
        },
    )
    assert resp.status_code == 200

    user_res = await db.execute(select(User).where(User.clerk_id == "user_mem_test"))
    user = user_res.scalars().first()
    org_res = await db.execute(
        select(Organisation).where(Organisation.clerk_org_id == "org_mem_test")
    )
    org = org_res.scalars().first()
    grp_res = await db.execute(
        select(Group).where(Group.org_id == org.id, Group.is_default == True)  # noqa: E712
    )
    grp = grp_res.scalars().first()

    gm_res = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id == grp.id,
            GroupMembership.user_id == user.id,
        )
    )
    assert gm_res.scalars().first() is not None


@pytest.mark.asyncio
async def test_membership_deleted_removes_group_memberships(client: AsyncClient, db: AsyncSession):
    from src.models.group import Group, GroupMembership

    await _post_webhook(
        client,
        {
            "type": "organization.created",
            "data": {"id": "org_del_test", "name": "Del Test Org"},
        },
    )
    await _post_webhook(
        client,
        {
            "type": "user.created",
            "data": {
                "id": "user_del_test",
                "first_name": "Del",
                "last_name": "User",
                "email_addresses": [{"email_address": "del@example.com"}],
            },
        },
    )
    await _post_webhook(
        client,
        {
            "type": "organizationMembership.created",
            "data": {
                "role": "org:member",
                "public_user_data": {"user_id": "user_del_test"},
                "organization": {"id": "org_del_test"},
            },
        },
    )

    resp = await _post_webhook(
        client,
        {
            "type": "organizationMembership.deleted",
            "data": {
                "public_user_data": {"user_id": "user_del_test"},
                "organization": {"id": "org_del_test"},
            },
        },
    )
    assert resp.status_code == 200

    user_res = await db.execute(select(User).where(User.clerk_id == "user_del_test"))
    user = user_res.scalars().first()
    org_res = await db.execute(
        select(Organisation).where(Organisation.clerk_org_id == "org_del_test")
    )
    org = org_res.scalars().first()

    grp_res = await db.execute(select(Group).where(Group.org_id == org.id))
    group_ids = [g.id for g in grp_res.scalars().all()]

    gm_res = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id.in_(group_ids),
            GroupMembership.user_id == user.id,
        )
    )
    assert gm_res.scalars().first() is None


@pytest.mark.asyncio
async def test_membership_created_is_idempotent(client: AsyncClient, db: AsyncSession):
    """Re-firing organizationMembership.created must not raise on the default-group insert."""
    from sqlalchemy import func
    from src.models.group import Group, GroupMembership

    await _post_webhook(
        client,
        {
            "type": "organization.created",
            "data": {"id": "org_idem", "name": "Idem Org"},
        },
    )
    await _post_webhook(
        client,
        {
            "type": "user.created",
            "data": {
                "id": "user_idem",
                "first_name": "I",
                "last_name": "Dem",
                "email_addresses": [{"email_address": "idem@example.com"}],
            },
        },
    )
    membership_payload = {
        "type": "organizationMembership.created",
        "data": {
            "role": "org:member",
            "public_user_data": {"user_id": "user_idem"},
            "organization": {"id": "org_idem"},
        },
    }
    resp1 = await _post_webhook(client, membership_payload)
    resp2 = await _post_webhook(client, membership_payload)
    assert resp1.status_code == 200
    assert resp2.status_code == 200, (
        "Re-delivered organizationMembership.created must not error — "
        "the default-group assignment must be idempotent."
    )

    user_res = await db.execute(select(User).where(User.clerk_id == "user_idem"))
    user = user_res.scalars().first()
    org_res = await db.execute(select(Organisation).where(Organisation.clerk_org_id == "org_idem"))
    org = org_res.scalars().first()
    grp_res = await db.execute(
        select(Group).where(Group.org_id == org.id, Group.is_default == True)  # noqa: E712
    )
    grp = grp_res.scalars().first()

    count_res = await db.execute(
        select(func.count())
        .select_from(GroupMembership)
        .where(
            GroupMembership.group_id == grp.id,
            GroupMembership.user_id == user.id,
        )
    )
    assert count_res.scalar_one() == 1


@pytest.mark.asyncio
async def test_membership_created_tolerates_missing_default_group(
    client: AsyncClient, db: AsyncSession
):
    """If organizationMembership.created arrives before organization.created
    (out-of-order webhook delivery), the handler must not crash. The user is
    left unassigned to any group; a follow-up delivery of organization.created
    is expected to reconcile."""
    from src.models.group import GroupMembership

    await user_repo.upsert_organisation(db, clerk_org_id="org_race", name="Race Org")
    await user_repo.upsert_user(
        db, clerk_id="user_race", email="race@example.com", display_name=None
    )
    await db.commit()

    resp = await _post_webhook(
        client,
        {
            "type": "organizationMembership.created",
            "data": {
                "role": "org:member",
                "public_user_data": {"user_id": "user_race"},
                "organization": {"id": "org_race"},
            },
        },
    )
    assert resp.status_code == 200

    user_res = await db.execute(select(User).where(User.clerk_id == "user_race"))
    user = user_res.scalars().first()
    assert user is not None

    gm_res = await db.execute(select(GroupMembership).where(GroupMembership.user_id == user.id))
    assert gm_res.scalars().first() is None
