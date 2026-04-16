# Data Ingestion & Metadata Editor Design

**Date:** 2026-04-16  
**Sub-project:** 6 — Data Ingestion & Metadata Editor  
**Status:** Approved

---

## Overview

A guided upload wizard for importing survey datasets (CSV first, SPSS as stretch goal) into the platform. Users navigate a 5-step flow: File & Hierarchy → Field Detection → Reconciliation → Metadata Editor → Review & Commit. A dedicated `/datasets` management page lists all datasets with per-dataset actions.

---

## 1. Datasets Page (`/datasets`)

A standalone management page — not embedded in the analytics view.

**Layout:**
- Page header: "Datasets" title + "Upload dataset" CTA button (opens wizard)
- Filter bar: package selector, collection selector, search by name
- Dataset table: columns — Name, Collection, Package, Responses, Fields, Uploaded, Status, Actions
- Per-row actions: View metadata, Download, Delete
- Empty state: illustration + "Upload your first dataset" CTA

**Status values:** `draft` (wizard in progress), `committed` (live in analytics engine)

Only `committed` datasets are available in the analytics engine. Draft datasets can be resumed or discarded.

---

## 2. Five-Step Upload Wizard

A modal or full-page wizard with a persistent step indicator at the top showing progress through all five steps. Each step can navigate back; "Next" is disabled until the current step's required actions are complete.

---

### Step 1: File & Hierarchy

**File upload panel:**
- Drag-and-drop zone + "Browse files" button
- Accepted: `.csv` (SPSS `.sav` as stretch goal, parsed server-side via `pyreadstat`)
- On upload: server parses headers and infers column count; shows file name, size, row count preview

**Hierarchy assignment:**
- Package selector (existing or "+ New package")
- Collection selector, filtered by selected package (existing or "+ New collection")
- Dataset name field (pre-filled from filename, editable)
- Collection date picker (month/year)
- All fields required before "Next" is enabled

**Logic:**
- Uploading into an existing collection triggers the reconciliation step (Step 3)
- Uploading into a new collection skips reconciliation (Step 3 is bypassed, progress bar reflects this)

---

### Step 2: Field Detection

**Purpose:** Review the auto-detected field metadata before proceeding.

**Display:** A table of all detected columns with:
- Column index
- `field_key` (raw CSV header, slugified)
- Detected type: `numeric`, `ordinal`, `categorical`, `multi_response`, `identifier`, `weight`
- Value sample (up to 5 distinct values)
- Detection confidence badge (high / review)
- Override type selector (inline dropdown, enabled on row hover)

**Detection rules (server-side heuristics):**
- `identifier`: column named `id`, `respondent_id`, `resp_id`, or similar patterns
- `weight`: column named `weight`, `wgt`, `w`, or similar
- `multi_response`: column has a base field + sibling columns matching `{key}_1`, `{key}_2`, … pattern
- `_other` companion columns: detected from `{key}_other` naming; tagged as companion, not independently typed
- `ordinal`: numeric columns with ≤ 10 distinct integer values
- `categorical`: string columns with ≤ 50 distinct values
- `numeric`: remaining numeric columns

**Actions:**
- User can override any type detection inline
- "Reset to detected" per row
- "Next" enabled once no rows are in error state (e.g., unresolvable ambiguity)

---

### Step 3: Reconciliation (only when uploading into an existing collection)

**Purpose:** Map fields in the new file to fields in the reference dataset (most recent wave in the collection).

**Reference dataset:** auto-selected as the most recent committed dataset in the collection. User can change via a dropdown.

**Four reconciliation groups (tabs):**

| Tab | Meaning | Blocking? |
|-----|---------|-----------|
| **Exact** | Same `field_key` + matching levels — auto-accepted | No |
| **Probable** | Similar key or levels — needs user decision | Yes |
| **New only** | In new file, not in reference — passes through automatically | No |
| **Old only** | In reference, not in new file — user must explicitly exclude or mark absent | Yes |

Tab headers show count badges. "Next" is disabled while any Probable rows are unresolved or any Old-only row lacks a decision.

**Row layout (8-column CSS grid, consistent across all tabs):**

```
[ ☐ ] [ ● ] [ field_key ] [ match_target ] [ note ] [ type ] [ status ] [ actions ]
```

- `☐` — checkbox for bulk selection
- `●` — status dot (colour-coded by group)
- `field_key` — monospace, the new file's key (or reference key for Old-only)
- `match_target` — matched reference field key (blank for New-only, Old-only)
- `note` — short auto-generated explanation (e.g., "key renamed", "2 levels added")
- `type` — field type chip
- `status` — resolution chip: Exact / Confirmed / New / Excluded / Pending
- `actions` — context buttons; vary by group

**Probable tab actions per row:**
- "Confirm mapping" — accepts the suggested match
- "Reject" — demotes to New-only
- "Map to…" — opens a searchable picker for manual mapping

**Old-only tab actions per row:**
- "Mark as excluded" — field deliberately absent from this wave (recorded, non-blocking warning)
- "Map to new field" — links it to a New-only field from Step 2

**Bulk actions (when rows selected):** Confirm all, Reject all (Probable tab); Exclude all (Old-only tab).

**Pagination & virtual list:**
- Default: paginated view, controls at top (page size: 25, 50, 100)
- "Show all" toggle: switches to virtual list mode (`@tanstack/react-virtual`, ~20 DOM rows rendered)
- Infinite scroll via `IntersectionObserver` on bottom sentinel; cursor-based API pagination
- Select-all stores selected IDs in React state (not DOM); bulk actions POST the ID list to the API

---

### Step 4: Metadata Editor

**Purpose:** Edit display names, group assignments, level labels, and sort order for all fields.

**Layout:** Two-panel split

- **Left panel (240px fixed):** Field navigator — tree or list view, toggled via tabs at the top of the panel only. The right panel always remains visible; the toggle only affects the left panel.
- **Right panel (flex):** Field editor — always visible; shows the selected field's editable properties.

#### Left Panel — Tree View

- Each node: drag handle (⠿), expand chevron, folder/field icon, label, node actions (+, ⋮)
- Group nodes: can be expanded/collapsed; drop zones activate on drag-over (highlight border + "Drop here" label)
- Field nodes: leaf items; drag to reorder within group or move between groups
- **Unassigned section** at bottom: fields not yet assigned to any group
- Context menu (⋮) per node: Add subgroup, Rename, Move to…, Delete
- Move to… opens a searchable flat dropdown showing full group paths (e.g., "Brand Tracker › Media & Comms")
- Keyboard shortcuts shown in context menu (accessible alternative to drag & drop)
- "+ New group" button at top of panel; inline rename on new node creation

Unlimited nesting depth supported via `fieldgroup.parent_id` (existing data model).

#### Left Panel — List View (tab toggle replaces tree content only)

- Rows: status dot | monospace `field_key` | abbreviated group breadcrumb path | ⋮ menu
- Filter pills at top: All / ⚠ Needs review / ✓ Ready
- Sort dropdown: by key (A–Z), by group, by type
- ⋮ menu per row: Edit (selects in right panel), Move to…, Remove from group

#### Right Panel — Field Editor

- **Breadcrumb header:** group path + field name (e.g., "Brand Tracker › Awareness › brand_awareness")
- **Status chip:** Needs review / Ready
- **Display name input:** free text (pre-filled with slugified key)
- **Field type selector:** dropdown (numeric / ordinal / categorical / multi_response / identifier / weight)
- **Group assignment:**
  - Label + current group shown
  - "Move to" flat dropdown (searchable, shows full paths)
  - "+ New group" button (creates a new top-level group and moves field into it)
- **Sort order input:** integer, controls display order within the group
- **Levels editor** (visible for ordinal and categorical types):
  - Each level row: drag handle | raw value (monospace, read-only) | display label input | new/inherited badge | delete button
  - "Add level" button at bottom
  - New levels (not in reference) get a "new" badge; inherited levels show "inherited"
- **Footer actions:** "🗑 Delete field" (danger, confirmation required) | Cancel | Save

---

### Step 5: Review & Commit

**Purpose:** Final summary before writing to the database.

**Warning box (non-blocking):** Shows any notices from reconciliation (e.g., explicitly excluded fields).

**2×2 Summary grid:**
1. **Dataset details** — Name, Collection, Package, Collected date, Source file, Response count. "← Edit" link returns to Step 1.
2. **Fields breakdown** — Total count + per-type counts with inline bar chart. "← Edit" link returns to Step 2.
3. **Reconciliation summary** — Reference dataset name + colored chips: ✓ exact matches, ✓ confirmed mappings, + new fields, — excluded. "← Edit" link returns to Step 3.
4. **Group structure** — List of groups with field counts + ungrouped identifiers/weights. "← Edit" link returns to Step 4.

**Commit panel:**
- Irreversibility warning: "This action cannot be undone — responses and fields will be written to the database."
- "Commit dataset →" CTA button (accent color, full weight)
- On commit: server atomically promotes staging records to committed tables in a single transaction: `upload_fieldgroup` → `fieldgroup`, `upload_field` → `field`, `upload_level` → `fieldlevel`, CSV rows → `response` (JSONB payload), reconciliation mappings → `field.reconciliation_source_id` (or equivalent). `upload_session.status` set to `committed` and `dataset_id` set.

**Footer:** "← Back to Metadata" ghost button.

---

## 3. Backend API Design

All routes prefixed `/api/v1/`.

### Upload & Parsing

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/datasets/upload` | Upload file; returns `upload_id` + detected fields |
| GET | `/datasets/upload/{upload_id}/preview` | Re-fetch detection results (resume wizard) |
| PATCH | `/datasets/upload/{upload_id}/fields` | Save user overrides to field types |

### Reconciliation

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/datasets/upload/{upload_id}/reconcile` | Trigger reconciliation against a reference dataset |
| GET | `/datasets/upload/{upload_id}/reconcile` | Paginated fetch of reconciliation rows (cursor-based) |
| GET | `/datasets/upload/{upload_id}/reconcile/ids` | Fetch all row IDs matching a filter (for select-all bulk ops) |
| PATCH | `/datasets/upload/{upload_id}/reconcile/{row_id}` | Resolve a single reconciliation row |
| POST | `/datasets/upload/{upload_id}/reconcile/bulk` | Bulk resolve (body: `{ids, action}`) |

### Metadata

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/datasets/upload/{upload_id}/fields` | Fetch all fields with group + level data |
| PATCH | `/datasets/upload/{upload_id}/fields/{field_id}` | Update field metadata |
| POST | `/datasets/upload/{upload_id}/fieldgroups` | Create a new staging field group |
| PATCH | `/datasets/upload/{upload_id}/fieldgroups/{group_id}` | Rename or re-parent a staging group |
| DELETE | `/datasets/upload/{upload_id}/fieldgroups/{group_id}` | Delete staging group (fields moved to Unassigned) |
| PATCH | `/datasets/upload/{upload_id}/fields/{field_id}/move` | Move field to a different staging group |
| PATCH | `/datasets/upload/{upload_id}/fieldgroups/{group_id}/move` | Re-parent a staging group |

### Commit

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/datasets/upload/{upload_id}/commit` | Atomically write dataset to DB; returns `dataset_id` |

### Dataset Management

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/datasets` | List committed datasets (filterable by package, collection) |
| GET | `/datasets/{dataset_id}` | Single dataset detail |
| DELETE | `/datasets/{dataset_id}` | Delete dataset and all associated data |

### 3-Layer Implementation

Each route follows `routes/ → services/ → repositories/`:

- **Routes:** validate request, call service, return response schema
- **Services:** business logic (reconciliation rules engine, detection heuristics, commit transaction)
- **Repositories:** raw DB queries via async SQLAlchemy

---

## 4. Data Model Additions

New tables / columns needed:

```
upload_session
  id uuid PK
  status enum(pending, detecting, reconciling, editing, committed, abandoned)
  file_path text            -- temp storage path
  dataset_id uuid FK nullable  -- set after commit
  collection_id uuid FK nullable
  reference_dataset_id uuid FK nullable
  created_at, updated_at

upload_field
  id uuid PK
  upload_session_id uuid FK
  field_key text
  detected_type field_type_enum
  override_type field_type_enum nullable
  sort_order int
  display_name text nullable
  upload_fieldgroup_id uuid FK nullable  -- references upload_fieldgroup (staging)

upload_level
  id uuid PK
  upload_field_id uuid FK
  raw_value text
  display_label text nullable
  sort_order int

upload_fieldgroup   -- staging groups; written to fieldgroup on commit
  id uuid PK
  upload_session_id uuid FK
  name text
  parent_id uuid FK nullable  -- self-referential (upload_fieldgroup.id)
  sort_order int

reconciliation_row
  id uuid PK
  upload_session_id uuid FK
  new_field_id uuid FK nullable   -- upload_field
  ref_field_id uuid FK nullable   -- existing field
  group enum(exact, probable, new_only, old_only)
  status enum(pending, confirmed, rejected, excluded, auto_accepted)
  confidence float nullable
  note text nullable
```

Existing tables used: `package`, `collection`, `dataset`, `field`, `fieldlevel`, `fieldgroup`, `response`.

---

## 5. Reconciliation Rules Engine

The rules engine runs server-side when the user clicks "Next" on Step 1 (after collection selection).

**Matching algorithm:**
1. **Exact match:** `field_key` identical + all level `raw_value`s match → group `exact`, auto-accepted
2. **Probable match:** Levenshtein distance on `field_key` ≤ 2, or ≥ 70% level overlap → group `probable`, confidence score stored
3. **New only:** No match found for a new file field → group `new_only`, auto-passes through
4. **Old only:** Reference field has no match in new file → group `old_only`, requires user action

**Blocking rules:**
- `probable` rows with status `pending` block "Next"
- `old_only` rows with status `pending` block "Next"
- `exact` and `new_only` rows never block

---

## 6. Frontend Architecture

**Pages:**
- `app/(main)/datasets/page.tsx` — datasets list page
- `app/(main)/datasets/upload/page.tsx` — wizard shell
- `app/(main)/datasets/upload/steps/` — one component per step

**State management:** TanStack Query for server state; React context for wizard-local state (current step, upload_id, user overrides). No global store needed.

**Virtual list (Step 3 & potentially Step 4 list view):**
- `@tanstack/react-virtual` for row virtualisation (already available or easy add)
- `IntersectionObserver` on a bottom sentinel div triggers the next page fetch
- Cursor-based pagination: API returns `next_cursor`; stored in `useInfiniteQuery`

**Drag and drop (Step 4 tree):**
- `@dnd-kit/core` + `@dnd-kit/sortable` (already in project at v6.3.1)
- All drag actions have accessible keyboard equivalents: ⋮ context menu with Move to…, Add subgroup, Rename, Delete

**New dependencies:**
- Frontend: `@tanstack/react-virtual` (check current stable version before installing; not yet in project)
- Backend (SPSS only): `pyreadstat` (Python; add only when implementing SPSS path)

---

## 7. SPSS Stretch Goal

SPSS (`.sav`) files are parsed server-side using `pyreadstat`. The detection step is simplified because SPSS files carry embedded metadata (variable labels, value labels, missing value codes).

**Changes vs CSV path:**
- Field type detection uses SPSS variable type + measurement level (nominal, ordinal, scale) rather than heuristics
- Level display labels are pre-populated from SPSS value labels
- Display names are pre-populated from SPSS variable labels
- The detection confidence is always "high" for SPSS (no heuristic needed)

Everything downstream (reconciliation, metadata editor, commit) is identical to the CSV flow.

**Activation:** SPSS support is gated behind file extension acceptance and `pyreadstat` being installed as a dependency. The upload endpoint checks the MIME type / extension and routes to the appropriate parser.

---

## 8. Accessibility & Non-Drag Alternatives

Every drag action in the metadata editor tree has a non-drag equivalent:
- **Move field to group:** "Move to…" dropdown in right panel editor OR "Move to…" in ⋮ context menu
- **Reorder within group:** "Sort order" integer input in right panel
- **Move group to new parent:** "Move to…" in group ⋮ context menu
- **Reorder groups:** sort order on the group node (accessible via ⋮ → Edit)
- **Create subgroup:** "+ Add subgroup" in ⋮ menu OR "+ New group" button
- All interactive elements meet WCAG 2.1 AA: keyboard focusable, labelled, sufficient colour contrast

---

## 9. Wizard Navigation & State Persistence

- Wizard state is stored server-side in `upload_session`; a session `id` is kept in URL params (`?session=uuid`)
- Refreshing or closing the browser preserves draft state; user can resume from `/datasets` list (draft badge)
- "Back" navigates to previous step without data loss
- Abandoning (closing wizard without committing) leaves session in `abandoned` status; a background job cleans up temp files after 24h
- Only one in-progress upload session per user at a time (future: relax this constraint)

---

## Out of Scope

- Bulk dataset import / API-based ingestion (upload wizard only in this sub-project)
- Dataset versioning / edit after commit (fields and responses are immutable post-commit)
- Data export / download (download button on datasets page is a placeholder for now)
- Real-time collaboration on wizard steps
- SPSS full parsing edge cases (split files, system missing values beyond basic handling)
