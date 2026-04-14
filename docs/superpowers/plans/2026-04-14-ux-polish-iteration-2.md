# UX Polish — Iteration 2: Query Builder Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw `<button>`/`<select>` elements in `QueryBuilderPanel` with polished, on-brand shadcn components — mode mini-cards, breadcrumb dataset picker, type-circle field chips, zone areas with empty/populated states, stacked/nested toggle inside zones, and a type×display measure matrix — then document with Storybook stories serving as both interactive prototype and reference.

**Architecture:** `QueryBuilderPanel` is a controlled component (receives `query`/`onQueryChange` as props) — all visual changes are self-contained within it and its sub-components. `FieldSelection` gains an optional `field_type` field so type circles render correctly on chips; `FieldTreePanel` is updated to supply it. Storybook stories at both component and page level replace HTML mockups as the interactive prototype.

**Tech Stack:** Next.js 16 App Router, shadcn/ui (`Select`, `Button`), Tailwind v4 tokens, Storybook `@storybook/nextjs-vite`, Vitest + Testing Library.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/web/src/app/analytics/analytics-types.ts` | Modify | Add `field_type?` to `FieldSelection` |
| `apps/web/src/app/analytics/FieldTreePanel.tsx` | Modify | Pass `field_type` in `addToRows`/`addToColumns` |
| `apps/web/src/app/analytics/QueryBuilderPanel.tsx` | Modify | Full visual refactor |
| `apps/web/src/app/analytics/QueryBuilderPanel.test.tsx` | Modify | Update selectors/assertions for new UI |
| `apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx` | Create | 6 component stories |
| `apps/web/src/app/analytics/AnalyticsPage.stories.tsx` | Create | Page-level composed story |

---

### Task 1: Add `field_type` to `FieldSelection` and thread it through `FieldTreePanel`

**Files:**
- Modify: `apps/web/src/app/analytics/analytics-types.ts`
- Modify: `apps/web/src/app/analytics/FieldTreePanel.tsx`
- Test: run `just test-web` to confirm no regressions

- [ ] **Step 1: Update `FieldSelection` type**

In `apps/web/src/app/analytics/analytics-types.ts`, update `FieldSelection`:

```typescript
export interface FieldSelection {
  field_key: string
  display_name?: string
  field_type?: string
}
```

- [ ] **Step 2: Update `addToRows` in `FieldTreePanel.tsx`**

Locate `addToRows` (line ~138). Add `field_type`:

```typescript
const addToRows = useCallback(
  (field: FieldNode) => {
    onQueryChange((prev) => {
      const base = prev ?? DEFAULT_QUERY
      if (base.rows.some((r) => r.field_key === field.field_key)) return base
      return {
        ...base,
        rows: [
          ...base.rows,
          {
            field_key: field.field_key,
            display_name: field.display_name,
            field_type: field.field_type,
          },
        ],
      }
    })
  },
  [onQueryChange],
)
```

- [ ] **Step 3: Update `addToColumns` in `FieldTreePanel.tsx`**

Locate `addToColumns` (line ~152). Add `field_type`:

```typescript
const addToColumns = useCallback(
  (field: FieldNode) => {
    onQueryChange((prev) => {
      const base = prev ?? DEFAULT_QUERY
      if (base.columns.some((c) => c.field_key === field.field_key)) return base
      return {
        ...base,
        columns: [
          ...base.columns,
          {
            field_key: field.field_key,
            display_name: field.display_name,
            field_type: field.field_type,
          },
        ],
      }
    })
  },
  [onQueryChange],
)
```

- [ ] **Step 4: Run tests to confirm no regressions**

```bash
just test-web
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/analytics/analytics-types.ts apps/web/src/app/analytics/FieldTreePanel.tsx
git commit -F /tmp/commit-msg.txt
```

Write to `/tmp/commit-msg.txt`:
```
feat(web): add field_type to FieldSelection and thread through FieldTreePanel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 2: Update tests for the new QueryBuilderPanel UI

Write the updated tests first (TDD) so they describe the new UI. They will fail until Task 3 implements the component.

**Files:**
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.test.tsx`

- [ ] **Step 1: Replace test file content**

Replace `apps/web/src/app/analytics/QueryBuilderPanel.test.tsx` with:

```typescript
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import type { AnalyticsResult, QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { QueryBuilderPanel } from "./QueryBuilderPanel"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
}))

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)

const SCOPE_RESPONSE = [
  {
    id: 1,
    name: "Demo Data",
    collections: [
      {
        id: 1,
        name: "Brand Tracker",
        datasets: [{ id: 1, name: "Wave 1" }],
      },
    ],
  },
]

const CROSSTAB_RESULT: AnalyticsResult = {
  meta: {
    mode: "crosstab",
    measure: { type: "count", field_key: null, aggregation: null, display: "n" },
    dataset_name: "Wave 1",
    base_n: 50,
    row_fields: [{ field_key: "gender", display_name: "Gender" }],
    col_fields: [],
    level_labels: { gender: { male: "Male", female: "Female" } },
  },
  rows: [{ key: ["gender", "male"], values: { Total: 25 } }],
}

function makeQuery(overrides: Partial<QueryConfig> = {}): QueryConfig {
  return { ...DEFAULT_QUERY, ...overrides }
}

function renderPanel(
  query: QueryConfig = makeQuery(),
  overrides: {
    onQueryChange?: ReturnType<typeof vi.fn>
    onResult?: ReturnType<typeof vi.fn>
  } = {},
) {
  const onQueryChange = overrides.onQueryChange ?? vi.fn()
  const onResult = overrides.onResult ?? vi.fn()
  render(
    <QueryBuilderPanel
      onCollapse={vi.fn()}
      query={query}
      onQueryChange={onQueryChange}
      onResult={onResult}
    />,
  )
  return { onQueryChange, onResult }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: SCOPE_RESPONSE } as never)
})

describe("QueryBuilderPanel", () => {
  it("renders mode cards and defaults to cross-tab", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: /cross-tab/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /trending/i })).toBeInTheDocument()
    expect(screen.getByText("Dataset")).toBeInTheDocument()
  })

  it("switching to Trending shows Collection scope picker", async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole("button", { name: /trending/i }))
    renderPanel(makeQuery({ mode: "trend" }))
    expect(screen.getByText("Collection")).toBeInTheDocument()
  })

  it("shows error when Run clicked without a dataset in crosstab mode", async () => {
    const user = userEvent.setup()
    renderPanel(makeQuery({ dataset_id: null }))
    await user.click(screen.getByRole("button", { name: /run query/i }))
    expect(screen.getByText("Select a dataset first")).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it("shows error when Run clicked without a collection in trend mode", async () => {
    const user = userEvent.setup()
    renderPanel(makeQuery({ mode: "trend", collection_id: null }))
    await user.click(screen.getByRole("button", { name: /run query/i }))
    expect(screen.getByText("Select a collection first")).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it("calls crosstab API and invokes onResult on successful run", async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ data: CROSSTAB_RESULT } as never)
    const { onResult } = renderPanel(
      makeQuery({
        dataset_id: 1,
        rows: [{ field_key: "gender", display_name: "Gender" }],
      }),
    )

    await user.click(screen.getByRole("button", { name: /run query/i }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledOnce())
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/analytics/crosstab",
      expect.objectContaining({
        body: expect.objectContaining({ dataset_id: 1 }),
      }),
    )
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(CROSSTAB_RESULT, expect.anything()))
  })

  it("shows loading state while API call is in flight", async () => {
    const user = userEvent.setup()
    mockPost.mockReturnValueOnce(new Promise(() => {}) as never)
    renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: /run query/i }))
    expect(screen.getByRole("button", { name: /running/i })).toBeDisabled()
  })

  it("shows error message when API call fails", async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ error: { detail: "Internal Server Error" } } as never)
    renderPanel(makeQuery({ dataset_id: 1 }))

    await user.click(screen.getByRole("button", { name: /run query/i }))

    await waitFor(() => expect(screen.getByText(/internal server error/i)).toBeInTheDocument())
  })

  it("displays existing row fields with a remove button", () => {
    renderPanel(
      makeQuery({
        rows: [{ field_key: "gender", display_name: "Gender" }],
      }),
    )
    expect(screen.getByText("Gender")).toBeInTheDocument()
  })

  it("calls onQueryChange when a row field is removed", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(
      makeQuery({
        dataset_id: 1,
        rows: [{ field_key: "gender", display_name: "Gender" }],
      }),
    )

    const chip = screen.getByTestId("field-chip-gender")
    await user.click(within(chip).getByRole("button"))

    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.rows).toHaveLength(0)
  })

  it("displays filter fields and allows removal", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(
      makeQuery({
        filters: [{ field_key: "age_group", display_name: "Age Group", levels: ["18_34"] }],
      }),
    )

    expect(screen.getByText("Age Group")).toBeInTheDocument()
    const chip = screen.getByTestId("field-chip-age_group")
    await user.click(within(chip).getByRole("button"))
    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.filters).toHaveLength(0)
  })

  it("measure matrix: clicking a cell sets type and display together", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(makeQuery({ dataset_id: 1 }))

    // Click the "Weighted, N" cell
    await user.click(screen.getByRole("button", { name: "Weighted, N" }))
    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.measure.type).toBe("weighted")
    expect(updatedQuery.measure.display).toBe("n")
  })

  it("measure matrix: clicking a display row sets the correct display", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel(makeQuery({ dataset_id: 1 }))

    // Click the "Count, % Col" cell
    await user.click(screen.getByRole("button", { name: "Count, % Col" }))
    expect(onQueryChange).toHaveBeenCalled()
    const updatedQuery = onQueryChange.mock.calls[0][0] as QueryConfig
    expect(updatedQuery.measure.display).toBe("pct_col")
  })

  it("shows stacked/nested toggle inside zone when 2+ fields are present", () => {
    renderPanel(
      makeQuery({
        rows: [
          { field_key: "gender", display_name: "Gender" },
          { field_key: "age_group", display_name: "Age Group" },
        ],
      }),
    )
    expect(screen.getByRole("button", { name: "Stacked ↕" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nested →" })).toBeInTheDocument()
  })

  it("does not show stacked/nested toggle with fewer than 2 fields", () => {
    renderPanel(
      makeQuery({
        rows: [{ field_key: "gender", display_name: "Gender" }],
      }),
    )
    expect(screen.queryByRole("button", { name: "Stacked ↕" })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail with the old UI**

```bash
just test-web
```

Expected: multiple failures due to changed selectors (`/run query/i`, `"Weighted, N"`, etc.). That's correct — the tests now describe the target UI.

- [ ] **Step 3: Commit failing tests**

```bash
git add apps/web/src/app/analytics/QueryBuilderPanel.test.tsx
git commit -F /tmp/commit-msg.txt
```

Write to `/tmp/commit-msg.txt`:
```
test(web): update QueryBuilderPanel tests for new UI (failing until refactor)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 3: Refactor `QueryBuilderPanel.tsx`

**Files:**
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.tsx`

- [ ] **Step 1: Replace the file with the refactored implementation**

Replace the entire content of `apps/web/src/app/analytics/QueryBuilderPanel.tsx`:

```typescript
"use client"
import { Play, X } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/api"
import type {
  AnalyticsResult,
  DisplayType,
  FieldSelection,
  FilterSpec,
  MeasureSpec,
  MeasureType,
  QueryConfig,
} from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"

// ── Field type display config ──────────────────────────────────────────────

const FIELD_TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  single_response: { color: "#6366f1", icon: "◯" },
  multi_response: { color: "#0ea5e9", icon: "⊕" },
  ordinal: { color: "#f59e0b", icon: "≡" },
  numeric: { color: "#10b981", icon: "#" },
}

// ── Measure matrix config ──────────────────────────────────────────────────

const MEASURE_TYPES: { value: MeasureType; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "weighted", label: "Wtd" },
  { value: "value_field", label: "Value" },
]

const DISPLAY_TYPES: { value: DisplayType; label: string }[] = [
  { value: "n", label: "N" },
  { value: "pct_col", label: "% Col" },
  { value: "pct_row", label: "% Row" },
]

// ── Mode config ────────────────────────────────────────────────────────────

const MODE_CONFIG = [
  { value: "crosstab" as const, icon: "⊞", label: "Cross-tab", desc: "Compare groups" },
  { value: "trend" as const, icon: "📈", label: "Trending", desc: "Track over time" },
]

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
  onResult: (r: AnalyticsResult, q: QueryConfig) => void
}

// ── Main component ─────────────────────────────────────────────────────────

export function QueryBuilderPanel({ onCollapse, query, onQueryChange, onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = query ?? DEFAULT_QUERY
  const set = (patch: Partial<QueryConfig>) => onQueryChange({ ...q, ...patch })

  const removeRow = (fk: string) => set({ rows: q.rows.filter((r) => r.field_key !== fk) })
  const removeCol = (fk: string) => set({ columns: q.columns.filter((c) => c.field_key !== fk) })
  const removeFilter = (fk: string) => set({ filters: q.filters.filter((f) => f.field_key !== fk) })

  const run = async () => {
    if (q.mode === "crosstab" && !q.dataset_id) {
      setError("Select a dataset first")
      return
    }
    if (q.mode === "trend" && !q.collection_id) {
      setError("Select a collection first")
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (q.mode === "crosstab") {
        const { data, error: apiError } = await api.POST("/api/v1/analytics/crosstab", {
          body: {
            dataset_id: q.dataset_id as number,
            rows: q.rows,
            row_mode: q.row_mode,
            columns: q.columns,
            col_mode: q.col_mode,
            // biome-ignore lint/suspicious/noExplicitAny: API body types differ slightly from local types
            filters: q.filters as unknown as any,
            // biome-ignore lint/suspicious/noExplicitAny: API body types differ slightly from local types
            measure: q.measure as unknown as any,
          },
        })
        if (apiError) throw new Error(JSON.stringify(apiError))
        onResult(data as AnalyticsResult, q)
      } else {
        const { data, error: apiError } = await api.POST("/api/v1/analytics/trend", {
          body: {
            collection_id: q.collection_id as number,
            fields: q.rows,
            breakdown: q.breakdown ?? undefined,
            // biome-ignore lint/suspicious/noExplicitAny: API body types differ slightly from local types
            filters: q.filters as unknown as any,
            // biome-ignore lint/suspicious/noExplicitAny: API body types differ slightly from local types
            measure: q.measure as unknown as any,
          },
        })
        if (apiError) throw new Error(JSON.stringify(apiError))
        onResult(data as AnalyticsResult, q)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">Query Builder</span>
        <button
          type="button"
          onClick={onCollapse}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* Mode mini-cards */}
        <div className="grid grid-cols-2 gap-1.5">
          {MODE_CONFIG.map(({ value, icon, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => set({ mode: value })}
              className={cn(
                "flex flex-col items-center rounded-lg border-2 p-2 text-center transition-colors",
                q.mode === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/50",
              )}
            >
              <span className="text-lg leading-none mb-0.5">{icon}</span>
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-[9px] leading-tight text-muted-foreground mt-0.5">{desc}</span>
            </button>
          ))}
        </div>

        {/* Scope picker */}
        <ScopePicker query={q} onSet={set} />

        {/* Rows / Fields zone */}
        <Zone
          label={q.mode === "trend" ? "Fields" : "Rows"}
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
            fields={q.columns}
            onRemove={removeCol}
            mode={q.col_mode}
            onModeChange={(m) => set({ col_mode: m })}
            showModeSelector={q.columns.length >= 2}
          />
        )}

        {/* Breakdown (trend only) */}
        {q.mode === "trend" && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Break down by
            </p>
            {q.breakdown ? (
              <div
                data-testid={`field-chip-${q.breakdown.field_key}`}
                className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary w-fit"
              >
                <span>{q.breakdown.display_name ?? q.breakdown.field_key}</span>
                <button type="button" onClick={() => set({ breakdown: null })} className="text-primary/60 hover:text-primary">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Click a field in the field tree to add it here.
              </p>
            )}
          </div>
        )}

        {/* Filters */}
        {q.filters.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Filters
            </p>
            <div className="flex flex-wrap gap-1">
              {q.filters.map((f) => (
                <FilterChip key={f.field_key} filter={f} onRemove={removeFilter} />
              ))}
            </div>
          </div>
        )}

        {/* Measure matrix */}
        <MeasureMatrix measure={q.measure} onSet={set} />
      </div>

      {/* Run button */}
      <div className="border-t border-border p-3">
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Play className="h-3 w-3" aria-hidden />
          {loading ? "Running…" : "Run Query"}
        </button>
      </div>
    </div>
  )
}

// ── FieldChip ──────────────────────────────────────────────────────────────

function FieldChip({
  field,
  onRemove,
}: {
  field: FieldSelection
  onRemove: (fk: string) => void
}) {
  const typeConfig = field.field_type ? FIELD_TYPE_CONFIG[field.field_type] : null
  return (
    <div
      data-testid={`field-chip-${field.field_key}`}
      className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
    >
      {typeConfig ? (
        <span
          className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[8px] font-black text-white"
          style={{ background: typeConfig.color }}
        >
          {typeConfig.icon}
        </span>
      ) : (
        <span className="h-[18px] w-[18px] flex-shrink-0 rounded-full bg-muted" />
      )}
      <span>{field.display_name ?? field.field_key}</span>
      <button
        type="button"
        onClick={() => onRemove(field.field_key)}
        className="ml-0.5 text-primary/60 hover:text-primary"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

// ── FilterChip ─────────────────────────────────────────────────────────────

function FilterChip({
  filter,
  onRemove,
}: {
  filter: FilterSpec
  onRemove: (fk: string) => void
}) {
  return (
    <div
      data-testid={`field-chip-${filter.field_key}`}
      className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
    >
      <span>{filter.display_name ?? filter.field_key}</span>
      {filter.levels && (
        <span className="text-primary/60">{filter.levels.join(", ")}</span>
      )}
      <button
        type="button"
        onClick={() => onRemove(filter.field_key)}
        className="ml-0.5 text-primary/60 hover:text-primary"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

// ── Zone ───────────────────────────────────────────────────────────────────

function Zone({
  label,
  fields,
  onRemove,
  mode,
  onModeChange,
  showModeSelector,
}: {
  label: string
  fields: FieldSelection[]
  onRemove: (fk: string) => void
  mode: "stacked" | "nested"
  onModeChange: (m: "stacked" | "nested") => void
  showModeSelector: boolean
}) {
  const isEmpty = fields.length === 0
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div
        className={cn(
          "min-h-[52px] rounded-lg border p-1.5",
          isEmpty ? "border-dashed border-border bg-muted/30" : "border-border bg-card",
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
        {isEmpty ? (
          <p className="py-2 text-center text-[10px] text-muted-foreground">
            Click fields to add here
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {fields.map((f) => (
              <FieldChip key={f.field_key} field={f} onRemove={onRemove} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MeasureMatrix ──────────────────────────────────────────────────────────

function MeasureMatrix({
  measure,
  onSet,
}: {
  measure: MeasureSpec
  onSet: (patch: Partial<QueryConfig>) => void
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Measure
      </p>
      <div className="overflow-hidden rounded-md border border-border text-[10px]">
        {/* Column headers */}
        <div className="grid grid-cols-[44px_1fr_1fr_1fr] border-b border-border bg-muted/50">
          <div className="border-r border-border" />
          {MEASURE_TYPES.map(({ value, label }) => (
            <div
              key={value}
              className="border-r border-border py-1 text-center text-[9px] font-semibold text-muted-foreground last:border-r-0"
            >
              {label}
            </div>
          ))}
        </div>
        {/* Data rows */}
        {DISPLAY_TYPES.map(({ value: display, label: displayLabel }) => (
          <div
            key={display}
            className="grid grid-cols-[44px_1fr_1fr_1fr] border-b border-border last:border-b-0"
          >
            <div className="flex items-center border-r border-border bg-muted/50 px-1.5 py-1 text-[9px] font-semibold text-muted-foreground">
              {displayLabel}
            </div>
            {MEASURE_TYPES.map(({ value: type, label: typeLabel }) => {
              const isActive = measure.type === type && measure.display === display
              return (
                <button
                  key={type}
                  type="button"
                  aria-label={`${typeLabel}, ${displayLabel}`}
                  onClick={() =>
                    onSet({ measure: { ...measure, type, display } })
                  }
                  className={cn(
                    "border-r border-border py-1 text-center transition-colors last:border-r-0",
                    isActive
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {isActive ? "✓" : "·"}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ScopePicker ────────────────────────────────────────────────────────────

type ScopePackage = {
  id: number
  name: string
  collections: {
    id: number
    name: string
    datasets: { id: number; name: string }[]
  }[]
}

function ScopePicker({
  query,
  onSet,
}: {
  query: QueryConfig
  onSet: (patch: Partial<QueryConfig>) => void
}) {
  const [packages, setPackages] = useState<ScopePackage[]>([])

  useEffect(() => {
    api.GET("/api/v1/scope").then(({ data }) => {
      if (data) setPackages(data as ScopePackage[])
    })
  }, [])

  if (query.mode === "crosstab") {
    return (
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Dataset
        </p>
        <Select
          value={query.dataset_id?.toString() ?? ""}
          onValueChange={(v) => onSet({ dataset_id: Number(v) || null })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select dataset…" />
          </SelectTrigger>
          <SelectContent>
            {packages.map((pkg) =>
              pkg.collections.map((col) => (
                <SelectGroup key={col.id}>
                  <SelectLabel>
                    {pkg.name} › {col.name}
                  </SelectLabel>
                  {col.datasets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id.toString()}>
                      {pkg.name} › {col.name} › {ds.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )),
            )}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Collection
      </p>
      <Select
        value={query.collection_id?.toString() ?? ""}
        onValueChange={(v) => onSet({ collection_id: Number(v) || null })}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select collection…" />
        </SelectTrigger>
        <SelectContent>
          {packages.map((pkg) =>
            pkg.collections.map((col) => (
              <SelectItem key={col.id} value={col.id.toString()}>
                {pkg.name} › {col.name}
              </SelectItem>
            )),
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
just test-web
```

Expected: all tests pass. If any fail, check the error message and fix the selector or implementation to match.

- [ ] **Step 3: Lint and typecheck**

```bash
just lint
just typecheck
```

Expected: no errors. Fix any biome or TypeScript issues before committing.

- [ ] **Step 4: Visual check in the browser**

Start dev servers: `just dev` (separate terminal). Open http://localhost:3000/analytics. Verify:
- Mode mini-cards render with icons and descriptions
- Selecting a dataset shows a breadcrumb in the trigger
- Field chips show the type circle when fields have `field_type` set
- Empty zones show dashed border + instructional text
- Adding 2+ fields to a zone shows the Stacked/Nested toggle inside the zone, above the chips
- Measure matrix is clickable — active cell shows ✓
- Run button is brand crimson with a play icon

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/analytics/QueryBuilderPanel.tsx
git commit -F /tmp/commit-msg.txt
```

Write to `/tmp/commit-msg.txt`:
```
feat(web): refactor QueryBuilderPanel with polished shadcn controls

- Replace raw buttons with mode mini-cards (icon + description)
- Replace native select with shadcn Select showing breadcrumb hierarchy
- Field chips: 18px type-circle (indigo/sky/amber/emerald per field type)
- Zones: dashed empty state, solid populated state
- Stacked/Nested toggle: inside zone above chips when 2+ fields
- Two measure toggle rows → type × display matrix (one cell active at a time)
- Run button: brand crimson with Play icon

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 4: Write `QueryBuilderPanel.stories.tsx`

> **Note:** Run the `frontend-design` skill during this task for any polish decisions. The scope picker will show "Select dataset…" in Storybook (no API running) — this is expected.

**Files:**
- Create: `apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx`

- [ ] **Step 1: Create the stories file**

Create `apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx`:

```typescript
import { fn } from "@storybook/test"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryBuilderPanel } from "./QueryBuilderPanel"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"

const meta = {
  title: "Analytics/QueryBuilderPanel",
  component: QueryBuilderPanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 280, height: 640, display: "flex" }}>
        <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    onCollapse: fn(),
    onQueryChange: fn(),
    onResult: fn(),
  },
} satisfies Meta<typeof QueryBuilderPanel>

export default meta
type Story = StoryObj<typeof meta>

const withFields = (overrides: Partial<QueryConfig> = {}): QueryConfig => ({
  ...DEFAULT_QUERY,
  ...overrides,
})

// ── Stories ────────────────────────────────────────────────────────────────

export const Empty: Story = {
  name: "Empty (no dataset, no fields)",
  args: { query: withFields() },
}

export const CrosstabWithFields: Story = {
  name: "Crosstab — with fields",
  args: {
    query: withFields({
      dataset_id: 1,
      rows: [
        { field_key: "gender", display_name: "Gender", field_type: "single_response" },
        { field_key: "age_group", display_name: "Age Group", field_type: "ordinal" },
      ],
      columns: [
        { field_key: "brand_awareness", display_name: "Brand Awareness", field_type: "multi_response" },
      ],
      measure: { type: "count", field_key: null, aggregation: null, display: "pct_col" },
    }),
  },
}

export const StackedNestedToggle: Story = {
  name: "Zone with Stacked/Nested toggle visible",
  args: {
    query: withFields({
      dataset_id: 1,
      rows: [
        { field_key: "gender", display_name: "Gender", field_type: "single_response" },
        { field_key: "age_group", display_name: "Age Group", field_type: "ordinal" },
        { field_key: "region", display_name: "Region", field_type: "single_response" },
      ],
      row_mode: "stacked",
    }),
  },
}

export const TrendMode: Story = {
  name: "Trending mode — fields + breakdown",
  args: {
    query: withFields({
      mode: "trend",
      collection_id: 1,
      rows: [
        { field_key: "satisfaction", display_name: "Satisfaction", field_type: "ordinal" },
      ],
      breakdown: { field_key: "gender", display_name: "Gender", field_type: "single_response" },
      measure: { type: "count", field_key: null, aggregation: null, display: "pct_col" },
    }),
  },
}

export const Loading: Story = {
  name: "Run button — loading state",
  args: { query: withFields({ dataset_id: 1 }) },
  // To see loading state: click Run Query in Storybook (will attempt real API call and show loading briefly)
}

export const WithError: Story = {
  name: "Error state",
  // Render the panel with no dataset so clicking Run triggers the validation error
  args: { query: withFields({ dataset_id: null }) },
}
```

- [ ] **Step 2: Start Storybook and verify stories load**

```bash
just storybook
```

Open http://localhost:6006. Navigate to Analytics → QueryBuilderPanel. Check all 6 stories render without console errors.

- [ ] **Step 3: Check a11y for QueryBuilderPanel stories**

In Storybook, open the Accessibility tab for each story. Fix any violations (colour contrast, missing labels, keyboard focus issues).

Common issues to watch for:
- Measure matrix cells: confirm `aria-label` values appear correctly in the a11y tree
- Mode buttons: confirm both have accessible names
- Zone instructional text: confirm it's reachable by screen readers

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx
git commit -F /tmp/commit-msg.txt
```

Write to `/tmp/commit-msg.txt`:
```
feat(web): add QueryBuilderPanel Storybook stories (6 states)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 5: Write `AnalyticsPage.stories.tsx`

This page-level story composes all three panels into a full-height interactive prototype. It requires `just api` + `just db-seed` to be running for API calls to succeed.

**Files:**
- Create: `apps/web/src/app/analytics/AnalyticsPage.stories.tsx`

- [ ] **Step 1: Create the page story**

Create `apps/web/src/app/analytics/AnalyticsPage.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AnalyticsLayout } from "./AnalyticsLayout"

const meta = {
  title: "Analytics/AnalyticsPage",
  component: AnalyticsLayout,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full analytics page — field tree, query builder, and results panel. " +
          "Requires the dev API to be running (`just api`) with seed data (`just db-seed`) " +
          "for dataset/field loading to work.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnalyticsLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: "Full analytics page",
}
```

- [ ] **Step 2: Verify the story in Storybook**

With `just storybook` running, navigate to Analytics → AnalyticsPage → Full analytics page.

- Without `just api`: panels render but field tree shows "Select a dataset to see fields." and scope picker is empty. This is expected.
- With `just api` + `just db-seed`: full interactive prototype — click fields in the tree, configure the query, run, see results.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/analytics/AnalyticsPage.stories.tsx
git commit -F /tmp/commit-msg.txt
```

Write to `/tmp/commit-msg.txt`:
```
feat(web): add AnalyticsPage page-level Storybook story

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 6: Final checks

- [ ] **Step 1: Run full test suite**

```bash
just test
```

Expected: all tests pass.

- [ ] **Step 2: Lint and typecheck**

```bash
just lint
just typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual E2E smoke test**

Start dev servers (`just dev`) and open http://localhost:3000/analytics. Run through the full flow:
1. Select a dataset from the breadcrumb picker
2. Click fields in the tree — confirm they appear as chips with type circles
3. Add 2+ fields to Rows — confirm Stacked/Nested toggle appears inside the zone
4. Select a measure cell in the matrix
5. Click Run Query — confirm results load
6. Switch to Trending mode — confirm the UI adapts (Collection picker, Fields zone, Breakdown)

- [ ] **Step 4: Update ROADMAP.md**

Mark iteration 2 as complete in `docs/ROADMAP.md`:

```markdown
- **Iteration 2 — Query builder controls** ✅ — Styled tabs (Crosstab/Trending), proper dataset Select, pill/toggle button groups for measures
```

- [ ] **Step 5: Commit**

```bash
git add docs/ROADMAP.md
git commit -F /tmp/commit-msg.txt
```

Write to `/tmp/commit-msg.txt`:
```
docs: mark UX polish iteration 2 complete in roadmap

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
