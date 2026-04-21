from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.models.user import Organisation, OrgMembership, User


async def upsert_user(
    session: AsyncSession,
    *,
    clerk_id: str,
    email: str,
    display_name: str | None,
) -> User:
    result = await session.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalars().first()
    if user is None:
        user = User(clerk_id=clerk_id, email=email, display_name=display_name)
    else:
        user.email = email
        user.display_name = display_name
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user


async def get_user_by_clerk_id(session: AsyncSession, clerk_id: str) -> User | None:
    result = await session.execute(select(User).where(User.clerk_id == clerk_id))
    return result.scalars().first()


async def upsert_organisation(
    session: AsyncSession,
    *,
    clerk_org_id: str,
    name: str,
) -> Organisation:
    result = await session.execute(
        select(Organisation).where(Organisation.clerk_org_id == clerk_org_id)
    )
    org = result.scalars().first()
    if org is None:
        org = Organisation(clerk_org_id=clerk_org_id, name=name)
    else:
        org.name = name
    session.add(org)
    await session.flush()
    await session.refresh(org)
    return org


async def get_org_by_clerk_id(session: AsyncSession, clerk_org_id: str) -> Organisation | None:
    result = await session.execute(
        select(Organisation).where(Organisation.clerk_org_id == clerk_org_id)
    )
    return result.scalars().first()


async def upsert_membership(
    session: AsyncSession,
    *,
    user_id: int,
    org_id: int,
    role: str,
) -> OrgMembership:
    result = await session.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user_id,
            OrgMembership.org_id == org_id,
        )
    )
    membership = result.scalars().first()
    if membership is None:
        membership = OrgMembership(user_id=user_id, org_id=org_id, role=role)
    else:
        membership.role = role
    session.add(membership)
    await session.flush()
    await session.refresh(membership)
    return membership


async def get_membership(
    session: AsyncSession,
    *,
    user_id: int,
    org_id: int,
) -> OrgMembership | None:
    result = await session.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user_id,
            OrgMembership.org_id == org_id,
        )
    )
    return result.scalars().first()


async def get_user_org_role(
    session: AsyncSession, user_clerk_id: str, org_clerk_id: str
) -> str | None:
    """Returns the user's role in the org, or None if not a member."""
    result = await session.execute(
        select(OrgMembership.role)
        .join(User, User.id == OrgMembership.user_id)
        .join(Organisation, Organisation.id == OrgMembership.org_id)
        .where(
            User.clerk_id == user_clerk_id,
            Organisation.clerk_org_id == org_clerk_id,
        )
    )
    return result.scalar_one_or_none()


async def get_org_members(
    session: AsyncSession, org_id: int
) -> list[tuple[int | None, str, str | None, str | None, str]]:
    """Return (user_id, clerk_id, email, display_name, role) rows for all org members."""
    result = await session.execute(
        select(User.id, User.clerk_id, User.email, User.display_name, OrgMembership.role)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .where(OrgMembership.org_id == org_id)
    )
    return list(result.all())


async def delete_membership(
    session: AsyncSession,
    *,
    user_clerk_id: str,
    org_clerk_id: str,
) -> None:
    user = await get_user_by_clerk_id(session, user_clerk_id)
    org = await get_org_by_clerk_id(session, org_clerk_id)
    if user is None or org is None:
        return
    membership = await get_membership(session, user_id=cast(int, user.id), org_id=cast(int, org.id))
    if membership is not None:
        await session.delete(membership)
        await session.flush()
