from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from src.database import get_session
from src.main import app


@pytest.mark.asyncio
async def test_protected_route_without_auth_returns_401():
    """Unauthenticated request to a protected route must return 401."""
    with patch("src.auth.settings") as mock_settings:
        mock_settings.auth_mode = "jwt"
        mock_settings.clerk_jwt_key = ""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/packages")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_health_route_without_auth_returns_200():
    """Health route must remain publicly accessible without auth."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_webhook_route_without_auth_returns_400_not_401():
    """Webhook route must not require bearer auth — it uses svix signature verification instead."""
    mock_session = MagicMock()

    async def override_get_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_get_session
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/webhooks/clerk",
                content=b"{}",
                headers={
                    "content-type": "application/json",
                    "svix-id": "msg_test",
                    "svix-timestamp": "1234567890",
                    "svix-signature": "v1,invalidsig",
                },
            )
        assert response.status_code == 400
    finally:
        app.dependency_overrides.pop(get_session, None)
