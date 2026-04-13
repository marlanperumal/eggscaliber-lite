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
