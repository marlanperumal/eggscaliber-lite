from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.package import PackageRead
from src.models.user import OrgMemberRead
from src.repositories import package_repo, user_repo


async def list_members(session: AsyncSession, clerk_org_id: str) -> list[OrgMemberRead]:
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        return []
    rows = await user_repo.get_org_members(session, cast(int, org.id))
    return [
        OrgMemberRead(
            user_id=cast(int, row[0]),
            clerk_id=row[1],
            email=row[2],
            display_name=row[3],
            role=row[4],
        )
        for row in rows
    ]


async def list_subscribed_packages(session: AsyncSession, clerk_org_id: str) -> list[PackageRead]:
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        return []
    pkgs = await package_repo.get_org_subscribed_packages(session, cast(int, org.id))
    return [
        PackageRead(
            id=cast(int, p.id),
            name=p.name,
            slug=p.slug,
            description=p.description,
            visibility=p.visibility,
            created_at=p.created_at,
        )
        for p in pkgs
    ]
