from typing import TYPE_CHECKING, cast

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import CannotDeleteDefaultGroupError, ForbiddenError, GroupNotFoundError
from src.models.group import (
    GroupCreate,
    GroupMemberRead,
    GroupPackageRead,
    GroupRead,
    GroupWithCounts,
)
from src.repositories import group_repo, user_repo

if TYPE_CHECKING:
    from src.auth import CurrentUser


async def _require_admin(session: AsyncSession, current_user: "CurrentUser") -> None:
    """Raises ForbiddenError if user is not an org admin."""
    if current_user.org_id is None:
        raise ForbiddenError("No active organisation")
    role = await user_repo.get_user_org_role(session, current_user.clerk_id, current_user.org_id)
    if role != "admin":
        raise ForbiddenError("Organisation admin access required")


async def list_groups(session: AsyncSession, clerk_org_id: str) -> list[GroupWithCounts]:
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        return []
    groups = await group_repo.get_groups_for_org(session, cast(int, org.id))
    result = []
    for g in groups:
        member_count = await group_repo.count_members(session, cast(int, g.id))
        package_count = await group_repo.count_packages(session, cast(int, g.id))
        result.append(
            GroupWithCounts(
                id=cast(int, g.id),
                org_id=cast(int, g.org_id),
                name=g.name,
                is_default=g.is_default,
                member_count=member_count,
                package_count=package_count,
            )
        )
    return result


async def create_group(
    session: AsyncSession, clerk_org_id: str, body: GroupCreate, current_user: "CurrentUser"
) -> GroupRead:
    await _require_admin(session, current_user)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        raise ForbiddenError("Organisation not found")
    grp = await group_repo.create_group(session, org_id=cast(int, org.id), name=body.name)
    return GroupRead.model_validate(grp.model_dump())


async def delete_group(
    session: AsyncSession, group_id: int, clerk_org_id: str, current_user: "CurrentUser"
) -> None:
    await _require_admin(session, current_user)
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    if grp.is_default:
        raise CannotDeleteDefaultGroupError()
    await group_repo.delete_group(session, grp)


async def add_member(
    session: AsyncSession,
    group_id: int,
    user_id: int,
    clerk_org_id: str,
    current_user: "CurrentUser",
) -> None:
    await _require_admin(session, current_user)
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.add_member(session, group_id=group_id, user_id=user_id)


async def remove_member(
    session: AsyncSession,
    group_id: int,
    user_id: int,
    clerk_org_id: str,
    current_user: "CurrentUser",
) -> None:
    await _require_admin(session, current_user)
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.remove_member(session, group_id=group_id, user_id=user_id)


async def assign_package(
    session: AsyncSession,
    group_id: int,
    package_id: int,
    clerk_org_id: str,
    current_user: "CurrentUser",
) -> None:
    await _require_admin(session, current_user)
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.assign_package(session, group_id=group_id, package_id=package_id)


async def unassign_package(
    session: AsyncSession,
    group_id: int,
    package_id: int,
    clerk_org_id: str,
    current_user: "CurrentUser",
) -> None:
    await _require_admin(session, current_user)
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.unassign_package(session, group_id=group_id, package_id=package_id)


async def list_group_members(
    session: AsyncSession, group_id: int, clerk_org_id: str
) -> list[GroupMemberRead]:
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        return []
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    if grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    rows = await group_repo.get_members_for_group(session, group_id, cast(int, org.id))
    return [
        GroupMemberRead(
            user_id=row[0],
            clerk_id=row[1],
            email=row[2],
            display_name=row[3],
            role=row[4],
        )
        for row in rows
    ]


async def list_group_packages(
    session: AsyncSession, group_id: int, clerk_org_id: str
) -> list[GroupPackageRead]:
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        return []
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    if grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    pkgs = await group_repo.get_packages_for_group(session, group_id)
    return [
        GroupPackageRead(
            package_id=cast(int, p.id),
            name=p.name,
            slug=p.slug,
            visibility=p.visibility,
        )
        for p in pkgs
    ]
