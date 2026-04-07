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

## Feature Flags

Use PostHog for feature flags:

```typescript
import { useFeatureFlagEnabled } from "posthog-js/react"

function MyComponent() {
  const showNewFeature = useFeatureFlagEnabled("new-feature-flag")
  return showNewFeature ? <NewFeature /> : <OldFeature />
}
```

## State Management

Prefer React Server Components and URL state (searchParams) for server-rendered data. Use `useState`/`useReducer` for local UI state. Avoid global client state (Redux, Zustand) unless genuinely needed.
