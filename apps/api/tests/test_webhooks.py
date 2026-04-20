import json
from typing import cast
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
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
