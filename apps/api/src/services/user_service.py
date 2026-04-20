from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories import user_repo


async def handle_clerk_event(session: AsyncSession, payload: dict[str, object]) -> None:
    event_type: str = str(payload.get("type", ""))
    data: dict[str, object] = dict(payload.get("data", {}))

    if event_type in ("user.created", "user.updated"):
        email_addresses = list(data.get("email_addresses", []))
        first_addr = dict(email_addresses[0]) if email_addresses else {}
        email = str(first_addr.get("email_address", ""))
        first_name = str(data.get("first_name") or "")
        last_name = str(data.get("last_name") or "")
        display_name = f"{first_name} {last_name}".strip() or None
        await user_repo.upsert_user(
            session,
            clerk_id=str(data["id"]),
            email=email,
            display_name=display_name,
        )

    elif event_type in ("organization.created", "organization.updated"):
        await user_repo.upsert_organisation(
            session,
            clerk_org_id=str(data["id"]),
            name=str(data["name"]),
        )

    elif event_type == "organizationMembership.created":
        user_data = dict(data.get("public_user_data", {}))
        org_data = dict(data.get("organization", {}))
        user_clerk_id = str(user_data["user_id"])
        org_clerk_id = str(org_data["id"])
        role = str(data.get("role", "org:member")).removeprefix("org:")
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
        user_data = dict(data.get("public_user_data", {}))
        org_data = dict(data.get("organization", {}))
        await user_repo.delete_membership(
            session,
            user_clerk_id=str(user_data["user_id"]),
            org_clerk_id=str(org_data["id"]),
        )
