# Drag & Drop — Design Spec

**Date:** 2026-04-16  
**Sub-project:** 5 — Drag & Drop  
**Status:** Ready for implementation

---

## Overview

Add drag-and-drop as the primary way to assign fields to query zones, while preserving the existing click/button interactions as keyboard-accessible fallbacks. Fields are dragged from the field tree into the Rows, Columns, or Breakdown zones. Chips within a zone can be reordered by dragging. Dragging a chip outside any zone removes it.

---

## Library

**dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`).

- Handles cross-container drag (field tree → zone) and within-zone sorting via `SortableContext`
- Keyboard accessible by default
- Mouse-only for this sub-project (touch support deferred)

---

## Architecture

`DndContext` wraps `AnalyticsPage`, which already owns `query` state. All DnD mutations call the existing `onQueryChange` path — drag is another way to edit the same state, not a parallel state system.

### Drag sources

Each field row in `FieldTreePanel` becomes draggable via `useDraggable`. Drag data carries:

```ts
{ type: "field", field_key, display_name, field_type }
```

### Drop targets

| Zone | Hook | Notes |
|---|---|---|
| Rows | `useDroppable` + `SortableContext` | Chips are `useSortable` |
| Columns | `useDroppable` + `SortableContext` | Crosstab mode only |
| Breakdown | `useDroppable` | Single field, no sorting |

### Event handlers (on `DndContext`)

- `onDragStart` — record which zone the dragged item came from (if it's a chip being reordered/moved); activate drop zone glow on all valid targets
- `onDragOver` — track the current `over` zone to drive the active border highlight; insert ghost chip preview
- `onDragEnd` — commit the mutation:
  - `over === null` → remove chip from its source zone
  - `over` is a zone id → add field to that zone (if from field tree) or move chip there (if from another zone)
  - `over` is a chip id → reorder within zone using `arrayMove`

### DragOverlay

A floating `FieldChip` renders during drag, matching the real chip style exactly (type-circle, display name, no remove button).

### File changes — no new directories

- `AnalyticsPage` — wrap in `DndContext`; add `onDragStart`/`onDragOver`/`onDragEnd` handlers
- `FieldTreePanel` — field rows use `useDraggable`; zone toggle buttons replace +R/+C
- `QueryBuilderPanel` — zones use `useDroppable` + `SortableContext`; chips use `useSortable`

---

## Field Tree — Zone Toggle Buttons

Replace the existing hover-only `+R` / `+C` buttons with persistent zone toggle buttons in fixed columns. This gives the buttons dual purpose: assignment status indicator and keyboard-accessible add/remove control.

### Layout

Each field row uses a CSS grid: `1fr 22px 22px 22px` (field name | R | C | B).

The columns are always present and vertically aligned across all rows, so R badges scan cleanly down the list.

### Button states

- **Assigned (filled):** Coloured background + coloured label. Always visible regardless of hover.
  - R → indigo
  - C → amber  
  - B → emerald
- **Available (outline):** Subtle border + muted label. Only visible on row hover.
- **Hidden column:** B column is hidden in crosstab mode (no breakdown zone exists).

### Click behaviour on field rows

- **Click field name (unassigned field):** Adds to Rows (same as today)
- **Click field name (assigned field):** Removes from all zones simultaneously
- **Click a zone button (R / C / B):** Toggles assignment for that specific zone only — add if not assigned, remove if already assigned

---

## Drop Zone Visual States

Three states across the drag lifecycle:

### 1. Idle (no drag)

Normal zone appearance: `border: 1px solid var(--border)`, standard background.

### 2. Drag active — field in flight, not over any zone

All valid drop targets show:
- `background: rgba(primary, 0.07)` — faint fill
- `box-shadow: 0 0 0 4px rgba(primary, 0.14), 0 0 12px rgba(primary, 0.18)` — outer glow
- Border unchanged

### 3. Drag active — hovering a specific zone

The hovered zone additionally gets:
- `border: 2px solid primary` — solid accent border

Non-hovered valid targets remain in state 2 (glow only).

### Ghost chip

When hovering a zone, a semi-transparent ghost chip (dashed border, 65% opacity) appears inside the zone showing where the field will land.

---

## Chip Reorder Within a Zone

`SortableContext` with `horizontalListSortingStrategy` (chips are horizontal flex-wrap). While dragging a chip:

- Other chips animate to show the insertion point
- Dropping inside the zone commits the new order via `arrayMove`
- Dropping outside the zone (over === null) removes the chip

---

## Breakdown Zone Special Cases

- Holds at most one field — `useDroppable` only, no `SortableContext`
- Dropping a field onto an occupied Breakdown zone **replaces** the existing field
- Only visible in trend mode (unchanged from current behaviour)
- Dragging the breakdown chip out removes it (same `over === null` rule)

---

## Keyboard Fallback

The R / C / B zone toggle buttons are always present and focusable — no drag required. This preserves full keyboard accessibility. The `+R` / `+C` buttons are removed and replaced entirely by the new toggle buttons.

---

## Testing

- Unit tests (vitest): toggle button click adds/removes fields; click on field name adds to rows; clicking assigned field removes from all zones
- DnD interaction tests: use `@dnd-kit/testing` or simulate `onDragEnd` calls directly on the handler — do not attempt to simulate browser drag events
- Storybook stories: `FieldTreePanel` with assigned fields showing zone tags; `Zone` with drag-over highlight state; `QueryBuilderPanel` with populated zones
- All new stories must pass a11y checks
