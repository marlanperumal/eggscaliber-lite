# UX Polish — Iteration 3: Empty & Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bare placeholder text across the analytics panels with illustrated empty states and skeleton+spinner loading states.

**Architecture:** A shared `EmptyState` component accepts an SVG illustration + title + body. Three illustration files live in `illustrations/`. Loading state is lifted from `QueryBuilderPanel` to `AnalyticsLayout` so both the query builder Run button and the `ResultsPanel` skeleton react to the same boolean. Field tree loading is tracked locally in `FieldTreePanel`.

**Tech Stack:** React, Tailwind CSS (token classes only), shadcn `Skeleton`, Storybook `@storybook/nextjs-vite`, Vitest + RTL

---

## File Map

**Create:**
- `apps/web/src/app/analytics/EmptyState.tsx` — shared illustrated empty state component
- `apps/web/src/app/analytics/EmptyState.stories.tsx` — design-system reference story
- `apps/web/src/app/analytics/illustrations/FieldTreeIllustration.tsx` — SVG for field tree panel
- `apps/web/src/app/analytics/illustrations/QueryZoneIllustration.tsx` — SVG for zone drop targets
- `apps/web/src/app/analytics/illustrations/ResultsIllustration.tsx` — SVG for results panel
- `apps/web/src/app/analytics/FieldTreePanel.stories.tsx` — NoDataset, Loading, Populated stories
- `apps/web/src/app/analytics/ResultsPanel.stories.tsx` — Empty, Loading, WithResult stories

**Modify:**
- `apps/web/src/app/analytics/FieldTreePanel.tsx` — add `treeLoading` state, header spinner, skeleton body, EmptyState for no-dataset and empty-tree cases
- `apps/web/src/app/analytics/FieldTreePanel.test.tsx` — update text assertions for new copy, add loading skeleton test
- `apps/web/src/app/analytics/QueryBuilderPanel.tsx` — replace internal `loading` state with `isLoading`/`onLoadingChange` props; update Zone empty state to use EmptyState + QueryZoneIllustration
- `apps/web/src/app/analytics/QueryBuilderPanel.test.tsx` — add `isLoading`/`onLoadingChange` to renderPanel helper, update loading test
- `apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx` — add EmptyZones story
- `apps/web/src/app/analytics/AnalyticsLayout.tsx` — manage `isRunning` state, pass to QueryBuilderPanel and ResultsPanel
- `apps/web/src/app/analytics/ResultsPanel.tsx` — add `isLoading` prop, skeleton loading state, EmptyState for no-result case
- `apps/web/src/app/analytics/ResultsPanel.test.tsx` — add `isLoading` to all renders, update text assertion, add loading skeleton test

---

## Task 1: EmptyState component

**Files:**
- Create: `apps/web/src/app/analytics/EmptyState.tsx`
- Test inline (no separate test file — component is tested via the panels that use it)

- [ ] **Step 1: Create EmptyState.tsx**

```tsx
// apps/web/src/app/analytics/EmptyState.tsx
interface EmptyStateProps {
  illustration: React.ReactNode
  title: string
  body: string
}

export function EmptyState({ illustration, title, body }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex items-center justify-center">{illustration}</div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-[160px] text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the test suite to confirm nothing is broken**

```bash
just test-web
```
Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/analytics/EmptyState.tsx
git commit -m "feat(web): add shared EmptyState component"
```

---

## Task 2: Illustration files

**Files:**
- Create: `apps/web/src/app/analytics/illustrations/FieldTreeIllustration.tsx`
- Create: `apps/web/src/app/analytics/illustrations/QueryZoneIllustration.tsx`
- Create: `apps/web/src/app/analytics/illustrations/ResultsIllustration.tsx`

No tests — these are purely visual SVG components. They use `currentColor` so they adapt to the active theme via `className="text-muted-foreground"` on the SVG root.

- [ ] **Step 1: Create FieldTreeIllustration.tsx**

```tsx
// apps/web/src/app/analytics/illustrations/FieldTreeIllustration.tsx
export function FieldTreeIllustration() {
  return (
    <svg
      width="52"
      height="40"
      viewBox="0 0 52 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="text-muted-foreground"
    >
      {/* Root group bar */}
      <rect x="2" y="4" width="22" height="4" rx="2" fill="currentColor" opacity="0.3" />
      {/* Vertical connector */}
      <line x1="4" y1="8" x2="4" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      {/* Child rows with horizontal connectors */}
      <line x1="4" y1="14.5" x2="12" y2="14.5" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <rect x="12" y="12" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      <line x1="4" y1="21.5" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <rect x="12" y="19" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      <line x1="4" y1="28.5" x2="12" y2="28.5" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <rect x="12" y="26" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      {/* Question mark circle */}
      <circle cx="43" cy="20" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <text x="43" y="24" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.4">?</text>
    </svg>
  )
}
```

- [ ] **Step 2: Create QueryZoneIllustration.tsx**

```tsx
// apps/web/src/app/analytics/illustrations/QueryZoneIllustration.tsx
export function QueryZoneIllustration() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="text-muted-foreground"
    >
      <path
        d="M12 3v18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
    </svg>
  )
}
```

- [ ] **Step 3: Create ResultsIllustration.tsx**

```tsx
// apps/web/src/app/analytics/illustrations/ResultsIllustration.tsx
export function ResultsIllustration() {
  return (
    <svg
      width="52"
      height="40"
      viewBox="0 0 52 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="text-muted-foreground"
    >
      <rect x="4" y="24" width="8" height="12" rx="1.5" fill="currentColor" opacity="0.2" />
      <rect x="15" y="16" width="8" height="20" rx="1.5" fill="currentColor" opacity="0.3" />
      <rect x="26" y="10" width="8" height="26" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="37" y="19" width="8" height="17" rx="1.5" fill="currentColor" opacity="0.2" />
      <line x1="2" y1="37" x2="50" y2="37" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/analytics/illustrations/
git commit -m "feat(web): add empty state illustration SVG components"
```

---

## Task 3: FieldTreePanel — empty states + loading

**Files:**
- Modify: `apps/web/src/app/analytics/FieldTreePanel.tsx`
- Modify: `apps/web/src/app/analytics/FieldTreePanel.test.tsx`
- Create: `apps/web/src/app/analytics/FieldTreePanel.stories.tsx`

- [ ] **Step 1: Update the two failing assertions in FieldTreePanel.test.tsx**

The test on line 87 checks for the old placeholder text. Update it, and add a loading skeleton test:

```tsx
// In the describe("FieldTreePanel") block:

it("shows illustrated empty state when no dataset is selected", () => {
  renderPanel(makeQuery({ dataset_id: null }))
  expect(screen.getByText("No dataset selected")).toBeInTheDocument()
  expect(screen.getByText("Choose a dataset in the Query Builder to browse fields")).toBeInTheDocument()
  expect(mockGet).not.toHaveBeenCalled()
})

it("shows loading skeleton while tree is fetching", async () => {
  // mockGet resolves after a delay — use a never-resolving promise to freeze loading state
  mockGet.mockReturnValue(new Promise(() => {}) as never)
  renderPanel()
  // Skeleton elements should be present before the tree resolves
  const skeletons = document.querySelectorAll(".animate-pulse")
  expect(skeletons.length).toBeGreaterThan(0)
})
```

Also delete the old test (line 86-90 in the original file):
```
// DELETE this test:
it("shows placeholder when no dataset is selected", () => { ... })
```

- [ ] **Step 2: Run tests to confirm the two new tests fail (and old ones still pass)**

```bash
just test-web -- --reporter=verbose
```
Expected: "shows illustrated empty state when no dataset is selected" FAILS, "shows loading skeleton while tree is fetching" FAILS, all others PASS.

- [ ] **Step 3: Update FieldTreePanel.tsx**

Replace the entire file with:

```tsx
"use client"
import { ChevronDown, ChevronRight, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { EmptyState } from "./EmptyState"
import { FieldTreeIllustration } from "./illustrations/FieldTreeIllustration"

interface FieldNode {
  id: number
  field_key: string
  display_name: string
  field_type: string
  is_filterable: boolean
  sort_order: number
}

interface GroupNode {
  id: number
  name: string
  slug: string
  sort_order: number
  fields: FieldNode[]
  children: GroupNode[]
}

interface FieldTree {
  groups: GroupNode[]
  ungrouped_fields: FieldNode[]
}

interface Props {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
}

function PanelSpinner() {
  return (
    <div
      className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60"
      aria-label="Loading"
    />
  )
}

export function FieldTreePanel({ onCollapse, query, onQueryChange }: Props) {
  const [tree, setTree] = useState<FieldTree | null>(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [effectiveDatasetId, setEffectiveDatasetId] = useState<number | null>(null)

  useEffect(() => {
    const dsId = query?.dataset_id
    const colId = query?.collection_id
    if (dsId) {
      setEffectiveDatasetId(dsId)
    } else if (colId) {
      api.GET("/api/v1/scope").then(({ data }) => {
        if (!data) return
        for (const pkg of data as {
          id: number
          name: string
          collections: { id: number; datasets: { id: number }[] }[]
        }[]) {
          for (const col of pkg.collections) {
            if (col.id === colId && col.datasets.length > 0) {
              setEffectiveDatasetId(col.datasets[0].id)
              return
            }
          }
        }
      })
    } else {
      setEffectiveDatasetId(null)
    }
  }, [query?.dataset_id, query?.collection_id])

  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  })

  useEffect(() => {
    if (!effectiveDatasetId) {
      setTree(null)
      setTreeLoading(false)
      return
    }
    setTreeLoading(true)
    api
      .GET("/api/v1/datasets/{dataset_id}/field-tree", {
        params: { path: { dataset_id: effectiveDatasetId } },
      })
      .then(({ data }) => {
        if (data) {
          const t = data as FieldTree
          setTree(t)
          setTreeLoading(false)
          setExpanded(new Set(t.groups.map((g) => g.id)))

          const allFields: FieldNode[] = []
          const collectFields = (g: GroupNode) => {
            allFields.push(...g.fields)
            g.children.forEach(collectFields)
          }
          t.groups.forEach(collectFields)
          allFields.push(...t.ungrouped_fields)
          const byKey = Object.fromEntries(allFields.map((f) => [f.field_key, f]))

          const currentQuery = queryRef.current
          const needsEnrich =
            currentQuery?.rows.some((r) => !r.display_name && byKey[r.field_key]) ||
            currentQuery?.columns.some((c) => !c.display_name && byKey[c.field_key])
          if (needsEnrich) {
            onQueryChange((prev) => {
              if (!prev) return prev as unknown as QueryConfig
              return {
                ...prev,
                rows: prev.rows.map((r) =>
                  !r.display_name && byKey[r.field_key]
                    ? { ...r, display_name: byKey[r.field_key].display_name }
                    : r,
                ),
                columns: prev.columns.map((c) =>
                  !c.display_name && byKey[c.field_key]
                    ? { ...c, display_name: byKey[c.field_key].display_name }
                    : c,
                ),
              }
            })
          }
        }
      })
      .catch(() => {
        setTreeLoading(false)
      })
  }, [effectiveDatasetId, onQueryChange])

  const toggleGroup = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

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

  const q = search.toLowerCase()
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q)

  const isCrosstab = (query?.mode ?? "crosstab") === "crosstab"

  const renderField = (f: FieldNode) => {
    if (!matchesSearch(f.display_name)) return null
    return (
      <div
        key={f.field_key}
        data-testid={`field-row-${f.field_key}`}
        className="group flex w-full items-center gap-1 rounded py-0.5 pl-4 hover:bg-muted/50"
      >
        <button
          type="button"
          className="flex-1 cursor-pointer text-left text-sm"
          onClick={() => addToRows(f)}
        >
          {f.display_name}
        </button>
        <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => addToRows(f)}
          >
            +R
          </button>
          {isCrosstab && (
            <button
              type="button"
              className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => addToColumns(f)}
            >
              +C
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderGroup = (g: GroupNode, depth = 0): React.ReactNode => {
    const childFields = g.fields.filter((f) => matchesSearch(f.display_name))
    const childGroups = g.children.filter(
      (c) => matchesSearch(c.name) || c.fields.some((f) => matchesSearch(f.display_name)),
    )
    if (!matchesSearch(g.name) && childFields.length === 0 && childGroups.length === 0) return null
    const isOpen = expanded.has(g.id) || (!!q && (childFields.length > 0 || childGroups.length > 0))
    return (
      <div key={g.id}>
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded py-1 text-left hover:bg-muted/50"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => toggleGroup(g.id)}
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <span className="text-sm font-medium">{g.name}</span>
        </button>
        {isOpen && (
          <div>
            {childGroups.map((c) => renderGroup(c, depth + 1))}
            {childFields.map(renderField)}
          </div>
        )}
      </div>
    )
  }

  const isEmptyTree =
    tree !== null && tree.groups.length === 0 && tree.ungrouped_fields.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Fields</span>
          {treeLoading && <PanelSpinner />}
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search input */}
      <div className="px-3 py-2">
        <input
          type="search"
          placeholder="Search fields…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-1">
        {!effectiveDatasetId && (
          <EmptyState
            illustration={<FieldTreeIllustration />}
            title="No dataset selected"
            body="Choose a dataset in the Query Builder to browse fields"
          />
        )}

        {effectiveDatasetId && treeLoading && (
          <div className="space-y-2 px-3 py-2">
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="ml-4 h-3 w-[50%]" />
            <Skeleton className="ml-4 h-3 w-[60%]" />
            <Skeleton className="mt-2 h-4 w-[55%]" />
            <Skeleton className="ml-4 h-3 w-[45%]" />
            <Skeleton className="ml-4 h-3 w-[65%]" />
          </div>
        )}

        {effectiveDatasetId && isEmptyTree && (
          <EmptyState
            illustration={<FieldTreeIllustration />}
            title="No fields"
            body="This dataset has no browsable fields"
          />
        )}

        {tree && !isEmptyTree && (
          <>
            {tree.groups.map((g) => renderGroup(g))}
            {tree.ungrouped_fields.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ungrouped
                </p>
                {tree.ungrouped_fields.map(renderField)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — both new tests should now pass**

```bash
just test-web -- --reporter=verbose
```
Expected: all tests pass, including the two new ones.

- [ ] **Step 5: Create FieldTreePanel.stories.tsx**

```tsx
// apps/web/src/app/analytics/FieldTreePanel.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { api } from "@/lib/api"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { FieldTreePanel } from "./FieldTreePanel"

const meta = {
  title: "Analytics/FieldTreePanel",
  component: FieldTreePanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 240, height: 560, display: "flex" }}>
        <div
          style={{
            flex: 1,
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    onCollapse: fn(),
    onQueryChange: fn(),
  },
} satisfies Meta<typeof FieldTreePanel>

export default meta
type Story = StoryObj<typeof meta>

function makeQuery(overrides: Partial<QueryConfig> = {}): QueryConfig {
  return { ...DEFAULT_QUERY, ...overrides }
}

export const NoDataset: Story = {
  name: "No dataset selected",
  args: { query: makeQuery() },
}

export const Loading: Story = {
  name: "Loading — fetching tree",
  args: { query: makeQuery({ dataset_id: 1 }) },
  beforeEach() {
    const original = api.GET
    // biome-ignore lint/suspicious/noExplicitAny: story-only mock
    ;(api as any).GET = () => new Promise(() => {})
    return () => {
      // biome-ignore lint/suspicious/noExplicitAny: story-only mock
      ;(api as any).GET = original
    }
  },
}

export const Populated: Story = {
  name: "Populated — requires dev API",
  args: { query: makeQuery({ dataset_id: 1 }) },
  parameters: {
    docs: {
      description: {
        story: "Requires `just api` running with seed data (`just db-seed`) to load fields.",
      },
    },
  },
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/analytics/FieldTreePanel.tsx apps/web/src/app/analytics/FieldTreePanel.test.tsx apps/web/src/app/analytics/FieldTreePanel.stories.tsx
git commit -m "feat(web): add illustrated empty state and loading skeleton to FieldTreePanel"
```

---

## Task 4: QueryBuilderPanel — Zone empty state + EmptyZones story

**Files:**
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.tsx` (Zone component only — no prop changes yet)
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx`

- [ ] **Step 1: Update the Zone empty state in QueryBuilderPanel.tsx**

Find the `Zone` function (around line 306) and replace the empty state render:

```tsx
// OLD — replace this:
{isEmpty ? (
  <p className="py-2 text-center text-[10px] text-muted-foreground">
    Click fields to add here
  </p>
) : (

// NEW — replace with:
{isEmpty ? (
  <div className="flex flex-col items-center gap-1 py-1">
    <QueryZoneIllustration />
    <p className="text-[9px] text-muted-foreground">Drop fields here</p>
  </div>
) : (
```

Add the import at the top of the file:
```tsx
import { QueryZoneIllustration } from "./illustrations/QueryZoneIllustration"
```

- [ ] **Step 2: Add EmptyZones story to QueryBuilderPanel.stories.tsx**

Add after the existing `Empty` story export:

```tsx
export const EmptyZones: Story = {
  name: "Empty zones — illustrated drop targets",
  args: {
    query: withFields({ dataset_id: 1 }),
  },
}
```

- [ ] **Step 3: Run tests — no regressions**

```bash
just test-web -- --reporter=verbose
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/analytics/QueryBuilderPanel.tsx apps/web/src/app/analytics/QueryBuilderPanel.stories.tsx
git commit -m "feat(web): add illustrated empty state to query builder zones"
```

---

## Task 5: Lift loading state + ResultsPanel skeleton

**Files:**
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.tsx` — replace internal `loading` state with props
- Modify: `apps/web/src/app/analytics/QueryBuilderPanel.test.tsx` — update helper, update loading test
- Modify: `apps/web/src/app/analytics/AnalyticsLayout.tsx` — own `isRunning` state
- Modify: `apps/web/src/app/analytics/ResultsPanel.tsx` — add `isLoading` prop + skeleton
- Modify: `apps/web/src/app/analytics/ResultsPanel.test.tsx` — add `isLoading` to renders, update + add tests
- Create: `apps/web/src/app/analytics/ResultsPanel.stories.tsx`

- [ ] **Step 1: Update ResultsPanel.test.tsx**

Update every `render(<ResultsPanel .../>)` call to include `isLoading={false}`. Also update the placeholder text assertion and add a loading test:

```tsx
// Update line ~49 — old assertion:
// expect(screen.getByText("Configure a query and press Run.")).toBeInTheDocument()
// New assertion:
expect(screen.getByText("No results yet")).toBeInTheDocument()
expect(screen.getByText("Configure a query and press Run")).toBeInTheDocument()

// Add a new test in the describe block:
it("shows skeleton and spinner when isLoading is true", () => {
  render(<ResultsPanel result={null} query={null} lastRunQuery={null} isLoading={true} />)
  const skeletons = document.querySelectorAll(".animate-pulse")
  expect(skeletons.length).toBeGreaterThan(0)
  expect(screen.getByLabelText("Loading")).toBeInTheDocument()
})

// Also add isLoading={false} to all other render calls in the file:
// render(<ResultsPanel result={crosstabResult} query={crosstabQuery} lastRunQuery={crosstabQuery} isLoading={false} />)
// render(<ResultsPanel result={trendResult} query={trendQuery} lastRunQuery={trendQuery} isLoading={false} />)
```

- [ ] **Step 2: Update QueryBuilderPanel.test.tsx**

Update `renderPanel` helper to include new props:

```tsx
function renderPanel(
  query: QueryConfig = makeQuery(),
  overrides: {
    onQueryChange?: ReturnType<typeof vi.fn>
    onResult?: ReturnType<typeof vi.fn>
    onLoadingChange?: ReturnType<typeof vi.fn>
  } = {},
) {
  const onQueryChange = overrides.onQueryChange ?? vi.fn()
  const onResult = overrides.onResult ?? vi.fn()
  const onLoadingChange = overrides.onLoadingChange ?? vi.fn()
  render(
    <QueryBuilderPanel
      onCollapse={vi.fn()}
      query={query}
      onQueryChange={
        onQueryChange as unknown as (
          q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig),
        ) => void
      }
      onResult={onResult as unknown as (r: AnalyticsResult, q: QueryConfig) => void}
      isLoading={false}
      onLoadingChange={onLoadingChange}
    />,
  )
  return { onQueryChange, onResult, onLoadingChange }
}
```

Replace the existing loading test (around line 130-137):

```tsx
it("calls onLoadingChange(true) when Run is clicked", async () => {
  const user = userEvent.setup()
  mockPost.mockReturnValueOnce(new Promise(() => {}) as never)
  const { onLoadingChange } = renderPanel(makeQuery({ dataset_id: 1 }))

  await user.click(screen.getByRole("button", { name: /run query/i }))
  expect(onLoadingChange).toHaveBeenCalledWith(true)
})
```

- [ ] **Step 3: Run tests — confirm failures are as expected**

```bash
just test-web -- --reporter=verbose
```
Expected: `ResultsPanel` and `QueryBuilderPanel` tests fail (missing `isLoading`/`onLoadingChange` props).

- [ ] **Step 4: Update QueryBuilderPanel.tsx — lift loading state to props**

Change the Props interface:

```tsx
interface Props {
  onCollapse: () => void
  query: QueryConfig | null
  onQueryChange: (q: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => void
  onResult: (r: AnalyticsResult, q: QueryConfig) => void
  isLoading: boolean
  onLoadingChange: (loading: boolean) => void
}
```

Update the component signature and body:

```tsx
export function QueryBuilderPanel({ onCollapse, query, onQueryChange, onResult, isLoading, onLoadingChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  // Remove: const [loading, setLoading] = useState(false)
```

In the `run` function, replace all `setLoading` calls and `loading` references:
- `setLoading(true)` → `onLoadingChange(true)`
- `setLoading(false)` → `onLoadingChange(false)`
- `loading` in JSX → `isLoading`

The updated `run` function:

```tsx
const run = async () => {
  if (q.mode === "crosstab" && !q.dataset_id) {
    setError("Select a dataset first")
    return
  }
  if (q.mode === "trend" && !q.collection_id) {
    setError("Select a collection first")
    return
  }
  onLoadingChange(true)
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
    onLoadingChange(false)
  }
}
```

Update the Run button JSX to use `isLoading`:

```tsx
<button
  type="button"
  onClick={run}
  disabled={isLoading}
  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
>
  <Play className="h-3 w-3" aria-hidden />
  {isLoading ? "Running…" : "Run Query"}
</button>
```

- [ ] **Step 5: Update AnalyticsLayout.tsx — own the running state**

```tsx
// Add to state declarations at the top of AnalyticsLayout():
const [isRunning, setIsRunning] = useState(false)

// Update QueryBuilderPanel usage:
<QueryBuilderPanel
  onCollapse={toggleBuilder}
  query={query}
  onQueryChange={handleQueryChange}
  isLoading={isRunning}
  onLoadingChange={setIsRunning}
  onResult={(r, q) => {
    setResult(r)
    setLastRunQuery(q)
  }}
/>

// Update ResultsPanel usage:
<ResultsPanel result={result} query={query} lastRunQuery={lastRunQuery} isLoading={isRunning} />
```

Add `useState` import if not already present (it is already present).

- [ ] **Step 6: Update ResultsPanel.tsx — add isLoading prop + skeleton + EmptyState**

```tsx
"use client"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsChart } from "./AnalyticsChart"
import { AnalyticsTable } from "./AnalyticsTable"
import { EmptyState } from "./EmptyState"
import type { AnalyticsResult, ChartType, QueryConfig, ViewMode } from "./analytics-types"
import { ResultsIllustration } from "./illustrations/ResultsIllustration"

const MEASURE_TYPE_LABELS: Record<string, string> = {
  count: "Count",
  weighted: "Weighted",
  value_field: "Value",
}

const DISPLAY_LABELS: Record<string, string> = {
  n: "N",
  pct_col: "% of column",
  pct_row: "% of row",
}

interface Props {
  result: AnalyticsResult | null
  query: QueryConfig | null
  lastRunQuery: QueryConfig | null
  isLoading: boolean
}

function PanelSpinner() {
  return (
    <div
      className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60"
      aria-label="Loading"
    />
  )
}

export function ResultsPanel({ result, query, lastRunQuery, isLoading }: Props) {
  const [chartType, setChartType] = useState<ChartType>("grouped_bar")
  const [viewMode, setViewMode] = useState<ViewMode>("stacked")

  if (isLoading) {
    return (
      <div data-testid="results-panel" className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2">
          <PanelSpinner />
          <p className="text-sm text-muted-foreground">Running…</p>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-end gap-2">
            <Skeleton className="h-20 w-8" />
            <Skeleton className="h-28 w-8" />
            <Skeleton className="h-16 w-8" />
            <Skeleton className="h-24 w-8" />
            <Skeleton className="h-20 w-8" />
            <Skeleton className="h-14 w-8" />
          </div>
          <Skeleton className="h-3 w-[90%]" />
          <Skeleton className="h-3 w-[80%]" />
          <Skeleton className="h-3 w-[85%]" />
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div data-testid="results-panel" className="flex h-full flex-col">
        <EmptyState
          illustration={<ResultsIllustration />}
          title="No results yet"
          body="Configure a query and press Run"
        />
      </div>
    )
  }

  const isTrend = query?.mode === "trend"

  const isStale =
    !!result && !!query && !!lastRunQuery && JSON.stringify(query) !== JSON.stringify(lastRunQuery)

  const showChart = viewMode !== "table_only"
  const showTable = viewMode !== "chart_only"
  const measureLabel = MEASURE_TYPE_LABELS[result.meta.measure.type] ?? result.meta.measure.type
  const displayLabel = DISPLAY_LABELS[result.meta.measure.display] ?? result.meta.measure.display

  return (
    <div data-testid="results-panel" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
        <div>
          <p className="text-sm font-medium">
            {result.meta.dataset_name ?? result.meta.collection_name}
            {isStale && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (stale — re-run to update)
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            n = {result.meta.base_n ?? "—"} · {measureLabel} · {displayLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(
              [
                ["grouped_bar", "Grouped"],
                ["stacked_bar", "Stacked"],
                ["stacked_bar_100", "100%"],
                ["line", "Line"],
              ] as [ChartType, string][]
            ).map(([ct, label]) => (
              <button
                type="button"
                key={ct}
                disabled={ct === "line" && !isTrend}
                onClick={() => setChartType(ct)}
                title={label}
                className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-30 ${
                  chartType === ct ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-1">
            {(
              [
                ["chart_only", "Chart"],
                ["stacked", "Both"],
                ["table_only", "Table"],
              ] as [ViewMode, string][]
            ).map(([vm, label]) => (
              <button
                type="button"
                key={vm}
                onClick={() => setViewMode(vm)}
                className={`rounded border px-2 py-1 text-xs transition-colors ${
                  viewMode === vm ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`flex flex-1 overflow-hidden ${viewMode === "side_by_side" ? "flex-row" : "flex-col"}`}
      >
        {showChart && (
          <div
            className={`p-4 ${viewMode === "stacked" ? "border-b border-border" : "flex-1 border-r border-border"}`}
          >
            <AnalyticsChart result={result} chartType={chartType} />
          </div>
        )}
        {showTable && (
          <div className="flex-1 overflow-auto">
            <AnalyticsTable result={result} />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run all tests — all should pass**

```bash
just test-web -- --reporter=verbose
```
Expected: all tests pass.

- [ ] **Step 8: Create ResultsPanel.stories.tsx**

```tsx
// apps/web/src/app/analytics/ResultsPanel.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import type { AnalyticsResult, QueryConfig } from "./analytics-types"
import { ResultsPanel } from "./ResultsPanel"

const meta = {
  title: "Analytics/ResultsPanel",
  component: ResultsPanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ height: 560, display: "flex" }}>
        <div
          style={{
            flex: 1,
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ResultsPanel>

export default meta
type Story = StoryObj<typeof meta>

const MEASURE = {
  type: "count" as const,
  field_key: null,
  aggregation: null,
  display: "n" as const,
}

const crosstabResult: AnalyticsResult = {
  meta: {
    mode: "crosstab",
    row_fields: [{ field_key: "gender", display_name: "Gender" }],
    col_fields: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    row_mode: "stacked",
    col_mode: "stacked",
    measure: MEASURE,
    dataset_name: "Wave 3 – Brand Tracker",
    base_n: 1200,
  },
  rows: [
    { key: ["gender", "Male"], values: { Aware: 248, Unaware: 152, Total: 400 } },
    { key: ["gender", "Female"], values: { Aware: 312, Unaware: 88, Total: 400 } },
  ],
}

const baseQuery: QueryConfig = {
  mode: "crosstab",
  dataset_id: 1,
  collection_id: null,
  rows: [{ field_key: "gender", display_name: "Gender" }],
  row_mode: "stacked",
  columns: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
  col_mode: "stacked",
  breakdown: null,
  filters: [],
  measure: MEASURE,
}

export const Empty: Story = {
  name: "Empty — no results yet",
  args: { result: null, query: null, lastRunQuery: null, isLoading: false },
}

export const Loading: Story = {
  name: "Loading — query running",
  args: { result: null, query: baseQuery, lastRunQuery: null, isLoading: true },
}

export const WithResult: Story = {
  name: "With result — crosstab",
  args: { result: crosstabResult, query: baseQuery, lastRunQuery: baseQuery, isLoading: false },
}
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/analytics/QueryBuilderPanel.tsx apps/web/src/app/analytics/QueryBuilderPanel.test.tsx apps/web/src/app/analytics/AnalyticsLayout.tsx apps/web/src/app/analytics/ResultsPanel.tsx apps/web/src/app/analytics/ResultsPanel.test.tsx apps/web/src/app/analytics/ResultsPanel.stories.tsx
git commit -m "feat(web): add loading skeleton and lift loading state for ResultsPanel"
```

---

## Task 6: EmptyState stories + final typecheck

**Files:**
- Create: `apps/web/src/app/analytics/EmptyState.stories.tsx`

- [ ] **Step 1: Create EmptyState.stories.tsx**

```tsx
// apps/web/src/app/analytics/EmptyState.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EmptyState } from "./EmptyState"
import { FieldTreeIllustration } from "./illustrations/FieldTreeIllustration"
import { QueryZoneIllustration } from "./illustrations/QueryZoneIllustration"
import { ResultsIllustration } from "./illustrations/ResultsIllustration"

const meta = {
  title: "Analytics/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const FieldTree: Story = {
  name: "Field tree — no dataset",
  args: {
    illustration: <FieldTreeIllustration />,
    title: "No dataset selected",
    body: "Choose a dataset in the Query Builder to browse fields",
  },
}

export const QueryZone: Story = {
  name: "Query zone — empty drop target",
  args: {
    illustration: <QueryZoneIllustration />,
    title: "Drop fields here",
    body: "Click a field in the field tree to add it",
  },
}

export const Results: Story = {
  name: "Results panel — no results yet",
  args: {
    illustration: <ResultsIllustration />,
    title: "No results yet",
    body: "Configure a query and press Run",
  },
}
```

- [ ] **Step 2: Run full typecheck**

```bash
just typecheck
```
Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
just test
```
Expected: all tests pass.

- [ ] **Step 4: Run lint**

```bash
just lint
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/analytics/EmptyState.stories.tsx
git commit -m "feat(web): add EmptyState Storybook stories for design-system reference"
```

---

## Verification

After all tasks:

- [ ] Open Storybook (`just storybook`) and verify:
  - `Analytics/EmptyState` — three variants render correctly with illustrations
  - `Analytics/FieldTreePanel/No dataset selected` — illustrated empty state
  - `Analytics/FieldTreePanel/Loading` — skeleton rows + header spinner
  - `Analytics/QueryBuilderPanel/Empty zones` — zone drop targets show illustration
  - `Analytics/ResultsPanel/Empty` — illustrated empty state
  - `Analytics/ResultsPanel/Loading` — skeleton bars + header spinner
  - All stories pass a11y checks (run Accessibility tab in Storybook)
- [ ] Update `docs/ROADMAP.md` — mark Iteration 3 complete (✅)
