from __future__ import annotations

from typing import TYPE_CHECKING, cast

from sqlalchemy import delete, select

if TYPE_CHECKING:
    from src.models.package import Package
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.group import Group, GroupMembership, GroupPackage


async def create_group(
    session: AsyncSession,
    *,
    org_id: int,
    name: str,
    is_default: bool = False,
) -> Group:
    grp = Group(org_id=org_id, name=name, is_default=is_default)
    session.add(grp)
    await session.flush()
    await session.refresh(grp)
    return grp


async def get_default_group(session: AsyncSession, org_id: int) -> Group | None:
    result = await session.execute(
        select(Group).where(Group.org_id == org_id, Group.is_default == True)  # noqa: E712
    )
    return result.scalars().first()


async def get_groups_for_org(session: AsyncSession, org_id: int) -> list[Group]:
    result = await session.execute(select(Group).where(Group.org_id == org_id))
    return list(result.scalars().all())


async def get_group_by_id(session: AsyncSession, group_id: int) -> Group | None:
    return await session.get(Group, group_id)


async def delete_group(session: AsyncSession, group: Group) -> None:
    await session.delete(group)
    await session.flush()


async def add_member(session: AsyncSession, *, group_id: int, user_id: int) -> None:
    gm = GroupMembership(group_id=group_id, user_id=user_id)
    session.add(gm)
    await session.flush()


async def remove_member(session: AsyncSession, *, group_id: int, user_id: int) -> None:
    await session.execute(
        delete(GroupMembership).where(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == user_id,
        )
    )
    await session.flush()


async def remove_user_from_org_groups(session: AsyncSession, *, user_id: int, org_id: int) -> None:
    group_ids_result = await session.execute(select(Group.id).where(Group.org_id == org_id))
    group_ids = [gid for gid in group_ids_result.scalars().all() if gid is not None]
    if group_ids:
        await session.execute(
            delete(GroupMembership).where(
                GroupMembership.group_id.in_(group_ids),
                GroupMembership.user_id == user_id,
            )
        )
        await session.flush()


async def add_user_to_default_group(session: AsyncSession, *, user_id: int, org_id: int) -> None:
    grp = await get_default_group(session, org_id)
    if grp is None:
        return
    existing = await session.execute(
        select(GroupMembership).where(
            GroupMembership.group_id == cast(int, grp.id),
            GroupMembership.user_id == user_id,
        )
    )
    if existing.scalars().first() is not None:
        return
    await add_member(session, group_id=cast(int, grp.id), user_id=user_id)


async def assign_package(session: AsyncSession, *, group_id: int, package_id: int) -> None:
    gp = GroupPackage(group_id=group_id, package_id=package_id)
    session.add(gp)
    await session.flush()


async def unassign_package(session: AsyncSession, *, group_id: int, package_id: int) -> None:
    await session.execute(
        delete(GroupPackage).where(
            GroupPackage.group_id == group_id,
            GroupPackage.package_id == package_id,
        )
    )
    await session.flush()


async def count_members(session: AsyncSession, group_id: int) -> int:
    from sqlalchemy import func

    result = await session.execute(
        select(func.count())
        .select_from(GroupMembership)
        .where(GroupMembership.group_id == group_id)
    )
    return result.scalar_one()


async def count_packages(session: AsyncSession, group_id: int) -> int:
    from sqlalchemy import func

    result = await session.execute(
        select(func.count()).select_from(GroupPackage).where(GroupPackage.group_id == group_id)
    )
    return result.scalar_one()


async def get_members_for_group(
    session: AsyncSession, group_id: int, org_id: int
) -> list[tuple[int | None, str, str | None, str | None, str]]:
    """Return (user_id, clerk_id, email, display_name, role) rows for all members of a group."""
    from src.models.user import OrgMembership, User

    result = await session.execute(
        select(User.id, User.clerk_id, User.email, User.display_name, OrgMembership.role)
        .join(GroupMembership, GroupMembership.user_id == User.id)
        .join(
            OrgMembership,
            (OrgMembership.user_id == User.id) & (OrgMembership.org_id == org_id),
        )
        .where(GroupMembership.group_id == group_id)
    )
    return cast(list[tuple[int | None, str, str | None, str | None, str]], list(result.all()))


async def get_packages_for_group(session: AsyncSession, group_id: int) -> list[Package]:
    """Return Package ORM objects for all packages assigned to a group."""
    from src.models.package import Package

    result = await session.execute(
        select(Package)
        .join(GroupPackage, GroupPackage.package_id == Package.id)
        .where(GroupPackage.group_id == group_id)
    )
    return list(result.scalars().all())
