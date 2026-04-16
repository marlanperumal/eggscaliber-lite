# Drag & Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop from the field tree into query zones, chip reordering within zones, remove-by-drag-out, and zone toggle buttons as status indicators and keyboard fallback.

**Architecture:** `DndContext` wraps `AnalyticsLayout` (where query state lives). A `useDragAndDrop` hook extracts handler logic for testability. Field rows in `FieldTreePanel` use `useDraggable`; zone chips use `useSortable`; zones use `useDroppable`. Drop zone visual feedback is driven by `useDndMonitor` inside each `Zone` component.

**Tech Stack:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

---

## File Map

**New:**
- `apps/web/src/app/analytics/useDragAndDrop.ts` — handler logic (onDragStart/Over/End), drag state, pure functions for zone mutations — testable without rendering
- `apps/web/src/app/analytics/useDragAndDrop.test.ts` — unit tests for handler logic

**Modified:**
- `apps/web/src/app/analytics/AnalyticsLayout.tsx` — wrap in `DndContext`, use `useDragAndDrop`, add `DragOverlay`
- `apps/web/src/app/analytics/FieldTreePanel.tsx` — field rows use `useDraggable`; zone toggle buttons (R/C or R/B) replace +R/+C; click-field-name toggles zone membership
- `apps/web/src/app/analytics/FieldTreePanel.test.tsx` — update +R/+C tests to match new toggle button names; add toggle + click-to-remove tests
- `apps/web/src/app/analytics/QueryBuilderPanel.tsx` — `Zone` uses `useDroppable` + `useDndMonitor` + `SortableContext`; `FieldChip` wrapped in `useSortable`; breakdown zone uses `useDroppable` only
- `apps/web/src/app/analytics/QueryBuilderPanel.test.tsx` — no new tests needed (DnD behavior tested via handler; chip remove already tested)
- `apps/web/src/app/analytics/FieldTreePanel.stories.tsx` — add story with assigned fields showing toggle state
- `apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx` — add story showing populated zones

---

## Task 1: Install dnd-kit

**Files:**
- Modify: `apps/web/package.json` (via just command)

- [ ] **Step 1: Install packages**

```bash
just add-web-dep @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages appear in `apps/web/package.json` dependencies, lockfile updated.

- [ ] **Step 2: Verify import resolves**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors (no code uses them yet).

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): install @dnd-kit packages for drag-and-drop"
```

---

## Task 2: `useDragAndDrop` hook — pure logic (TDD)

**Files:**
- Create: `apps/web/src/app/analytics/useDragAndDrop.ts`
- Create: `apps/web/src/app/analytics/useDragAndDrop.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/app/analytics/useDragAndDrop.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_QUERY } from "./analytics-types"
import type { QueryConfig } from "./analytics-types"
import { applyDragEnd } from "./useDragAndDrop"

function makeQuery(overrides: Partial<QueryConfig> = {}): QueryConfig {
  return { ...DEFAULT_QUERY, ...overrides }
}

describe("applyDragEnd", () => {
  // ── From field tree ──────────────────────────────────────────────────────

  it("field drag into rows zone adds field to rows", () => {
    const q = makeQuery()
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-rows",
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].field_key).toBe("brand_awareness")
  })

  it("field drag into columns zone adds field to columns", () => {
    const q = makeQuery()
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "gender",
      displayName: "Gender",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-columns",
    })
    expect(result.columns).toHaveLength(1)
    expect(result.columns[0].field_key).toBe("gender")
  })

  it("field drag into breakdown zone sets breakdown", () => {
    const q = makeQuery()
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "age_group",
      displayName: "Age Group",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-breakdown",
    })
    expect(result.breakdown?.field_key).toBe("age_group")
  })

  it("field drag into breakdown zone replaces existing breakdown", () => {
    const q = makeQuery({ breakdown: { field_key: "gender", display_name: "Gender" } })
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "age_group",
      displayName: "Age Group",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-breakdown",
    })
    expect(result.breakdown?.field_key).toBe("age_group")
  })

  it("field drag does not duplicate if already in rows", () => {
    const q = makeQuery({ rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }] })
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-rows",
    })
    expect(result.rows).toHaveLength(1)
  })

  it("field drag with null overId does nothing", () => {
    const q = makeQuery()
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: null,
      overId: null,
    })
    expect(result).toEqual(q)
  })

  // ── Chip drag — remove ───────────────────────────────────────────────────

  it("chip drag outside any zone removes it from source zone only", () => {
    const q = makeQuery({
      rows: [
        { field_key: "brand_awareness", display_name: "Brand Awareness" },
        { field_key: "gender", display_name: "Gender" },
      ],
      columns: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    })
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: "rows",
      overId: null,
    })
    expect(result.rows.map(r => r.field_key)).toEqual(["gender"])
    expect(result.columns).toHaveLength(1) // unchanged
  })

  it("chip drag outside any zone removes breakdown chip", () => {
    const q = makeQuery({ breakdown: { field_key: "gender", display_name: "Gender" } })
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "gender",
      displayName: "Gender",
      fieldType: "categorical",
      sourceZone: "breakdown",
      overId: null,
    })
    expect(result.breakdown).toBeNull()
  })

  // ── Chip drag — move between zones ──────────────────────────────────────

  it("chip dragged from rows to columns zone moves it", () => {
    const q = makeQuery({
      rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    })
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: "rows",
      overId: "zone-columns",
    })
    expect(result.rows).toHaveLength(0)
    expect(result.columns[0].field_key).toBe("brand_awareness")
  })

  // ── Chip drag — reorder within zone ─────────────────────────────────────

  it("chip dragged onto another chip in same zone reorders", () => {
    const q = makeQuery({
      rows: [
        { field_key: "brand_awareness", display_name: "Brand Awareness" },
        { field_key: "gender", display_name: "Gender" },
        { field_key: "age_group", display_name: "Age Group" },
      ],
    })
    // Move brand_awareness (index 0) after age_group (index 2)
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: "rows",
      overId: "chip-rows-age_group",
    })
    expect(result.rows.map(r => r.field_key)).toEqual(["gender", "age_group", "brand_awareness"])
  })

  it("chip dropped on zone-rows id (not a chip) appends to end", () => {
    const q = makeQuery({
      rows: [
        { field_key: "brand_awareness", display_name: "Brand Awareness" },
        { field_key: "gender", display_name: "Gender" },
      ],
    })
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "gender",
      displayName: "Gender",
      fieldType: "categorical",
      sourceZone: "rows",
      overId: "zone-rows",
    })
    // No change expected — same zone, no specific chip target
    expect(result.rows.map(r => r.field_key)).toEqual(["brand_awareness", "gender"])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
just test-web -- --reporter=verbose apps/web/src/app/analytics/useDragAndDrop.test.ts
```

Expected: all tests fail with "Cannot find module './useDragAndDrop'"

- [ ] **Step 3: Implement `useDragAndDrop.ts`**

Create `apps/web/src/app/analytics/useDragAndDrop.ts`:

```ts
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback, useState } from "react"
import { DEFAULT_QUERY } from "./analytics-types"
import type { FieldSelection, QueryConfig } from "./analytics-types"

export type ZoneName = "rows" | "columns" | "breakdown"

export interface DragEventArgs {
  activeType: "field" | "chip"
  fieldKey: string
  displayName: string | undefined
  fieldType: string | undefined
  sourceZone: ZoneName | null
  overId: string | null
}

export interface ActiveDragState {
  activeType: "field" | "chip"
  fieldKey: string
  displayName: string | undefined
  fieldType: string | undefined
  sourceZone: ZoneName | null
  overZone: ZoneName | null
}

// ── Zone ID helpers ────────────────────────────────────────────────────────

const ZONE_DROP_IDS: Record<string, ZoneName> = {
  "zone-rows": "rows",
  "zone-columns": "columns",
  "zone-breakdown": "breakdown",
}

export function getZoneFromId(id: string): ZoneName | null {
  if (id in ZONE_DROP_IDS) return ZONE_DROP_IDS[id]
  if (id.startsWith("chip-rows-")) return "rows"
  if (id.startsWith("chip-columns-")) return "columns"
  if (id === "chip-breakdown") return "breakdown"
  return null
}

// ── Pure mutation function (exported for tests) ────────────────────────────

export function applyDragEnd(q: QueryConfig, args: DragEventArgs): QueryConfig {
  const { activeType, fieldKey, displayName, fieldType, sourceZone, overId } = args
  const field: FieldSelection = { field_key: fieldKey, display_name: displayName, field_type: fieldType }

  if (activeType === "field") {
    if (!overId) return q
    const targetZone = getZoneFromId(overId)
    if (!targetZone) return q
    return addToZone(q, field, targetZone)
  }

  // chip drag
  if (!overId) {
    return removeFromZone(q, fieldKey, sourceZone!)
  }

  const targetZone = getZoneFromId(overId)
  if (!targetZone) return q

  if (targetZone === sourceZone) {
    // Reorder within zone
    if (sourceZone === "breakdown") return q
    const items = sourceZone === "rows" ? q.rows : q.columns
    const oldIndex = items.findIndex(f => f.field_key === fieldKey)
    const overFieldKey = overId.startsWith("chip-") ? overId.replace(`chip-${sourceZone}-`, "") : null
    const newIndex = overFieldKey ? items.findIndex(f => f.field_key === overFieldKey) : -1
    if (oldIndex === -1 || newIndex === -1) return q
    const reordered = arrayMove(items, oldIndex, newIndex)
    return sourceZone === "rows" ? { ...q, rows: reordered } : { ...q, columns: reordered }
  }

  // Move to different zone
  const updated = removeFromZone(q, fieldKey, sourceZone!)
  return addToZone(updated, field, targetZone)
}

function addToZone(q: QueryConfig, field: FieldSelection, zone: ZoneName): QueryConfig {
  if (zone === "rows") {
    if (q.rows.some(r => r.field_key === field.field_key)) return q
    return { ...q, rows: [...q.rows, field] }
  }
  if (zone === "columns") {
    if (q.columns.some(c => c.field_key === field.field_key)) return q
    return { ...q, columns: [...q.columns, field] }
  }
  return { ...q, breakdown: field }
}

function removeFromZone(q: QueryConfig, fieldKey: string, zone: ZoneName): QueryConfig {
  if (zone === "rows") return { ...q, rows: q.rows.filter(r => r.field_key !== fieldKey) }
  if (zone === "columns") return { ...q, columns: q.columns.filter(c => c.field_key !== fieldKey) }
  return { ...q, breakdown: null }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useDragAndDrop({
  query,
  onQueryChange,
}: {
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
}) {
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null)

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const d = active.data.current as { type: "field" | "chip"; field_key: string; display_name?: string; field_type?: string; sourceZone?: ZoneName }
    setActiveDrag({
      activeType: d.type,
      fieldKey: d.field_key,
      displayName: d.display_name,
      fieldType: d.field_type,
      sourceZone: d.sourceZone ?? null,
      overZone: null,
    })
  }, [])

  const onDragOver = useCallback(({ over }: DragOverEvent) => {
    setActiveDrag(prev =>
      prev ? { ...prev, overZone: over ? getZoneFromId(String(over.id)) : null } : null,
    )
  }, [])

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveDrag(null)
      const d = active.data.current as { type: "field" | "chip"; field_key: string; display_name?: string; field_type?: string; sourceZone?: ZoneName }
      onQueryChange(prev => {
        const q = prev ?? DEFAULT_QUERY
        return applyDragEnd(q, {
          activeType: d.type,
          fieldKey: d.field_key,
          displayName: d.display_name,
          fieldType: d.field_type,
          sourceZone: d.sourceZone ?? null,
          overId: over ? String(over.id) : null,
        })
      })
    },
    [onQueryChange],
  )

  const onDragCancel = useCallback(() => setActiveDrag(null), [])

  return { activeDrag, onDragStart, onDragOver, onDragEnd, onDragCancel }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
just test-web -- --reporter=verbose apps/web/src/app/analytics/useDragAndDrop.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/analytics/useDragAndDrop.ts apps/web/src/app/analytics/useDragAndDrop.test.ts
git commit -m "feat(web): useDragAndDrop hook — pure drag handler logic with tests"
```

---

## Task 3: Zone toggle buttons in FieldTreePanel (TDD)

Replace the hover-only `+R`/`+C` buttons with persistent zone toggle buttons in fixed columns. Buttons are always visible when assigned, outline on hover only. Click a field name to add to rows (or remove from all zones if already assigned). Click a zone button to toggle that specific zone.

**Files:**
- Modify: `apps/web/src/app/analytics/FieldTreePanel.test.tsx`
- Modify: `apps/web/src/app/analytics/FieldTreePanel.tsx`

- [ ] **Step 1: Update existing +R/+C tests and add new toggle tests**

In `apps/web/src/app/analytics/FieldTreePanel.test.tsx`, replace the three tests `"clicking +R adds field to rows"`, `"clicking +C adds field to columns in crosstab mode"`, `"+C button is not rendered in trend mode"`, and `"does not add a field to rows if already present"` with:

```ts
  it("R toggle button adds field to rows", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel()
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())

    const fieldContainer = screen.getByTestId("field-row-brand_awareness")
    await user.hover(fieldContainer)
    await user.click(within(fieldContainer).getByRole("button", { name: "Add Brand Awareness to Rows" }))

    expect(onQueryChange).toHaveBeenCalledOnce()
    const updater = onQueryChange.mock.calls[0][0] as (prev: QueryConfig) => QueryConfig
    const result = updater(makeQuery({ dataset_id: 1 }))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].field_key).toBe("brand_awareness")
    expect(result.rows[0].display_name).toBe("Brand Awareness")
  })

  it("C toggle button adds field to columns in crosstab mode", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(makeQuery({ dataset_id: 1, mode: "crosstab" }))
    await waitFor(() => expect(screen.getByText("Gender")).toBeInTheDocument())

    const fieldContainer = screen.getByTestId("field-row-gender")
    await user.hover(fieldContainer)
    await user.click(within(fieldContainer).getByRole("button", { name: "Add Gender to Columns" }))

    expect(onQueryChange).toHaveBeenCalledOnce()
    const updater = onQueryChange.mock.calls[0][0] as (prev: QueryConfig) => QueryConfig
    const result = updater(makeQuery({ dataset_id: 1 }))
    expect(result.columns).toHaveLength(1)
    expect(result.columns[0].field_key).toBe("gender")
  })

  it("C button is not rendered in trend mode, B button is rendered instead", async () => {
    renderPanel(makeQuery({ dataset_id: 1, mode: "trend" }))
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())
    await userEvent.hover(screen.getByTestId("field-row-brand_awareness"))
    expect(screen.queryByRole("button", { name: /to Columns/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /to Breakdown/i })).toBeInTheDocument()
  })

  it("R toggle when field already in rows removes it from rows", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(
      makeQuery({
        dataset_id: 1,
        rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
      }),
    )
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())

    const fieldContainer = screen.getByTestId("field-row-brand_awareness")
    // No hover needed — assigned field shows toggle at all times
    await user.click(within(fieldContainer).getByRole("button", { name: "Remove Brand Awareness from Rows" }))

    expect(onQueryChange).toHaveBeenCalledOnce()
    const updater = onQueryChange.mock.calls[0][0] as (prev: QueryConfig) => QueryConfig
    const result = updater(makeQuery({ dataset_id: 1, rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }] }))
    expect(result.rows).toHaveLength(0)
  })

  it("clicking field name adds to rows when unassigned", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel()
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: "Brand Awareness" }))

    expect(onQueryChange).toHaveBeenCalledOnce()
    const updater = onQueryChange.mock.calls[0][0] as (prev: QueryConfig) => QueryConfig
    const result = updater(makeQuery({ dataset_id: 1 }))
    expect(result.rows[0].field_key).toBe("brand_awareness")
  })

  it("clicking field name removes from all zones when already assigned", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(
      makeQuery({
        dataset_id: 1,
        rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
        columns: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
      }),
    )
    await waitFor(() => expect(screen.getByText("Brand Awareness")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: "Brand Awareness" }))

    expect(onQueryChange).toHaveBeenCalledOnce()
    const updater = onQueryChange.mock.calls[0][0] as (prev: QueryConfig) => QueryConfig
    const prev = makeQuery({
      dataset_id: 1,
      rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
      columns: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    })
    const result = updater(prev)
    expect(result.rows).toHaveLength(0)
    expect(result.columns).toHaveLength(0)
  })
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
just test-web -- --reporter=verbose apps/web/src/app/analytics/FieldTreePanel.test.tsx
```

Expected: the new and updated tests fail (old +R/+C buttons no longer exist in the expected form).

- [ ] **Step 3: Implement toggle buttons in `FieldTreePanel.tsx`**

Replace the `renderField` function and add `handleFieldClick`. The field row grid is `1fr 22px 22px` — two zone columns per mode (R+C for crosstab, R+B for trend).

Replace the `renderField` function (lines 199–233 in current file):

```tsx
  const handleFieldClick = useCallback(
    (field: FieldNode) => {
      onQueryChange((prev) => {
        const base = prev ?? DEFAULT_QUERY
        const inRows = base.rows.some((r) => r.field_key === field.field_key)
        const inCols = base.columns.some((c) => c.field_key === field.field_key)
        const inBreakdown = base.breakdown?.field_key === field.field_key
        if (inRows || inCols || inBreakdown) {
          return {
            ...base,
            rows: base.rows.filter((r) => r.field_key !== field.field_key),
            columns: base.columns.filter((c) => c.field_key !== field.field_key),
            breakdown: inBreakdown ? null : base.breakdown,
          }
        }
        return {
          ...base,
          rows: [
            ...base.rows,
            { field_key: field.field_key, display_name: field.display_name, field_type: field.field_type },
          ],
        }
      })
    },
    [onQueryChange],
  )

  const toggleZone = useCallback(
    (field: FieldNode, zone: "rows" | "columns" | "breakdown") => {
      onQueryChange((prev) => {
        const base = prev ?? DEFAULT_QUERY
        if (zone === "rows") {
          if (base.rows.some((r) => r.field_key === field.field_key)) {
            return { ...base, rows: base.rows.filter((r) => r.field_key !== field.field_key) }
          }
          return { ...base, rows: [...base.rows, { field_key: field.field_key, display_name: field.display_name, field_type: field.field_type }] }
        }
        if (zone === "columns") {
          if (base.columns.some((c) => c.field_key === field.field_key)) {
            return { ...base, columns: base.columns.filter((c) => c.field_key !== field.field_key) }
          }
          return { ...base, columns: [...base.columns, { field_key: field.field_key, display_name: field.display_name, field_type: field.field_type }] }
        }
        // breakdown
        if (base.breakdown?.field_key === field.field_key) {
          return { ...base, breakdown: null }
        }
        return { ...base, breakdown: { field_key: field.field_key, display_name: field.display_name, field_type: field.field_type } }
      })
    },
    [onQueryChange],
  )

  const renderField = (f: FieldNode) => {
    if (!matchesSearch(f.display_name)) return null
    const q = query ?? DEFAULT_QUERY
    const inRows = q.rows.some((r) => r.field_key === f.field_key)
    const inCols = q.columns.some((c) => c.field_key === f.field_key)
    const inBreakdown = q.breakdown?.field_key === f.field_key

    return (
      <div
        key={f.field_key}
        data-testid={`field-row-${f.field_key}`}
        className="group grid items-center gap-1 rounded py-0.5 pl-4 hover:bg-muted/50"
        style={{ gridTemplateColumns: "1fr 22px 22px" }}
      >
        <button
          type="button"
          className="flex-1 cursor-pointer truncate text-left text-sm"
          onClick={() => handleFieldClick(f)}
          aria-label={f.display_name}
        >
          {f.display_name}
        </button>
        <ZoneToggleButton
          label="R"
          isOn={inRows}
          colorClass="text-indigo-500"
          activeBg="bg-indigo-500/15"
          activeBorder="border-indigo-400/40"
          ariaLabelOn={`Remove ${f.display_name} from Rows`}
          ariaLabelOff={`Add ${f.display_name} to Rows`}
          onClick={() => toggleZone(f, "rows")}
        />
        {isCrosstab ? (
          <ZoneToggleButton
            label="C"
            isOn={inCols}
            colorClass="text-amber-600"
            activeBg="bg-amber-500/15"
            activeBorder="border-amber-400/40"
            ariaLabelOn={`Remove ${f.display_name} from Columns`}
            ariaLabelOff={`Add ${f.display_name} to Columns`}
            onClick={() => toggleZone(f, "columns")}
          />
        ) : (
          <ZoneToggleButton
            label="B"
            isOn={inBreakdown}
            colorClass="text-emerald-700"
            activeBg="bg-emerald-500/15"
            activeBorder="border-emerald-400/40"
            ariaLabelOn={`Remove ${f.display_name} from Breakdown`}
            ariaLabelOff={`Add ${f.display_name} to Breakdown`}
            onClick={() => toggleZone(f, "breakdown")}
          />
        )}
      </div>
    )
  }
```

Add `ZoneToggleButton` as a module-level component after `renderField` (outside `FieldTreePanel`):

```tsx
function ZoneToggleButton({
  label,
  isOn,
  colorClass,
  activeBg,
  activeBorder,
  ariaLabelOn,
  ariaLabelOff,
  onClick,
}: {
  label: string
  isOn: boolean
  colorClass: string
  activeBg: string
  activeBorder: string
  ariaLabelOn: string
  ariaLabelOff: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={isOn ? ariaLabelOn : ariaLabelOff}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "flex h-[18px] w-[22px] items-center justify-center rounded text-[9px] font-800 border transition-colors",
        isOn
          ? cn(colorClass, activeBg, activeBorder)
          : "border-transparent text-transparent group-hover:border-border group-hover:text-muted-foreground",
      )}
    >
      {label}
    </button>
  )
}
```

Also remove the old `addToRows` and `addToColumns` callbacks and the `addToColumns` import usage — they are replaced by `toggleZone` and `handleFieldClick`.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
just test-web -- --reporter=verbose apps/web/src/app/analytics/FieldTreePanel.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/analytics/FieldTreePanel.tsx apps/web/src/app/analytics/FieldTreePanel.test.tsx
git commit -m "feat(web): field tree zone toggle buttons replace +R/+C — status indicator + keyboard fallback"
```

---

## Task 4: DndContext in AnalyticsLayout + DragOverlay

Wire up the `DndContext` wrapping and the floating ghost chip that appears during drag.

**Files:**
- Modify: `apps/web/src/app/analytics/AnalyticsLayout.tsx`

- [ ] **Step 1: Update `AnalyticsLayout.tsx`**

Add imports at the top:

```tsx
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { useDragAndDrop } from "./useDragAndDrop"
```

Inside `AnalyticsLayout`, after the existing state declarations, add:

```tsx
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const { activeDrag, onDragStart, onDragOver, onDragEnd, onDragCancel } = useDragAndDrop({
    query,
    onQueryChange: handleQueryChange,
  })
```

The `activationConstraint: { distance: 8 }` prevents accidental drags when clicking.

Wrap the `<Group ...>` element in a `DndContext` and add `DragOverlay` after the Group:

```tsx
  return (
    <div className="flex h-full flex-col bg-muted">
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <Group orientation="horizontal" className="flex-1 p-2">
          {/* ... existing Panel content unchanged ... */}
        </Group>
        <DragOverlay>
          {activeDrag ? (
            <div className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-lg opacity-90">
              <span>{activeDrag.displayName ?? activeDrag.fieldKey}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/analytics/AnalyticsLayout.tsx
git commit -m "feat(web): wrap AnalyticsLayout in DndContext with DragOverlay"
```

---

## Task 5: Make field rows draggable

**Files:**
- Modify: `apps/web/src/app/analytics/FieldTreePanel.tsx`

- [ ] **Step 1: Add `useDraggable` to field rows in `renderField`**

Add import at the top of `FieldTreePanel.tsx`:

```tsx
import { useDraggable } from "@dnd-kit/core"
```

Extract `renderField` into a named component `DraggableFieldRow` so the hook can be called unconditionally. Replace the inline `renderField` call with the new component.

Add after the `ZoneToggleButton` component:

```tsx
function DraggableFieldRow({
  field,
  query,
  isCrosstab,
  onFieldClick,
  onToggleZone,
}: {
  field: FieldNode
  query: QueryConfig
  isCrosstab: boolean
  onFieldClick: (f: FieldNode) => void
  onToggleZone: (f: FieldNode, zone: "rows" | "columns" | "breakdown") => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-${field.field_key}`,
    data: { type: "field", field_key: field.field_key, display_name: field.display_name, field_type: field.field_type },
  })

  const inRows = query.rows.some((r) => r.field_key === field.field_key)
  const inCols = query.columns.some((c) => c.field_key === field.field_key)
  const inBreakdown = query.breakdown?.field_key === field.field_key

  return (
    <div
      ref={setNodeRef}
      data-testid={`field-row-${field.field_key}`}
      className={cn(
        "group grid items-center gap-1 rounded py-0.5 pl-4 hover:bg-muted/50",
        isDragging && "opacity-40",
      )}
      style={{ gridTemplateColumns: "1fr 22px 22px" }}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className="flex-1 cursor-pointer truncate text-left text-sm"
        onClick={() => onFieldClick(field)}
        aria-label={field.display_name}
      >
        {field.display_name}
      </button>
      <ZoneToggleButton
        label="R"
        isOn={inRows}
        colorClass="text-indigo-500"
        activeBg="bg-indigo-500/15"
        activeBorder="border-indigo-400/40"
        ariaLabelOn={`Remove ${field.display_name} from Rows`}
        ariaLabelOff={`Add ${field.display_name} to Rows`}
        onClick={() => onToggleZone(field, "rows")}
      />
      {isCrosstab ? (
        <ZoneToggleButton
          label="C"
          isOn={inCols}
          colorClass="text-amber-600"
          activeBg="bg-amber-500/15"
          activeBorder="border-amber-400/40"
          ariaLabelOn={`Remove ${field.display_name} from Columns`}
          ariaLabelOff={`Add ${field.display_name} to Columns`}
          onClick={() => onToggleZone(field, "columns")}
        />
      ) : (
        <ZoneToggleButton
          label="B"
          isOn={inBreakdown}
          colorClass="text-emerald-700"
          activeBg="bg-emerald-500/15"
          activeBorder="border-emerald-400/40"
          ariaLabelOn={`Remove ${field.display_name} from Breakdown`}
          ariaLabelOff={`Add ${field.display_name} to Breakdown`}
          onClick={() => onToggleZone(field, "breakdown")}
        />
      )}
    </div>
  )
}
```

Update `renderField` inside `FieldTreePanel` to use this component (remove the old inline implementation and replace with):

```tsx
  const renderField = (f: FieldNode) => {
    if (!matchesSearch(f.display_name)) return null
    return (
      <DraggableFieldRow
        key={f.field_key}
        field={f}
        query={query ?? DEFAULT_QUERY}
        isCrosstab={isCrosstab}
        onFieldClick={handleFieldClick}
        onToggleZone={toggleZone}
      />
    )
  }
```

Also remove the `handleFieldClick`, `toggleZone`, and `ZoneToggleButton` from inside `FieldTreePanel` — they now live either outside (ZoneToggleButton) or are passed as props. Keep `handleFieldClick` and `toggleZone` as callbacks inside `FieldTreePanel` and pass them as props to `DraggableFieldRow`.

Note: `{...listeners}` on the row div means dragging starts on the whole row. Clicks on buttons still fire because buttons capture their own click events.

- [ ] **Step 2: Run full test suite**

```bash
just test-web
```

Expected: all tests pass (draggable wrapper doesn't change visible DOM for tests).

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/analytics/FieldTreePanel.tsx
git commit -m "feat(web): field tree rows are now draggable via useDraggable"
```

---

## Task 6: Droppable zones with visual feedback in QueryBuilderPanel

Make the `Zone` component and Breakdown section into drop targets. Add glow-on-active, border-on-hover visual states. Wrap chips in `useSortable`.

**Files:**
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.tsx`

- [ ] **Step 1: Add imports**

Add at the top of `QueryBuilderPanel.tsx`:

```tsx
import { useDroppable, useDndMonitor } from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
```

- [ ] **Step 2: Replace `FieldChip` with a `SortableFieldChip` wrapper**

Add after the existing `FieldChip` component:

```tsx
function SortableFieldChip({
  field,
  zone,
  onRemove,
}: {
  field: FieldSelection
  zone: "rows" | "columns"
  onRemove: (fk: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `chip-${zone}-${field.field_key}`,
    data: {
      type: "chip",
      field_key: field.field_key,
      display_name: field.display_name,
      field_type: field.field_type,
      sourceZone: zone,
    },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FieldChip field={field} onRemove={onRemove} />
    </div>
  )
}
```

- [ ] **Step 3: Update `Zone` to use `useDroppable`, `SortableContext`, `useDndMonitor` and apply visual states**

Replace the `Zone` component with:

```tsx
function Zone({
  label,
  zoneId,
  fields,
  onRemove,
  mode,
  onModeChange,
  showModeSelector,
}: {
  label: string
  zoneId: "zone-rows" | "zone-columns"
  fields: FieldSelection[]
  onRemove: (fk: string) => void
  mode: "stacked" | "nested"
  onModeChange: (m: "stacked" | "nested") => void
  showModeSelector: boolean
}) {
  const [isDragActive, setIsDragActive] = useState(false)
  useDndMonitor({
    onDragStart: () => setIsDragActive(true),
    onDragEnd: () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  })

  const { setNodeRef, isOver } = useDroppable({ id: zoneId })
  const isEmpty = fields.length === 0
  const sortableIds = fields.map((f) => `chip-${zoneId.replace("zone-", "")}-${f.field_key}`)

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[52px] rounded-lg border p-1.5 transition-[box-shadow,background-color]",
          isDragActive && !isOver && "bg-primary/[0.07] shadow-[0_0_0_4px_hsl(var(--primary)/0.14),0_0_12px_hsl(var(--primary)/0.18)]",
          isOver && "border-primary border-2 bg-primary/[0.07] shadow-[0_0_0_4px_hsl(var(--primary)/0.14),0_0_12px_hsl(var(--primary)/0.18)]",
          !isDragActive && (isEmpty ? "border-dashed border-border bg-muted/30" : "border-border bg-card"),
        )}
      >
        {showModeSelector && (
          <div className="mb-1.5 flex justify-end border-b border-border/50 pb-1.5">
            <div className="flex overflow-hidden rounded-full border border-border">
              {(["stacked", "nested"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModeChange(m)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-semibold transition-colors",
                    mode === m
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {m === "stacked" ? "Stacked ↕" : "Nested →"}
                </button>
              ))}
            </div>
          </div>
        )}
        {isEmpty && !isDragActive ? (
          <div className="flex flex-col items-center gap-1 py-1">
            <QueryZoneIllustration />
            <p className="text-[9px] text-muted-foreground">Drag fields here or use R/C buttons</p>
          </div>
        ) : (
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap gap-1">
              {fields.map((f) => (
                <SortableFieldChip
                  key={f.field_key}
                  field={f}
                  zone={zoneId === "zone-rows" ? "rows" : "columns"}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `Zone` call sites in `QueryBuilderPanel` to pass `zoneId`**

In `QueryBuilderPanel`'s JSX, update the Zone calls:

```tsx
        {/* Rows / Fields zone */}
        <Zone
          label={q.mode === "trend" ? "Fields" : "Rows"}
          zoneId="zone-rows"
          fields={q.rows}
          onRemove={removeRow}
          mode={q.row_mode}
          onModeChange={(m) => set({ row_mode: m })}
          showModeSelector={q.rows.length >= 2 && q.mode === "crosstab"}
        />

        {/* Columns zone (crosstab only) */}
        {q.mode === "crosstab" && (
          <Zone
            label="Columns"
            zoneId="zone-columns"
            fields={q.columns}
            onRemove={removeCol}
            mode={q.col_mode}
            onModeChange={(m) => set({ col_mode: m })}
            showModeSelector={q.columns.length >= 2}
          />
        )}
```

- [ ] **Step 5: Make the Breakdown section droppable**

Replace the breakdown `<div>` section in `QueryBuilderPanel` JSX with:

```tsx
        {/* Breakdown (trend only) */}
        {q.mode === "trend" && (
          <BreakdownZone
            breakdown={q.breakdown}
            onRemove={() => set({ breakdown: null })}
          />
        )}
```

Add `BreakdownZone` as a new component:

```tsx
function BreakdownZone({
  breakdown,
  onRemove,
}: {
  breakdown: FieldSelection | null
  onRemove: () => void
}) {
  const [isDragActive, setIsDragActive] = useState(false)
  useDndMonitor({
    onDragStart: () => setIsDragActive(true),
    onDragEnd: () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  })
  const { setNodeRef, isOver } = useDroppable({ id: "zone-breakdown" })

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Break down by
      </p>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[32px] rounded-lg border p-1.5 transition-[box-shadow,background-color]",
          isDragActive && !isOver && "bg-primary/[0.07] shadow-[0_0_0_4px_hsl(var(--primary)/0.14),0_0_12px_hsl(var(--primary)/0.18)]",
          isOver && "border-primary border-2 bg-primary/[0.07] shadow-[0_0_0_4px_hsl(var(--primary)/0.14),0_0_12px_hsl(var(--primary)/0.18)]",
          !isDragActive && "border-border bg-card",
        )}
      >
        {breakdown ? (
          <div
            data-testid={`field-chip-${breakdown.field_key}`}
            className="flex w-fit items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          >
            <span>{breakdown.display_name ?? breakdown.field_key}</span>
            <button
              type="button"
              onClick={onRemove}
              className="text-primary/60 hover:text-primary"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <p className="text-[9px] text-muted-foreground">Drag a field here or use the B button</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run full test suite**

```bash
just test-web
```

Expected: all tests pass. (The Zone prop change from no `zoneId` to requiring `zoneId` is a compile-time error caught by tsc, not a test failure — verify tsc too.)

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/analytics/QueryBuilderPanel.tsx
git commit -m "feat(web): zones are droppable with glow/border feedback; chips are sortable"
```

---

## Task 7: Storybook stories

Add or update stories to show the new states visually. All stories must pass a11y.

**Files:**
- Modify: `apps/web/src/app/analytics/FieldTreePanel.stories.tsx`
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx`

- [ ] **Step 1: Check current story files**

```bash
just storybook
```

Open http://localhost:6006 and confirm existing analytics stories render.

- [ ] **Step 2: Add `WithAssignedFields` story to `FieldTreePanel.stories.tsx`**

Open `apps/web/src/app/analytics/FieldTreePanel.stories.tsx` and add:

```tsx
export const WithAssignedFields: Story = {
  args: {
    query: {
      ...DEFAULT_QUERY,
      dataset_id: 1,
      rows: [
        { field_key: "brand_awareness", display_name: "Brand Awareness", field_type: "categorical" },
        { field_key: "age_group", display_name: "Age Group", field_type: "categorical" },
      ],
      columns: [
        { field_key: "brand_awareness", display_name: "Brand Awareness", field_type: "categorical" },
      ],
    },
  },
  name: "With Assigned Fields (toggle indicators)",
}
```

- [ ] **Step 3: Add `WithPopulatedZones` story to `QueryBuilderPanel.stories.tsx`**

Open `apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx` and add:

```tsx
export const WithPopulatedZones: Story = {
  args: {
    query: {
      ...DEFAULT_QUERY,
      dataset_id: 1,
      rows: [
        { field_key: "brand_awareness", display_name: "Brand Awareness", field_type: "categorical" },
        { field_key: "age_group", display_name: "Age Group", field_type: "categorical" },
      ],
      columns: [
        { field_key: "gender", display_name: "Gender", field_type: "categorical" },
      ],
    },
  },
  name: "With Populated Zones",
}
```

- [ ] **Step 4: Verify stories render and a11y passes**

In Storybook, open "With Assigned Fields" and "With Populated Zones". Check the Accessibility panel — no violations.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/analytics/FieldTreePanel.stories.tsx apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx
git commit -m "feat(web): add drag-and-drop state stories for field tree and query builder"
```

---

## Task 8: Smoke test end-to-end

- [ ] **Step 1: Start dev server**

```bash
just dev
```

Open http://localhost:3000/analytics.

- [ ] **Step 2: Verify drag from field tree to Rows zone**

1. Select a dataset in the Query Builder.
2. Wait for the field tree to load.
3. Drag a field from the tree into the Rows zone.
4. Confirm the chip appears in Rows and the R toggle on that field row is now filled.

- [ ] **Step 3: Verify drag to Columns zone**

Drag a field into the Columns zone. Confirm chip appears and C toggle fills.

- [ ] **Step 4: Verify reorder within zone**

Drag a chip within Rows to a new position. Confirm order changes.

- [ ] **Step 5: Verify drag out to remove**

Drag a chip out of the zone and release. Confirm it disappears from the zone and the toggle in the field tree clears.

- [ ] **Step 6: Verify toggle buttons**

Hover a field row, click R → field added to Rows. Click R again → removed. Click field name when assigned → removed from all zones.

- [ ] **Step 7: Run full test + lint**

```bash
just test
just lint
```

Expected: all pass.
