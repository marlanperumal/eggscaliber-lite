# Analytics Engine Design

**Date:** 2026-04-11
**Project:** Eggscaliber-Lite
**Scope:** Sub-project 3 of 5 — cross-tab and trending queries, field tree, query builder UI, table and chart output, feature-flagged prototype

---

## Overview

This sub-project delivers the first end-to-end analytics experience: a user selects a dataset or collection, configures row/column fields, optional filters and a measure, then views results as a table and chart. Two analysis modes are supported — cross-tab (single dataset) and trending (multiple datasets over time). The feature is deployed behind a PostHog feature flag.

**Done when:** Select dataset → configure cross-tab or trending analysis → view table + chart → deployed to Vercel/Render behind `analytics-engine` flag.

---

## Data Model Changes

### New: `FieldGroup` table

A new table groups `Field` entities into a labelled hierarchy for display in the field tree.

| Column      | Type         | Notes                                      |
| ----------- | ------------ | ------------------------------------------ |
| `id`        | int PK       |                                            |
| `dataset_id`| int FK       | → Dataset                                  |
| `parent_id` | int FK       | → FieldGroup (nullable — null = root)      |
| `name`      | str          | Display label for the branch               |
| `slug`      | str          | URL-safe identifier                        |
| `sort_order`| int          | Display order among siblings               |
| `created_at`| datetime     |                                            |

**No depth cap.** Complex surveys may require more than 2 levels. Tree queries use a recursive CTE (`WITH RECURSIVE`) — survey field trees are small enough (typically < 200 nodes) that this is fast without special indexes.

### Modified: `Field`

Add one nullable column and two new `field_type` values:

| Column     | Type      | Notes                                          |
| ---------- | --------- | ---------------------------------------------- |
| `group_id` | int FK    | → FieldGroup (nullable — null = ungrouped)     |

**Extended `field_type` enum** (adds to existing `numeric | ordinal | categorical | multi_response`):

| Value        | Meaning                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `identifier` | Unique record key (e.g. `respondent_id`). Never shown in field tree or analytics. |
| `weight`     | Sampling/weighting variable. Available only in the Weighted measure picker.        |

`identifier` and `weight` fields are excluded from the field tree response and cannot appear in rows, columns, or filters. The field-tree endpoint filters them out server-side. `weight` fields are returned via a separate `GET /api/v1/datasets/{id}/weight-fields` endpoint used to populate the Weighted measure picker.

### `multi_response` fields as branch nodes

`multi_response` fields render as expandable branch nodes in the UI — their `Level` rows become selectable children. This is a **frontend rendering convention only**; no schema change. The analytics engine already handles `multi_response` differently (array containment) and this is unchanged.

---

## Backend

### API endpoints

Two separate endpoints. Separation allows crosstab and trend request/response shapes to diverge as needed, and makes it straightforward to add further analysis types in future.

```
POST /api/v1/analytics/crosstab
POST /api/v1/analytics/trend
GET  /api/v1/datasets/{id}/field-tree
GET  /api/v1/datasets/{id}/weight-fields
```

#### `POST /api/v1/analytics/crosstab`

**Request:**

```json
{
  "dataset_id": 1,
  "rows": [
    { "field_key": "brand_rating" },
    { "field_key": "brand_awareness" }
  ],
  "row_mode": "stacked",
  "columns": [
    { "field_key": "gender" }
  ],
  "col_mode": "stacked",
  "filters": [
    { "field_key": "age_group", "levels": ["18-34", "35-54"] },
    { "field_key": "nps_score", "range": [3, 8] }
  ],
  "measure": {
    "type": "count",
    "field_key": null,
    "aggregation": null,
    "display": "pct_col"
  }
}
```

| Field        | Values                              | Notes                                                    |
| ------------ | ----------------------------------- | -------------------------------------------------------- |
| `row_mode`   | `stacked` \| `nested`               | How multiple row fields are combined                     |
| `col_mode`   | `stacked` \| `nested`               | How multiple column fields are combined                  |
| `measure.type` | `count` \| `weighted` \| `value_field` |                                                    |
| `measure.field_key` | str \| null                  | Weight field (weighted) or numeric field (value_field)   |
| `measure.aggregation` | `sum` \| `mean` \| null    | Required when `type` = `value_field`                     |
| `display`    | `pct_col` \| `pct_row` \| `n`       | Presentation format for count/weighted measures          |

**Limits (enforced at service layer):**
- `rows`: max 2 fields if `row_mode = "nested"`, max 5 if `row_mode = "stacked"`
- `columns`: same limits apply
- `filters`: no hard limit, but each filter field must have `is_filterable = true`

**Filter logic:** OR within a field's levels, AND between fields.
Range filters (`range: [min, max]`) apply to `numeric` field types only.

#### `POST /api/v1/analytics/trend`

**Request:**

```json
{
  "collection_id": 1,
  "fields": [
    { "field_key": "brand_awareness" },
    { "field_key": "brand_rating" }
  ],
  "breakdown": { "field_key": "gender" },
  "filters": [...],
  "measure": { "type": "count", "field_key": null, "aggregation": null },
  "display": "pct_col"
}
```

Trending spans all datasets in the collection (ordered by `Dataset.sort_order`). Multiple fields are always stacked in trending mode — each field gets its own chart section.

#### `GET /api/v1/datasets/{id}/field-tree`

Returns the full `FieldGroup` tree with fields as leaves, built via recursive CTE. `multi_response` fields include their `Level` rows in the response so the frontend can render them as expandable branch nodes.

```json
{
  "groups": [
    {
      "id": 1, "name": "Brand Perception", "slug": "brand-perception",
      "sort_order": 0, "parent_id": null,
      "children": [],
      "fields": [
        { "id": 1, "field_key": "brand_rating", "display_name": "Brand Rating",
          "field_type": "ordinal", "is_filterable": true,
          "levels": [{"value": "Very Poor", "display_label": "Very Poor", "sort_order": 0}, ...] }
      ]
    }
  ],
  "ungrouped_fields": [...]
}
```

### Response shape (both endpoints)

```json
{
  "meta": {
    "mode": "crosstab",
    "row_fields": [
      { "field_key": "brand_rating", "display_name": "Brand Rating" }
    ],
    "col_fields": [
      { "field_key": "gender", "display_name": "Gender" }
    ],
    "row_mode": "stacked",
    "col_mode": "stacked",
    "measure": { "type": "count", "display": "pct_col" },
    "dataset_name": "Wave 1",
    "base_n": 62
  },
  "rows": [
    {
      "key": ["brand_rating", "Very Poor"],
      "values": {
        "Female": 4.0,
        "Male": 8.0,
        "Non-binary": 12.0,
        "Prefer not to say": 0.0,
        "Total": 7.0
      }
    }
  ]
}
```

The `key` array is a `[field_key, level_value]` pair. For nested mode, a row's key is `[outer_field_key, outer_level, inner_field_key, inner_level]`. For trending, `key` is `[dataset_name, field_key, level_value]`. The frontend constructs tables and all chart types from this same structure — `chartType` is a client-only concern.

### Service layer

**3-layer architecture** per `docs/patterns/backend.md`:

```
routes/analytics.py
  → services/crosstab_service.py   (CrosstabService)
  → services/trend_service.py      (TrendService)
  → repositories/analytics_repo.py (shared: field/level lookups, filter resolution)
```

Both services call `WorkerFactory.for_dataset(dataset)` to obtain a `DataWorker`, then aggregate in Python. SQL push-down is not in scope for sub-project 3 — data volumes from seed data are too small to warrant it.

**Filter resolution:**
- Categorical/ordinal: `DataWorker.fetch()` `filters` dict, exact match per level
- Numeric range: post-fetch filtering in the service layer (range check on each row)
- Selected levels on `multi_response` fields: post-fetch, array intersection check

**Weighted measure:** sum of `weight_field` values per group instead of count.
**Value field measure:** sum or mean of `value_field` per group, from `DataWorker.fetch()` output.

---

## Frontend

### Route and feature flag

Page at `/analytics`, gated by PostHog feature flag `analytics-engine`:

```typescript
// app/analytics/page.tsx
const showAnalytics = useFeatureFlag('analytics-engine')
if (!showAnalytics) notFound()
```

### Layout — 3-column

```
┌─────────────────┬───────────────────┬──────────────────────────┐
│  Field Tree     │  Query Builder    │  Results                 │
│  (resizable)    │  (resizable)      │  (fills remaining width) │
└─────────────────┴───────────────────┴──────────────────────────┘
```

- All three columns are resizable by dragging the divider handles
- Field tree and query builder panels are individually collapsible to a 28px icon strip (VS Code style) — icon + sideways label, click to re-expand
- Panel widths persisted to `localStorage`; "Restore default layout" link resets to defaults

### Field Tree panel

- Fetched from `GET /api/v1/datasets/{id}/field-tree` on dataset selection
- Recursive tree: `FieldGroup` nodes as branches, `Field` nodes as leaves
- `multi_response` fields render as expandable branch nodes — their levels appear as checkboxes beneath. They are selectable as row/column fields (showing distribution across options); the expandable levels allow selecting a subset of options to include in the analysis
- Search box filters on branch name, field display name, and level display label — matching nodes expand automatically, non-matching branches collapse
- Ungrouped fields appear in a flat list below the tree

### Query Builder panel

Top to bottom:

1. **Analysis type tabs** — Cross-tab | Trending
2. **Scope picker** — Dataset dropdown (cross-tab) or Collection dropdown (trending)
3. **Rows zone** — field pills, "+ Add field" opens field tree popover, stacked/nested mode selector appears when 2+ fields added, drag handles to reorder
4. **Columns zone** — same as Rows (cross-tab only; trending shows "Break down by" instead, single field)
5. **Filters zone** — "+ Add field" opens same field tree popover. Each added filter field appears as a group with level tags (toggle on/off). Numeric fields show a range slider + min/max inputs. Applied filter summary line at the bottom in natural language: *(gender is Female or Male) and (age_group is 18–34 or 35–54)*. AND between fields, OR within a field's levels.
6. **Measure section** — segmented control: Count | Weighted | Value field. Conditional detail below: display format (Count), weight field picker (Weighted), numeric field picker + Sum/Mean selector (Value field). Info note narrates the result.
7. **Run button**

**Stacked/nested mode selector** (appears when ≥ 2 fields in Rows or Columns):
A compact toggle beneath the zone: `Stacked ↕` | `Nested →`. Nested mode shows a drag-handle on each pill to set outer/inner order.

### Results panel

**Header:**
```
[result title + subtitle]    [chart type icons] | [view icons]
```

- **Chart type icons** (4): grouped bar · stacked bar · 100% stacked bar · line. Line is greyed out and disabled in cross-tab mode. Additional numeric chart types (histogram, box plot, scatter, heatmap) will be added here in future sub-projects.
- **View icons** (4): chart only · table only · stacked (chart above, table below) · side by side

**Table:**
- Single field: field name as column header spanning its levels; level names as rows; Total column; base n row in italics
- Stacked rows: bold section header row per field, thick top border between sections, own base n per section
- Nested rows: separate row-header column per field, outer level spans rows (`rowspan`), subtotal row closes each outer group
- Column multi-field follows the same stacked/nested logic applied to column headers

**Chart:**
- Chart component accepts `chartType`, `data` (the API response rows), and `meta` props
- New chart types are added by extending the `chartType` union — no changes to query or results layer needed
- **Grouped bar**: row field levels on x-axis, column field levels as series. Stacked rows = separate chart sections. Nested rows = outer level pill selector, x-axis becomes column field, bars are inner field levels
- **Stacked bar**: same grouping as grouped bar, segments stacked
- **100% stacked bar**: normalised to 100%, best for composition comparison
- **Line** (trending only): x-axis = dataset names (ordered by `sort_order`), one line per "field level × breakdown level" combination. Legend format: `"breakdown_level — field_level"`. Data point labels at each dataset. Dashed lines to distinguish overlapping series.
- Chart title = `"field × breakdown"`, subtitle = measure + dataset + n

### State management

- **Query config** — URL `searchParams` (shareable links, bookmarkable)
- **Panel widths** — `localStorage`
- **UI-only state** (open/closed tree branches, active chart type, active view mode) — `useState`

---

## Seed Data

No new seed data required. Sub-project 3 queries the existing seed collections:

- **Brand Tracker** (2 waves) — cross-tab and trending, multi-response, ordinal, categorical
- **Customer Satisfaction** (1 wave) — numeric field (nps_score), ordinal, multi-response
- **Market Report** (2 periods) — numeric-heavy, collection_type override

`FieldGroup` seed data will be added as part of the implementation (grouping existing fields into logical branches) to populate the field tree.

---

## API Surface Summary

| Method | Path                                    | Purpose                              |
| ------ | --------------------------------------- | ------------------------------------ |
| `POST` | `/api/v1/analytics/crosstab`            | Run a cross-tab analysis             |
| `POST` | `/api/v1/analytics/trend`              | Run a trending analysis              |
| `GET`  | `/api/v1/datasets/{id}/field-tree`     | Field tree for a dataset             |
| `GET`  | `/api/v1/datasets/{id}/weight-fields`  | Available weight fields for a dataset |

---

## Out of Scope (Sub-project 3)

- Numeric chart types: histogram, box plot, scatter plot, heatmap — deferred to later sub-projects. Architecture accommodates them via the extensible `chartType` prop and the existing `value_field` measure shape.
- Weighted quantiles and histogram binning for large datasets
- Export (CSV, image)
- Saved queries
- Write endpoints (data ingestion is sub-project 4)
- `ExternalTableWorker` (not yet implemented)
