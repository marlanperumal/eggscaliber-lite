# Frontend Patterns

## Data Fetching

Use `openapi-fetch` with the generated types from `packages/shared/api.d.ts`:

```typescript
import createClient from "openapi-fetch"
import type { paths } from "@eggscaliber/shared"

const api = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_URL })

const { data, error } = await api.GET("/api/v1/datasets")
```

Never use raw `fetch` for API calls — always go through the typed client.

## Mutations

Use `mutate()` from `@/lib/mutate` for **any state-changing API call** (POST, PATCH, PUT, DELETE). It fires `toast.error` automatically on failure and returns `{ data, error }` for the caller to act on.

```typescript
import { mutate } from "@/lib/mutate"

// Basic DELETE — guard state update on error
const { error } = await mutate(
  () => api.DELETE("/api/v1/datasets/{dataset_id}", { params: { path: { dataset_id: id } } }),
  { errorMessage: "Failed to delete dataset. Please try again." },
)
if (error) return
setItems((prev) => prev.filter((d) => d.id !== id))

// POST/PATCH that returns data — guard on both error and missing data
const { data, error } = await mutate(
  () => api.POST("/api/v1/groups", { body: { name: newName.trim() } }),
  { errorMessage: "Failed to create group. Please try again." },
)
if (error || !data) return
await fetchGroups()
```

**Guards:**
- `if (error) return` — when you only need the side-effect, not the response body
- `if (error || !data) return` — when the response body is required for state updates

Never call `api.POST/PATCH/PUT/DELETE` directly in a component — always wrap in `mutate()` so errors surface as toasts. (Read-only `api.GET` calls do not need `mutate()`.)

**Exception: semantically read-like POST endpoints** — some endpoints use POST only because the query payload is too large for a query string (e.g. `/analytics/crosstab`, `/analytics/trend`). These endpoints do not change state. Call them directly with `api.POST` if the component displays errors inline (rather than as toasts), and add an exception comment:

```typescript
// Exception: analytics POST is semantically a read — no state change, errors shown inline.
const { data, error: apiError } = await api.POST("/api/v1/analytics/crosstab", { body: {...} })
if (apiError) throw new Error(JSON.stringify(apiError))
```

### Never cast API response data with `as any`

The typed client infers response types from `api.d.ts`. Casting response `data` with `as any` defeats this:

```typescript
// WRONG — loses type safety
const { data } = await api.GET("/api/v1/uploads/{session_id}", { ... })
setFields((data as any).fields)

// CORRECT — data is UploadSessionDetail, .fields is typed
const { data } = await api.GET("/api/v1/uploads/{session_id}", { ... })
if (data) setFields(data.fields)
```

If `data` is `unknown` for an endpoint, the backend route is missing `response_model=`. Fix it there — don't work around it with `as any`.

### Casting at API enum boundaries

Select inputs return `string`, but API bodies may require a specific enum type (e.g. `FieldType`). Cast at the call site, not in state:

```typescript
type FieldType = components["schemas"]["FieldType"]

// State stays as string (select returns string)
const [overrideType, setOverrideType] = useState<string>("")

// Cast at the API boundary
body: { override_type: (overrideType || null) as FieldType | null }
```

### Multipart / FormData uploads

`openapi-typescript` generates `file: string` (binary) for file fields, which conflicts with the `File` type. For FormData uploads, `as never` on the body is the accepted workaround — response data is still fully typed:

```typescript
const { data, error } = await api.POST("/api/v1/uploads", { body: form as never })
if (error || !data) throw new Error(JSON.stringify(error))
setSessionId(data.id)  // data is UploadCreatedResponse — fully typed
```

## Component Structure

Stories colocated with components:

```
src/components/ui/
  Button.tsx
  Button.stories.tsx   ← same directory, not in a separate stories/ folder
  Button.test.tsx      ← unit tests alongside the component (if needed)
```

Storybook uses `@storybook/nextjs-vite` (Vite-based, required for Next.js 16 compatibility). Story files import from `@storybook/nextjs-vite` and use `satisfies Meta<typeof Component>`:

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Button } from "./Button"

const meta = {
  component: Button,
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { children: "Click me" } }
```

## Testable Components

Add `data-testid` to structural containers — elements that hold interactive children but have no meaningful accessible role of their own. Do not add testids to interactive elements (buttons, inputs, selects) or to elements whose text content is the thing being asserted.

**Naming convention:** `{component}-{identifier}`, e.g. `field-chip`, `field-row-brand_awareness`, `results-panel`.

```tsx
// ✅ Structural container — no role, identified by content
<div data-testid={`field-row-${f.field_key}`} className="group flex ...">
  <button>+R</button>
  <button>+C</button>
</div>

// ✅ Chip wrapper — wraps content but is not itself interactive
<div data-testid="field-chip" className="flex items-center ...">
  <span>{f.display_name}</span>
  <button><X /></button>
</div>

// ❌ Don't add testid to interactive elements — use getByRole instead
<button data-testid="run-button">Run</button>
```

In tests, locate containers by testid and interactive elements within them by role:

```typescript
// Unit tests
within(screen.getByTestId("field-row-gender")).getByRole("button", { name: "+C" })

// E2E
page.getByTestId("field-row-gender").getByRole("button", { name: "+C" })
page.getByTestId("field-chip").filter({ hasText: "Brand Awareness" })
```

Never locate elements by CSS class names — they couple tests to Tailwind implementation details and break silently when styles change.

## Feature Flags

Use PostHog via `@posthog/next` — do not import from `posthog-js/react` directly.

Client components (requires `'use client'`):

```typescript
'use client'
import { useFeatureFlag } from "@posthog/next"

function MyComponent() {
  const showNewFeature = useFeatureFlag("new-feature-flag")
  return showNewFeature ? <NewFeature /> : <OldFeature />
}
```

Server components:

```typescript
import { getPostHog } from "@posthog/next"

export default async function Page() {
  const posthog = await getPostHog()
  const flags = await posthog.getAllFlags()
}
```

**`useFeatureFlag` returns `undefined` while PostHog resolves flags** — always handle this loading state explicitly, otherwise the component will render nothing (or the wrong branch) until flags arrive:

```typescript
'use client'
import { useFeatureFlag } from "@posthog/next"

function AnalyticsPage() {
  const enabled = useFeatureFlag("analytics-engine")
  if (enabled === undefined) return <LoadingSpinner />  // flags still loading
  if (!enabled) return <NotFound />
  return <AnalyticsApp />
}
```

In E2E tests, the `e2e/fixtures.ts` fixture intercepts PostHog's `/flags` endpoint and returns all flags as enabled so tests never block on this loading state. Always import from `./fixtures` not `@playwright/test` directly.

Event capture in client components:

```typescript
'use client'
import { usePostHog } from "@posthog/next"

export function UploadButton() {
  const posthog = usePostHog()
  return (
    <button onClick={() => posthog.capture("file_uploaded", { file_type: "csv" })}>
      Upload
    </button>
  )
}
```

## Storybook

Stories are colocated with their component in the same directory. One exception: **documentation-only stories** with no corresponding component file (e.g. design-token showcases, typography references) may live in `src/stories/`. These exist solely to document the design system, not to test a component.

```
src/components/ui/
  Button.tsx
  Button.stories.tsx      ← colocated with component

src/stories/
  DesignTokens.stories.tsx  ← documentation-only, no component to colocate with
```

For async data patterns, error-state coverage, play() guidance, and mock strategy,
see [docs/patterns/storybook.md](storybook.md).

## Design System

Follow `docs/patterns/design-system.md` for all styling decisions. Key rules:

- Use semantic token utilities (`bg-card`, `text-foreground`, `border-border`)
  — never raw hex or Tailwind colour utilities like `bg-red-500`
- Never use `text-primary` as a text colour — it is reserved for interactive
  element backgrounds only
- Never write `dark:` overrides in component classes — tokens handle both
  modes automatically. **Exception:** `dark:` transform utilities (`dark:rotate-*`,
  `dark:scale-*`) used for icon animations are allowed, since they don't bypass
  the colour token system.
- Typography: `text-sm` is the body default; use the scale in
  `design-system.md` for headings and labels
- Use canonical Tailwind class names — Biome's `useSortedClasses` rule enforces
  the short form where Tailwind v4 deprecated the long alias (e.g. `shrink-0`
  not `flex-shrink-0`, `grow` not `flex-grow`). This also applies inside `cn()`
  calls. Violations appear as warnings during `just lint`.

## State Management

Prefer React Server Components and URL state for server-rendered data. Use `useState`/`useReducer` for local UI state. Avoid global client state (Redux, Zustand) unless genuinely needed.

### URL state — nuqs

Use **nuqs** (`useQueryStates`) for any client state that should survive a page refresh or be shareable via URL. The `NuqsAdapter` is already in the root layout.

```ts
import { useQueryStates, parseAsStringLiteral, parseAsInteger } from 'nuqs'

const [params, setParams] = useQueryStates(
  {
    mode: parseAsStringLiteral(['crosstab', 'trend'] as const).withDefault('crosstab'),
    ds: parseAsInteger,
  },
  { history: 'replace', scroll: false },
)
```

Keep domain types separate from URL params — wrap `useQueryStates` in a feature hook (e.g. `useAnalyticsState`) that converts between the two. Use short URL keys (`ds`, `col`, `bd`) for readability. Use `parseAsJson<T>()` for complex nested types that can't be flattened.
