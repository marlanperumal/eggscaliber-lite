from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import CannotDeleteDefaultGroupError, ForbiddenError, GroupNotFoundError
from src.models.group import GroupCreate, GroupRead, GroupWithCounts
from src.repositories import group_repo, user_repo


async def list_groups(session: AsyncSession, clerk_org_id: str) -> list[GroupWithCounts]:
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        return []
    groups = await group_repo.get_groups_for_org(session, cast(int, org.id))
    return [
        GroupWithCounts(
            id=cast(int, g.id),
            org_id=cast(int, g.org_id),
            name=g.name,
            is_default=g.is_default,
            member_count=0,
            package_count=0,
        )
        for g in groups
    ]


async def create_group(session: AsyncSession, clerk_org_id: str, body: GroupCreate) -> GroupRead:
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        raise ForbiddenError("Organisation not found")
    grp = await group_repo.create_group(session, org_id=cast(int, org.id), name=body.name)
    return GroupRead.model_validate(grp.model_dump())


async def delete_group(session: AsyncSession, group_id: int, clerk_org_id: str) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    if grp.is_default:
        raise CannotDeleteDefaultGroupError()
    await group_repo.delete_group(session, grp)


async def add_member(session: AsyncSession, group_id: int, user_id: int, clerk_org_id: str) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.add_member(session, group_id=group_id, user_id=user_id)


async def remove_member(
    session: AsyncSession, group_id: int, user_id: int, clerk_org_id: str
) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.remove_member(session, group_id=group_id, user_id=user_id)


async def assign_package(
    session: AsyncSession, group_id: int, package_id: int, clerk_org_id: str
) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.assign_package(session, group_id=group_id, package_id=package_id)


async def unassign_package(
    session: AsyncSession, group_id: int, package_id: int, clerk_org_id: str
) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.unassign_package(session, group_id=group_id, package_id=package_id)
