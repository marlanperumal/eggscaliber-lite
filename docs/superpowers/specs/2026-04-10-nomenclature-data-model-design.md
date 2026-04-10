# Nomenclature & Data Model Design

**Date:** 2026-04-10
**Project:** Eggscaliber-Lite
**Scope:** Sub-project 2 of 5 — naming hierarchy, field types, Postgres schema, response storage, consistency validation, seed data

---

## Overview

This sub-project establishes the core data model that every subsequent sub-project builds on. It defines how datasets are organised, what kinds of fields they can contain, how respondent-level data is stored, and how consistency across related datasets is validated.

**Approach:** Option A — flat per-Dataset fields with key-based linking. Fields and Levels are defined per Dataset. A `field_key` slug links logically equivalent Fields across Datasets in the same Collection. Consistency validation is service-layer, not a schema constraint.

**Done when:** Schema finalised, Alembic migrations applied, seed data representing 3 real dataset structures loaded, OpenAPI types generated.

---

## Entity Hierarchy

```
Package
  └── Collection  (collection_type drives UI display names)
        └── Dataset  (sort_order controls wave/period ordering)
              └── Field  (field_key links equivalent fields across datasets)
                    └── Level  (ordered or unordered values a field can take)

Response  (one row per respondent per Dataset, payload JSONB)
```

### Display Name Overrides

`collection_type` is an enum on Collection. The UI layer resolves display names — the DB names are always generic:

| `collection_type` | Package | Collection | Dataset | Field | Level |
|---|---|---|---|---|---|
| `survey` | Package | Survey | Wave | Question | Response |
| `market_report` | Package | Report | Period | Metric | Value |
| `demographics` | Package | Study | Release | Indicator | Category |
| `generic` | Package | Collection | Dataset | Field | Level |

---

## Schema

### Package

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | str | Display name |
| `slug` | str unique | URL-safe identifier |
| `description` | str \| None | |
| `created_at` | datetime | |

### Collection

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `package_id` | int FK → Package | |
| `name` | str | |
| `slug` | str unique | |
| `description` | str \| None | |
| `collection_type` | enum | `survey`, `market_report`, `demographics`, `generic` (default) |
| `created_at` | datetime | |

### Dataset

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `collection_id` | int FK → Collection | |
| `name` | str | e.g. "Wave 3", "Q1 2026" |
| `slug` | str unique | |
| `description` | str \| None | |
| `sort_order` | int | Controls ordering within a Collection for trending |
| `collected_at` | date \| None | When the data was collected |
| `created_at` | datetime | |

### Field

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `dataset_id` | int FK → Dataset | |
| `field_key` | str | Slug linking equivalent fields across Datasets (e.g. `brand_awareness`) |
| `display_name` | str | Human-readable label |
| `field_type` | enum | `numeric`, `ordinal`, `categorical`, `multi_response` |
| `sort_order` | int | Display order within a Dataset |
| `is_filterable` | bool | Whether this field can be used as an analytics filter |
| `created_at` | datetime | |

**Index:** `(dataset_id, field_key)` — unique within a Dataset; used for consistency checks across Datasets.

### Level

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `field_id` | int FK → Field | |
| `value` | str | Raw stored value (used in Response payload) |
| `display_label` | str | Human-readable label shown in UI |
| `sort_order` | int | For ordinals: defines the ordering; for categoricals: display order |
| `created_at` | datetime | |

Levels are defined for `ordinal`, `categorical`, and `multi_response` fields. `numeric` fields have no Levels.

### Response

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `dataset_id` | int FK → Dataset | |
| `payload` | JSONB | One key per Field (`field_key` → value) |
| `created_at` | datetime | |

**Indexes:**
- `btree` on `dataset_id` — all analytics queries filter here first
- `GIN` on `payload` — enables `?` (key exists) and `@>` (array contains) operators

---

## Response Payload Conventions

Values are stored using the Level's `value` string, not `display_label`. Display is resolved via Level metadata at query time.

| `field_type` | Payload shape | Example |
|---|---|---|
| `numeric` | `"key": number` | `"nps_score": 8` |
| `ordinal` | `"key": "value"` | `"satisfaction": "Agree"` |
| `categorical` | `"key": "value"` | `"gender": "Female"` |
| `multi_response` | `"key": ["value", ...]` | `"media_used": ["TV", "Social Media"]` |
| `multi_response` + Other | `"key": [..., "Other"], "key_other": "text"` | `"media_used": ["TV", "Other"], "media_used_other": "TikTok"` |

Missing fields are absent from the payload (not null). The analytics engine treats absence and null as equivalent non-responses.

---

## Consistency Validation

Validation is computed from Field and Level data — no separate DB table.

`CollectionService.check_field_consistency(collection_id) → list[FieldInconsistency]`

Each `FieldInconsistency` describes:

| `inconsistency_type` | Meaning |
|---|---|
| `type_mismatch` | Same `field_key` has different `field_type` across Datasets |
| `level_added` | A Level value exists in some Datasets but not others |
| `level_removed` | A Level present in earlier Datasets is absent in later ones |
| `missing_field` | `field_key` is absent from one or more Datasets in the Collection |

**Called:**
1. On Dataset save — returns warnings, never blocks the save
2. On demand — `GET /api/v1/collections/{id}/consistency`

Divergences are allowed. Validation surfaces them for human review; it does not reject data.

---

## Seed Data

All seeds live in a single Package: **"Demo Data"**.

### Seed 1 — Brand Tracker (`survey`, 2 waves)

Demonstrates: trending, multi-response + Other, a Level added in Wave 2 (triggers `level_added` inconsistency).

**Fields (both waves unless noted):**

| `field_key` | `field_type` | Levels |
|---|---|---|
| `brand_awareness` | `categorical` | Aware, Not Aware |
| `brand_rating` | `ordinal` | Very Poor, Poor, Neutral, Good, Excellent |
| `media_used` | `multi_response` | TV, Radio, Social Media, Print, Other *(Wave 2 adds: Podcast)* |
| `age_group` | `categorical` | 18–34, 35–54, 55+ |
| `gender` | `categorical` | Male, Female, Non-binary, Prefer not to say |

~50 seed respondents per wave.

### Seed 2 — Customer Satisfaction (`survey`, 1 wave)

Demonstrates: numeric field type, single-wave use case.

| `field_key` | `field_type` | Notes |
|---|---|---|
| `overall_satisfaction` | `ordinal` | Very Dissatisfied → Very Satisfied (5-point) |
| `nps_score` | `numeric` | 0–10 |
| `product_used` | `categorical` | Product A, Product B, Product C |
| `issues_experienced` | `multi_response` | Delivery, Quality, Support, Pricing, Other |

~50 seed respondents.

### Seed 3 — Market Report (`market_report`, 2 periods)

Demonstrates: `collection_type` display name override, numeric-heavy dataset.

| `field_key` | `field_type` | Notes |
|---|---|---|
| `market_share` | `numeric` | Percentage |
| `growth_rate` | `numeric` | Percentage, can be negative |
| `segment` | `categorical` | Enterprise, Mid-market, SMB, Consumer |

~30 seed rows per period.

---

## API Surface

Routes follow the existing `/api/v1/` prefix and 3-layer architecture.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/packages` | List packages |
| `GET` | `/api/v1/packages/{id}` | Get package with collections |
| `GET` | `/api/v1/collections/{id}` | Get collection with datasets |
| `GET` | `/api/v1/collections/{id}/consistency` | Run consistency check |
| `GET` | `/api/v1/datasets/{id}` | Get dataset with fields and levels |
| `GET` | `/api/v1/datasets/{id}/responses` | Paginated response rows (dev/debug only) |

No write endpoints in this sub-project — data enters via seed scripts. Write endpoints come in Sub-project 4 (Data Ingestion).

---

## Implementation Notes

- All models use the SQLModel pattern from `docs/patterns/backend.md`: `Base`, `table=True`, `Create`, `Read` variants
- Enums (`CollectionType`, `FieldType`) defined as Python `Enum` classes, stored as Postgres `VARCHAR` (not native enum) for easier migration
- `field_key` is a plain slug string — no FK to a separate canonical table (Option A)
- `Response.payload` uses SQLModel's `JSON` field type; GIN index added manually in the migration
- Seed scripts live in `apps/api/seeds/` and are run via `just db-seed`
- `just generate-types` run after schema is stable to produce `packages/shared/api.d.ts`
