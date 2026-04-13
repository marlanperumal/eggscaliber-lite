"""Seed script: just db-seed runs this as `python -m scripts.seed` from apps/api/."""

import asyncio
import random
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from src.config import settings
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response

random.seed(42)


async def run():
    db_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://", 1).replace(
        "postgres://", "postgresql+asyncpg://", 1
    )
    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        try:
            await _seed(session)
            await session.commit()
            print("Seed complete.")
        except Exception:
            await session.rollback()
            raise
    await engine.dispose()


async def _seed(session: AsyncSession):
    existing = (
        (await session.execute(select(Package).where(Package.slug == "demo-data")))
        .scalars()
        .first()
    )
    if existing:
        print("Demo Data package already exists — skipping.")
        return

    pkg = Package(
        name="Demo Data", slug="demo-data", description="Seed data for development and testing"
    )
    session.add(pkg)
    await session.flush()
    await session.refresh(pkg)

    await _seed_brand_tracker(session, pkg.id)
    await _seed_customer_satisfaction(session, pkg.id)
    await _seed_market_report(session, pkg.id)


# ─── Seed 1: Brand Tracker ────────────────────────────────────────────────────


async def _seed_brand_tracker(session: AsyncSession, package_id):
    col = Collection(
        name="Brand Tracker",
        slug="brand-tracker",
        collection_type=CollectionType.survey,
        package_id=package_id,
        description="Two-wave brand awareness tracker",
    )
    session.add(col)
    await session.flush()
    await session.refresh(col)

    for wave_num, wave_name, collected in [
        (1, "Wave 1", date(2025, 10, 1)),
        (2, "Wave 2", date(2026, 1, 1)),
    ]:
        ds = Dataset(
            name=wave_name,
            slug=f"brand-tracker-wave-{wave_num}",
            collection_id=col.id,
            sort_order=wave_num,
            collected_at=collected,
        )
        session.add(ds)
        await session.flush()
        await session.refresh(ds)
        await _define_brand_tracker_fields(session, ds.id, wave_num)
        await _add_brand_tracker_responses(session, ds.id, wave_num, n=50)


async def _define_brand_tracker_fields(session: AsyncSession, dataset_id, wave_num):
    brand_grp = FieldGroup(
        name="Brand Perception", slug="brand-perception", sort_order=0, dataset_id=dataset_id
    )
    demo_grp = FieldGroup(
        name="Demographics", slug="demographics", sort_order=1, dataset_id=dataset_id
    )
    session.add_all([brand_grp, demo_grp])
    await session.flush()
    await session.refresh(brand_grp)
    await session.refresh(demo_grp)

    brand_fields = [
        (
            "brand_awareness",
            "Brand Awareness",
            FieldType.categorical,
            [("aware", "Aware"), ("not_aware", "Not Aware")],
        ),
        (
            "brand_rating",
            "Brand Rating",
            FieldType.ordinal,
            [
                ("very_poor", "Very Poor"),
                ("poor", "Poor"),
                ("neutral", "Neutral"),
                ("good", "Good"),
                ("excellent", "Excellent"),
            ],
        ),
        (
            "media_used",
            "Media Used",
            FieldType.multi_response,
            [
                ("tv", "TV"),
                ("radio", "Radio"),
                ("social", "Social Media"),
                ("print", "Print"),
                ("other", "Other"),
            ]
            + ([("podcast", "Podcast")] if wave_num == 2 else []),
        ),
    ]
    demo_fields = [
        (
            "age_group",
            "Age Group",
            FieldType.categorical,
            [("18_34", "18–34"), ("35_54", "35–54"), ("55_plus", "55+")],
        ),
        (
            "gender",
            "Gender",
            FieldType.categorical,
            [
                ("male", "Male"),
                ("female", "Female"),
                ("non_binary", "Non-binary"),
                ("prefer_not", "Prefer not to say"),
            ],
        ),
    ]

    for i, (key, name, ftype, levels) in enumerate(brand_fields):
        f = Field(
            field_key=key,
            display_name=name,
            field_type=ftype,
            sort_order=i,
            is_filterable=True,
            dataset_id=dataset_id,
            group_id=brand_grp.id,
        )
        session.add(f)
        await session.flush()
        await session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label, sort_order=j, field_id=f.id))

    for i, (key, name, ftype, levels) in enumerate(demo_fields, start=len(brand_fields)):
        f = Field(
            field_key=key,
            display_name=name,
            field_type=ftype,
            sort_order=i,
            is_filterable=True,
            dataset_id=dataset_id,
            group_id=demo_grp.id,
        )
        session.add(f)
        await session.flush()
        await session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label, sort_order=j, field_id=f.id))

    session.add(
        Field(
            field_key="respondent_id",
            display_name="Respondent ID",
            field_type=FieldType.identifier,
            sort_order=90,
            is_filterable=False,
            dataset_id=dataset_id,
        )
    )
    session.add(
        Field(
            field_key="panel_weight",
            display_name="Panel Weight",
            field_type=FieldType.weight,
            sort_order=91,
            is_filterable=False,
            dataset_id=dataset_id,
        )
    )
    await session.flush()


async def _add_brand_tracker_responses(session: AsyncSession, dataset_id, wave_num, n):
    media_options = ["tv", "radio", "social", "print"]
    if wave_num == 2:
        media_options.append("podcast")

    for _ in range(n):
        chosen_media = random.sample(media_options, k=random.randint(1, 3))
        if random.random() < 0.1:
            chosen_media.append("other")

        payload: dict = {
            "respondent_id": str(uuid.uuid4()),
            "panel_weight": round(random.uniform(0.5, 1.5), 4),
            "brand_awareness": random.choice(["aware", "not_aware"]),
            "brand_rating": random.choice(["very_poor", "poor", "neutral", "good", "excellent"]),
            "media_used": chosen_media,
            "age_group": random.choice(["18_34", "35_54", "55_plus"]),
            "gender": random.choice(["male", "female", "non_binary", "prefer_not"]),
        }
        if "other" in chosen_media:
            payload["media_used_other"] = random.choice(
                ["TikTok", "YouTube", "Newsletter", "Word of mouth"]
            )
        session.add(Response(dataset_id=dataset_id, payload=payload))
    await session.flush()


# ─── Seed 2: Customer Satisfaction ───────────────────────────────────────────


async def _seed_customer_satisfaction(session: AsyncSession, package_id):
    col = Collection(
        name="Customer Satisfaction",
        slug="customer-satisfaction",
        collection_type=CollectionType.survey,
        package_id=package_id,
        description="Single-wave customer satisfaction survey",
    )
    session.add(col)
    await session.flush()
    await session.refresh(col)

    ds = Dataset(
        name="2026 Survey",
        slug="customer-satisfaction-2026",
        collection_id=col.id,
        sort_order=1,
        collected_at=date(2026, 2, 1),
    )
    session.add(ds)
    await session.flush()
    await session.refresh(ds)
    await _define_csat_fields(session, ds.id)
    await _add_csat_responses(session, ds.id, n=50)


async def _define_csat_fields(session: AsyncSession, dataset_id):
    fields = [
        (
            "overall_satisfaction",
            "Overall Satisfaction",
            FieldType.ordinal,
            [
                ("very_dissatisfied", "Very Dissatisfied"),
                ("dissatisfied", "Dissatisfied"),
                ("neutral", "Neutral"),
                ("satisfied", "Satisfied"),
                ("very_satisfied", "Very Satisfied"),
            ],
        ),
        (
            "product_used",
            "Product Used",
            FieldType.categorical,
            [("product_a", "Product A"), ("product_b", "Product B"), ("product_c", "Product C")],
        ),
        (
            "issues_experienced",
            "Issues Experienced",
            FieldType.multi_response,
            [
                ("delivery", "Delivery"),
                ("quality", "Quality"),
                ("support", "Support"),
                ("pricing", "Pricing"),
                ("other", "Other"),
            ],
        ),
    ]
    for i, (key, name, ftype, levels) in enumerate(fields):
        f = Field(
            field_key=key,
            display_name=name,
            field_type=ftype,
            sort_order=i,
            is_filterable=(ftype != FieldType.multi_response),
            dataset_id=dataset_id,
        )
        session.add(f)
        await session.flush()
        await session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label, sort_order=j, field_id=f.id))

    f = Field(
        field_key="nps_score",
        display_name="NPS Score",
        field_type=FieldType.numeric,
        sort_order=len(fields),
        is_filterable=False,
        dataset_id=dataset_id,
    )
    session.add(f)
    await session.flush()


async def _add_csat_responses(session: AsyncSession, dataset_id, n):
    issue_options = ["delivery", "quality", "support", "pricing"]
    for _ in range(n):
        issues = random.sample(issue_options, k=random.randint(0, 2))
        if random.random() < 0.08:
            issues.append("other")
        payload: dict = {
            "overall_satisfaction": random.choice(
                [
                    "very_dissatisfied",
                    "dissatisfied",
                    "neutral",
                    "satisfied",
                    "very_satisfied",
                ]
            ),
            "nps_score": random.randint(0, 10),
            "product_used": random.choice(["product_a", "product_b", "product_c"]),
        }
        if issues:
            payload["issues_experienced"] = issues
            if "other" in issues:
                payload["issues_experienced_other"] = random.choice(
                    ["Too expensive", "Poor UX", "Missing feature"]
                )
        session.add(Response(dataset_id=dataset_id, payload=payload))
    await session.flush()


# ─── Seed 3: Market Report ────────────────────────────────────────────────────


async def _seed_market_report(session: AsyncSession, package_id):
    col = Collection(
        name="Market Share Report",
        slug="market-share-report",
        collection_type=CollectionType.market_report,
        package_id=package_id,
        description="Quarterly market share by segment",
    )
    session.add(col)
    await session.flush()
    await session.refresh(col)

    for period_num, period_name, collected in [
        (1, "Q3 2025", date(2025, 9, 30)),
        (2, "Q4 2025", date(2025, 12, 31)),
    ]:
        ds = Dataset(
            name=period_name,
            slug=f"market-share-{period_name.lower().replace(' ', '-')}",
            collection_id=col.id,
            sort_order=period_num,
            collected_at=collected,
        )
        session.add(ds)
        await session.flush()
        await session.refresh(ds)
        await _define_market_fields(session, ds.id)
        await _add_market_responses(session, ds.id, n=30)


async def _define_market_fields(session: AsyncSession, dataset_id):
    fields_def = [
        (
            "segment",
            "Segment",
            FieldType.categorical,
            [
                ("enterprise", "Enterprise"),
                ("mid_market", "Mid-market"),
                ("smb", "SMB"),
                ("consumer", "Consumer"),
            ],
        ),
    ]
    for i, (key, name, ftype, levels) in enumerate(fields_def):
        f = Field(
            field_key=key,
            display_name=name,
            field_type=ftype,
            sort_order=i,
            is_filterable=True,
            dataset_id=dataset_id,
        )
        session.add(f)
        await session.flush()
        await session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label, sort_order=j, field_id=f.id))

    for i, (key, name) in enumerate(
        [("market_share", "Market Share (%)"), ("growth_rate", "Growth Rate (%)")],
        start=len(fields_def),
    ):
        session.add(
            Field(
                field_key=key,
                display_name=name,
                field_type=FieldType.numeric,
                sort_order=i,
                is_filterable=False,
                dataset_id=dataset_id,
            )
        )
    await session.flush()


async def _add_market_responses(session: AsyncSession, dataset_id, n):
    segments = ["enterprise", "mid_market", "smb", "consumer"]
    for _ in range(n):
        session.add(
            Response(
                dataset_id=dataset_id,
                payload={
                    "segment": random.choice(segments),
                    "market_share": round(random.uniform(5.0, 40.0), 1),
                    "growth_rate": round(random.uniform(-5.0, 15.0), 1),
                },
            )
        )
    await session.flush()


if __name__ == "__main__":
    asyncio.run(run())
