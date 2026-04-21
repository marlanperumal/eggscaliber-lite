from datetime import date
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import PackageNotFoundError
from src.models.group import OrgSubscriptionRead
from src.models.package import PackageRead, PackageVisibility
from src.models.user import OrganisationRead
from src.repositories import admin_repo


async def list_orgs(session: AsyncSession) -> list[OrganisationRead]:
    orgs = await admin_repo.list_orgs(session)
    return [
        OrganisationRead(
            id=cast(int, o.id),
            clerk_org_id=o.clerk_org_id,
            name=o.name,
            created_at=o.created_at,
        )
        for o in orgs
    ]


async def list_subscriptions(session: AsyncSession, org_id: int) -> list[OrgSubscriptionRead]:
    subs = await admin_repo.list_subscriptions(session, org_id)
    return [
        OrgSubscriptionRead(
            id=cast(int, s.id),
            org_id=s.org_id,
            package_id=s.package_id,
            start_date=s.start_date,
            end_date=s.end_date,
            created_at=s.created_at,
        )
        for s in subs
    ]


async def create_subscription(
    session: AsyncSession,
    *,
    org_id: int,
    package_id: int,
    start_date: date,
    end_date: date | None,
) -> OrgSubscriptionRead:
    sub = await admin_repo.create_subscription(
        session,
        org_id=org_id,
        package_id=package_id,
        start_date=start_date,
        end_date=end_date,
    )
    return OrgSubscriptionRead(
        id=cast(int, sub.id),
        org_id=sub.org_id,
        package_id=sub.package_id,
        start_date=sub.start_date,
        end_date=sub.end_date,
        created_at=sub.created_at,
    )


async def delete_subscription(session: AsyncSession, org_id: int, package_id: int) -> None:
    await admin_repo.delete_subscription(session, org_id, package_id)


async def update_package_visibility(
    session: AsyncSession, package_id: int, visibility: PackageVisibility
) -> PackageRead:
    pkg = await admin_repo.update_package_visibility(session, package_id, visibility)
    if pkg is None:
        raise PackageNotFoundError(package_id)
    return PackageRead(
        id=cast(int, pkg.id),
        name=pkg.name,
        slug=pkg.slug,
        description=pkg.description,
        visibility=pkg.visibility,
        created_at=pkg.created_at,
    )
