"""Seed script: just db-seed runs this as `python -m scripts.seed` from apps/api/."""

import random
from datetime import date

from sqlalchemy import select
from src.database import SessionLocal
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response

random.seed(42)


def run():
    session = SessionLocal()
    try:
        _seed(session)
        session.commit()
        print("Seed complete.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _seed(session):
    existing = session.execute(select(Package).where(Package.slug == "demo-data")).scalars().first()
    if existing:
        print("Demo Data package already exists — skipping.")
        return

    pkg = Package(
        name="Demo Data", slug="demo-data", description="Seed data for development and testing"
    )
    session.add(pkg)
    session.flush()
    session.refresh(pkg)

    _seed_brand_tracker(session, pkg.id)
    _seed_customer_satisfaction(session, pkg.id)
    _seed_market_report(session, pkg.id)


# ─── Seed 1: Brand Tracker ────────────────────────────────────────────────────


def _seed_brand_tracker(session, package_id):
    col = Collection(
        name="Brand Tracker",
        slug="brand-tracker",
        collection_type=CollectionType.survey,
        package_id=package_id,
        description="Two-wave brand awareness tracker",
    )
    session.add(col)
    session.flush()
    session.refresh(col)

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
        session.flush()
        session.refresh(ds)
        _define_brand_tracker_fields(session, ds.id, wave_num)
        _add_brand_tracker_responses(session, ds.id, wave_num, n=50)


def _define_brand_tracker_fields(session, dataset_id, wave_num):
    fields = [
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
    for i, (key, name, ftype, levels) in enumerate(fields):
        f = Field(
            field_key=key,
            display_name=name,
            field_type=ftype,
            sort_order=i,
            is_filterable=True,
            dataset_id=dataset_id,
        )
        session.add(f)
        session.flush()
        session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label, sort_order=j, field_id=f.id))
    session.flush()


def _add_brand_tracker_responses(session, dataset_id, wave_num, n):
    media_options = ["tv", "radio", "social", "print"]
    if wave_num == 2:
        media_options.append("podcast")

    for _ in range(n):
        chosen_media = random.sample(media_options, k=random.randint(1, 3))
        if random.random() < 0.1:
            chosen_media.append("other")

        payload: dict = {
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
    session.flush()


# ─── Seed 2: Customer Satisfaction ───────────────────────────────────────────


def _seed_customer_satisfaction(session, package_id):
    col = Collection(
        name="Customer Satisfaction",
        slug="customer-satisfaction",
        collection_type=CollectionType.survey,
        package_id=package_id,
        description="Single-wave customer satisfaction survey",
    )
    session.add(col)
    session.flush()
    session.refresh(col)

    ds = Dataset(
        name="2026 Survey",
        slug="customer-satisfaction-2026",
        collection_id=col.id,
        sort_order=1,
        collected_at=date(2026, 2, 1),
    )
    session.add(ds)
    session.flush()
    session.refresh(ds)
    _define_csat_fields(session, ds.id)
    _add_csat_responses(session, ds.id, n=50)


def _define_csat_fields(session, dataset_id):
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
        session.flush()
        session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label, sort_order=j, field_id=f.id))

    # NPS score — numeric, no levels
    f = Field(
        field_key="nps_score",
        display_name="NPS Score",
        field_type=FieldType.numeric,
        sort_order=len(fields),
        is_filterable=False,
        dataset_id=dataset_id,
    )
    session.add(f)
    session.flush()


def _add_csat_responses(session, dataset_id, n):
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
    session.flush()


# ─── Seed 3: Market Report ────────────────────────────────────────────────────


def _seed_market_report(session, package_id):
    col = Collection(
        name="Market Share Report",
        slug="market-share-report",
        collection_type=CollectionType.market_report,
        package_id=package_id,
        description="Quarterly market share by segment",
    )
    session.add(col)
    session.flush()
    session.refresh(col)

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
        session.flush()
        session.refresh(ds)
        _define_market_fields(session, ds.id)
        _add_market_responses(session, ds.id, n=30)


def _define_market_fields(session, dataset_id):
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
        session.flush()
        session.refresh(f)
        for j, (val, label) in enumerate(levels):
            session.add(Level(value=val, display_label=label, sort_order=j, field_id=f.id))

    # Numeric fields — no levels
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
    session.flush()


def _add_market_responses(session, dataset_id, n):
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
    session.flush()


if __name__ == "__main__":
    run()
