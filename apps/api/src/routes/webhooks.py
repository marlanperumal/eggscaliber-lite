from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from src.config import settings
from src.database import get_session
from src.models.user import WebhookAck
from src.services import user_service

router = APIRouter(tags=["webhooks"])


@router.post("/webhooks/clerk", response_model=WebhookAck)
async def clerk_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> WebhookAck:
    """Receive and process Clerk webhook events."""
    raw_body = await request.body()
    try:
        wh = Webhook(settings.clerk_webhook_secret)
        payload = wh.verify(raw_body, dict(request.headers))
    except (WebhookVerificationError, RuntimeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from None
    await user_service.handle_clerk_event(session, payload)
    return WebhookAck(status="ok")
