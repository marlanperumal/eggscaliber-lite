# PostHog — Next.js App Router Integration

Use `@posthog/next` for Next.js App Router. This project also has `@posthog/nextjs-config` for sourcemap uploads in `next.config.ts`.

## Environment Variables

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or your proxy path /ingest
```

## Middleware (proxy + identity seeding)

```ts
// middleware.ts
import { postHogMiddleware } from '@posthog/next'

export default postHogMiddleware({ proxy: true })

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

The middleware seeds an anonymous UUIDv7 identity cookie and proxies SDK calls through your domain (avoids ad-blockers).

## Provider Setup

```tsx
// app/layout.tsx
import { PostHogProvider, PostHogPageView } from '@posthog/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider clientOptions={{ api_host: '/ingest' }} bootstrapFlags>
          <PostHogPageView />
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
```

`bootstrapFlags` evaluates feature flags server-side so they're available immediately without a network round-trip.

## Event Capture

**Client component:**
```tsx
'use client'
import { usePostHog } from '@posthog/next'

export function SignupButton() {
  const posthog = usePostHog()
  return <button onClick={() => posthog.capture('signup_clicked')}>Sign up</button>
}
```

**Server component:**
```tsx
import { getPostHog } from '@posthog/next'

export default async function Page() {
  const posthog = await getPostHog()
  posthog.capture({ event: 'page_viewed' })
}
```

## Feature Flags

**Client:**
```tsx
'use client'
import { useFeatureFlag } from '@posthog/next'

export function MyComponent() {
  const showNewUI = useFeatureFlag('new-ui')
  return showNewUI ? <NewUI /> : <OldUI />
}
```

**Server:**
```tsx
import { getPostHog } from '@posthog/next'

export default async function Page() {
  const posthog = await getPostHog()
  const flags = await posthog.getAllFlags()
}
```

## Event Naming Convention

Use `snake_case` for all event names and properties:
```ts
posthog.capture('file_uploaded', { file_type: 'csv', row_count: 1200 })
posthog.capture('analysis_run', { analysis_type: 'cross_tab', dataset_id: id })
```

## Gotchas

- `usePostHog()` and `useFeatureFlag()` require `'use client'` — they are hooks
- The SDK initialises during render (not in `useEffect`) — hooks are available immediately in children
- Consent opt-out is respected automatically at all layers (middleware, provider, server utils)
- Do not import `posthog-js` directly in Server Components — use `getPostHog()` instead
