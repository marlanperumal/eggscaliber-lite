from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from src.main import app


async def _mock_stream():
    yield 'data: {"type":"start"}\n\n'
    yield 'data: {"type":"finish","finishReason":"stop"}\n\n'


@pytest.mark.asyncio
async def test_chat_returns_event_stream_with_vercel_header(client):
    """POST /ai/chat returns 200, text/event-stream content-type, and the Vercel header."""
    with patch("src.routes.ai.stream_response", return_value=_mock_stream()):
        response = await client.post(
            "/api/v1/ai/chat",
            json={"messages": [{"role": "user", "content": "test question"}]},
        )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert response.headers.get("x-vercel-ai-ui-message-stream") == "v1"
    assert 'data: {"type":"start"}' in response.text
    assert '"finishReason":"stop"' in response.text


@pytest.mark.asyncio
async def test_chat_returns_401_without_auth_in_production_mode():
    """POST /ai/chat returns 401 when no Authorization header is provided in production mode."""
    from src.config import settings

    saved_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        with patch.object(settings, "auth_mode", "production"):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                response = await c.post(
                    "/api/v1/ai/chat",
                    json={"messages": [{"role": "user", "content": "test"}]},
                )
    finally:
        app.dependency_overrides.update(saved_overrides)

    assert response.status_code == 401
