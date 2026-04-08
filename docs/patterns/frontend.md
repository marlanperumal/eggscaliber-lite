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

## State Management

Prefer React Server Components and URL state (searchParams) for server-rendered data. Use `useState`/`useReducer` for local UI state. Avoid global client state (Redux, Zustand) unless genuinely needed.
