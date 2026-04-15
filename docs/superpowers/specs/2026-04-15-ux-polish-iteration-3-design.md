# UX Polish — Iteration 3: Empty & Loading States

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Analytics page — FieldTreePanel, QueryBuilderPanel zones, ResultsPanel

---

## Overview

Iteration 3 replaces the bare placeholder text currently used for empty and loading states across the three analytics panels with illustrated empty states and skeleton+spinner loading states. The goal is to make the analytics engine feel polished and communicative at every stage of the user workflow.

---

## 1. Shared `EmptyState` Component

**File:** `apps/web/src/app/analytics/EmptyState.tsx`

A simple presentational component used by all three panels:

```tsx
interface EmptyStateProps {
  illustration: React.ReactNode  // SVG React component
  title: string
  body: string
}
```

Renders centred vertically and horizontally within its container: illustration on top, title below (`text-sm font-medium text-foreground`), body below that (`text-xs text-muted-foreground`, max-width ~160px). No external dependencies beyond standard token classes.

Accompanied by a Storybook story (`EmptyState.stories.tsx`) showing all three illustrations side-by-side for design-system reference.

---

## 2. Illustration Files

**Directory:** `apps/web/src/app/analytics/illustrations/`

Three `.tsx` files, each exporting a single SVG React component (~52×40px viewBox). Passed as `illustration` prop to `EmptyState`. No SVGR config required — plain React components returning `<svg>`.

| File | Used by | Visual |
|------|---------|--------|
| `FieldTreeIllustration.tsx` | FieldTreePanel | Skeleton tree rows with a question-mark circle |
| `QueryZoneIllustration.tsx` | Zone (QueryBuilderPanel) | Directional arrows (↕ / ↔) |
| `ResultsIllustration.tsx` | ResultsPanel | Chart bar sketch |

---

## 3. Empty States

### FieldTreePanel

Two states, both using `FieldTreeIllustration`:

| Condition | Title | Body |
|-----------|-------|------|
| `effectiveDatasetId` is null | "No dataset selected" | "Choose a dataset in the Query Builder to browse fields" |
| Tree loaded but empty (no groups, no ungrouped fields) | "No fields" | "This dataset has no browsable fields" |

Replaces the current `<p className="... text-muted-foreground">Select a dataset to see fields.</p>`.

### QueryBuilderPanel — Zone component

Each `Zone` (Rows, Columns) shows `QueryZoneIllustration` + "Drop fields here" when empty. Replaces the current plain-text `"Click fields to add here"`. The illustration and text sit inside the existing dashed zone box.

### ResultsPanel

| Condition | Title | Body |
|-----------|-------|------|
| `result` is null and `isLoading` is false | "No results yet" | "Configure a query and press Run" |

Replaces the current `<p>Configure a query and press Run.</p>`.

---

## 4. Loading States

### FieldTreePanel

New `treeLoading` boolean state: `true` when `effectiveDatasetId` is set and `tree` is still null (fetch in flight). Reset to `false` once tree data arrives.

**Visual:**
- Small spinner (border-based CSS, `animate-spin`) in the panel header, right-aligned next to "Fields"
- Skeleton rows in the panel body: ~6 `Skeleton` bars at alternating widths, with indentation to suggest a group/children tree structure

### ResultsPanel

**State threading:** The `loading` boolean is lifted out of `QueryBuilderPanel` into `AnalyticsLayout`. `AnalyticsLayout` passes it to both `QueryBuilderPanel` (as a controlled prop + setter) and `ResultsPanel` (as `isLoading`).

**Visual when `isLoading` is true:**
- Small spinner in the results panel header in place of the dataset name (since `result` is null, there is no name to show)
- Skeleton chart: 6 bars of varying heights (`Skeleton` divs, `flex items-end`)
- 3 skeleton table rows below the chart

The existing shadcn `Skeleton` component (`animate-pulse rounded-md bg-muted`) is used throughout.

---

## 5. Storybook Stories

All stories must pass a11y checks.

### New files

| File | Stories |
|------|---------|
| `EmptyState.stories.tsx` | `AllIllustrations` — three panels side by side |
| `FieldTreePanel.stories.tsx` | `NoDataset`, `Loading`, `Populated` |
| `ResultsPanel.stories.tsx` | `Empty`, `Loading`, `WithResult` |

### Additions to existing files

| File | New story |
|------|-----------|
| `QueryBuilderPanel.stories.tsx` | `EmptyZones` — no rows/columns added |

---

## 6. Out of Scope

- Home page (Iteration 4)
- Error states (network failures, API errors) — the existing inline error text on the Run button is sufficient for now
- Filter zone empty state — filters are hidden when empty so no empty state is needed
