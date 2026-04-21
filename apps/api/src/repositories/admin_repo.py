from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.group import OrgSubscription
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation


async def list_orgs(session: AsyncSession) -> list[Organisation]:
    result = await session.execute(select(Organisation))
    return list(result.scalars().all())


async def get_org_by_id(session: AsyncSession, org_id: int) -> Organisation | None:
    return await session.get(Organisation, org_id)


async def list_subscriptions(session: AsyncSession, org_id: int) -> list[OrgSubscription]:
    result = await session.execute(select(OrgSubscription).where(OrgSubscription.org_id == org_id))
    return list(result.scalars().all())


async def create_subscription(
    session: AsyncSession,
    *,
    org_id: int,
    package_id: int,
    start_date: date,
    end_date: date | None = None,
) -> OrgSubscription:
    sub = OrgSubscription(
        org_id=org_id,
        package_id=package_id,
        start_date=start_date,
        end_date=end_date,
    )
    session.add(sub)
    await session.flush()
    await session.refresh(sub)
    return sub


async def delete_subscription(session: AsyncSession, org_id: int, package_id: int) -> None:
    await session.execute(
        delete(OrgSubscription).where(
            OrgSubscription.org_id == org_id,
            OrgSubscription.package_id == package_id,
        )
    )
    await session.flush()


async def update_package_visibility(
    session: AsyncSession, package_id: int, visibility: PackageVisibility
) -> Package | None:
    pkg = await session.get(Package, package_id)
    if pkg is None:
        return None
    pkg.visibility = visibility
    await session.flush()
    await session.refresh(pkg)
    return pkg
