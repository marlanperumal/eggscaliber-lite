# UX Polish — Iteration 2: Query Builder Controls

**Date:** 2026-04-14
**Status:** Approved

## Overview

Iteration 2 brings the `QueryBuilderPanel` from functional prototype to polished, production-grade UI. Raw `<button>` and `<select>` elements are replaced with styled shadcn components and a cohesive visual language that matches the design system established in iterations 0 and 1.

## Prototyping Workflow

**Hybrid approach** — HTML display-server mockups for high-level layout decisions, then implementation goes directly into Storybook. No throwaway code after the design phase.

- HTML mockups are used only for structural/visual direction questions (done during this brainstorm session)
- Once structure is decided, components are implemented directly in Storybook with stateful stories
- The `frontend-design` skill runs during the Storybook implementation phase

## Visual Design

### Mode Selector

Replaced the two raw toggle buttons with **mini-cards**: two side-by-side cards, each with a large icon and a one-line description beneath the mode name.

| Mode | Icon | Description |
|---|---|---|
| Cross-tab | ⊞ | Compare groups |
| Trending | 📈 | Track over time |

Active card uses brand-crimson border and tinted background. Self-documenting for first-time users.

### Dataset Picker

A **breadcrumb display** showing the full hierarchy: `Package › Collection › Dataset`. Read-only when selected; opens a dropdown on click. Chosen over a searchable combobox because users browse by package/collection rather than searching by name.

### Zone Areas (Rows / Columns / Fields)

- **Empty state:** dashed border, muted background, instructional text centred inside
- **Populated state:** solid border, white background, field chips stacked inside
- **Stacked/Nested toggle:** appears as a bar inside the zone, above the chips, only when the zone contains 2+ fields. Uses a pill toggle (Stacked ↕ / Nested →).

### Field Chips

Brand-crimson pill with an 18px coloured circle on the left containing a type icon:

| Field type | Circle colour | Icon |
|---|---|---|
| Single-response | Indigo (`#6366f1`) | ◯ |
| Multi-response | Sky (`#0ea5e9`) | ⊕ |
| Ordinal | Amber (`#f59e0b`) | ≡ |
| Numeric | Emerald (`#10b981`) | # |

These four type colours are shared with the field tree panel (used in iteration 3+). Chips themselves stay crimson; only the type indicator circle uses secondary colours.

### Measure Control

The two separate toggle rows (type + display) are replaced with a **type × display matrix**:

|  | Count | Weighted | Value |
|---|---|---|---|
| **N** | cell | cell | cell |
| **% Col** | cell | cell | cell |
| **% Row** | cell | cell | cell |

One cell is active at a time. This makes the relationship between measure type and display format explicit — the user picks both in a single interaction.

### Run Button

Full-width, brand crimson, pinned to the panel footer. Label: `▶ Run Query`.

## Storybook Story Structure

### Component stories — `QueryBuilderPanel.stories.tsx`

| Story | Purpose |
|---|---|
| `Empty` | No dataset selected, no fields — shows empty zone states and mode cards |
| `CrosstabWithFields` | Dataset selected, 2 fields in Rows, 1 in Columns, measure cell active |
| `TrendMode` | Trending mode, Fields zone populated, breakdown set |
| `StackedNestedToggle` | 2+ fields in a zone, inner toggle bar visible |
| `Loading` | Run button in loading state |
| `Error` | Error message rendered above run button |

### Page-level story — `AnalyticsPage.stories.tsx`

Composes `FieldTreePanel` + `QueryBuilderPanel` + `ResultsPanel` in a full-height layout decorator with mocked API data. Provides a clickable end-to-end prototype in Storybook — select dataset, add fields, run, see results.

## Implementation Sequence

1. **HTML mockups** — done during this brainstorm session
2. **Refactor `QueryBuilderPanel`** — replace raw elements with shadcn components per the visual design above
3. **`QueryBuilderPanel.stories.tsx`** — all 6 stories; run `frontend-design` skill during this phase
4. **`AnalyticsPage.stories.tsx`** — page-level composed story with mocked data
5. **A11y pass** — run Storybook a11y addon across all new stories, fix violations

## Out of Scope

- `FieldTreePanel` type-circle indicators — deferred to iteration 3
- Searchable combobox for dataset picker — not needed given current dataset volume
- Drag-and-drop for field zones — not in scope for this iteration
