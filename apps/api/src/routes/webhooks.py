from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel
from svix.webhooks import Webhook, WebhookVerificationError

from src.config import settings
from src.database import get_session
from src.repositories import user_repo

router = APIRouter(tags=["webhooks"])


class WebhookAck(SQLModel):
    status: str


@router.post("/webhooks/clerk", response_model=WebhookAck)
async def clerk_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> WebhookAck:
    """Receive and process Clerk webhook events."""
    raw_body = await request.body()
    headers = dict(request.headers)

    try:
        wh = Webhook(settings.clerk_webhook_secret)
        payload = wh.verify(raw_body, headers)
    except (WebhookVerificationError, RuntimeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from None

    event_type: str = payload.get("type", "")
    data: dict = payload.get("data", {})

    if event_type in ("user.created", "user.updated"):
        email_addresses = data.get("email_addresses", [])
        email = email_addresses[0]["email_address"] if email_addresses else ""
        first_name = data.get("first_name") or ""
        last_name = data.get("last_name") or ""
        display_name = f"{first_name} {last_name}".strip() or None
        await user_repo.upsert_user(
            session,
            clerk_id=data["id"],
            email=email,
            display_name=display_name,
        )

    elif event_type in ("organization.created", "organization.updated"):
        await user_repo.upsert_organisation(
            session,
            clerk_org_id=data["id"],
            name=data["name"],
        )

    elif event_type == "organizationMembership.created":
        user_clerk_id: str = data["public_user_data"]["user_id"]
        org_clerk_id: str = data["organization"]["id"]
        role: str = data.get("role", "org:member").removeprefix("org:")
        user = await user_repo.get_user_by_clerk_id(session, user_clerk_id)
        org = await user_repo.get_org_by_clerk_id(session, org_clerk_id)
        if user is not None and org is not None:
            await user_repo.upsert_membership(
                session,
                user_id=cast(int, user.id),
                org_id=cast(int, org.id),
                role=role,
            )

    elif event_type == "organizationMembership.deleted":
        user_clerk_id = data["public_user_data"]["user_id"]
        org_clerk_id = data["organization"]["id"]
        await user_repo.delete_membership(
            session,
            user_clerk_id=user_clerk_id,
            org_clerk_id=org_clerk_id,
        )

    return WebhookAck(status="ok")
