# nuqs — URL Query State (v2.x, Next.js App Router)

## Setup

Install: `just add-web-dep nuqs`

Wrap the root layout body with `NuqsAdapter` (server component, no `'use client'` needed):

```tsx
// apps/web/src/app/layout.tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  )
}
```

## Core API

### Single param

```ts
import { useQueryState, parseAsInteger } from 'nuqs'

const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
```

### Multiple params (preferred — batches URL writes)

```ts
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringLiteral } from 'nuqs'

const [params, setParams] = useQueryStates(
  {
    mode: parseAsStringLiteral(['crosstab', 'trend'] as const).withDefault('crosstab'),
    ds: parseAsInteger,   // null when absent
    q: parseAsString,     // null when absent
  },
  { history: 'replace', scroll: false }
)

// Partial update — only specified keys change
setParams({ mode: 'trend' })
```

## Built-in Parsers

| Parser | Type | Notes |
|--------|------|-------|
| `parseAsString` | `string \| null` | no-op, any value |
| `parseAsInteger` | `number \| null` | parseInt base 10 |
| `parseAsFloat` | `number \| null` | parseFloat |
| `parseAsBoolean` | `boolean \| null` | |
| `parseAsStringLiteral(['a','b'] as const)` | `'a' \| 'b' \| null` | validates against list |
| `parseAsArrayOf(parseAsString)` | `string[] \| null` | comma-separated by default |
| `parseAsJson<T>((v) => v as T)` | `T \| null` | JSON encode/decode; requires a validator function (breaking change in newer nuqs) |
| `parseAsIsoDateTime` | `Date \| null` | ISO 8601 |

All parsers support `.withDefault(value)` to replace `null` with a default, and `.withOptions({...})` for per-param options.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `history` | `'replace'` | `'replace'` or `'push'` (adds browser history entry) |
| `scroll` | `false` | scroll to top on change |
| `shallow` | `true` | set `false` to notify server (re-renders Server Components) |
| `clearOnDefault` | `true` | omit param from URL when value equals default |

Options can be set globally via `<NuqsAdapter defaultOptions={...}>` or per-hook as the second argument.

## Project Convention

This project wraps a `QueryConfig` domain type in a thin hook (`useAnalyticsState`) that maps between `QueryConfig` and flat URL params. Keep this pattern: domain types stay in `analytics-types.ts`, URL mapping lives in the hook.

**URL key shorthand** — use short keys (`ds`, `col`, `bd`, `mt`, `md`) via `useQueryStates` with the `urlKeys` option, or just name them directly. Short keys keep URLs legible.

**Complex nested data** (e.g. filters with levels) — use `parseAsJson<T>((v) => v as T)` rather than flattening. The validator is required; a simple cast is fine if you trust the URL source.

## Storybook

Use `NuqsTestingAdapter` from `nuqs/adapters/testing` — **not** the `next/app` adapter.
The `next/app` adapter calls `useRouter()` internally and throws
`invariant expected app router to be mounted` because Storybook doesn't mount the
Next.js App Router. `NuqsTestingAdapter` is a self-contained in-memory URL store
that works in any non-router environment.

```tsx
// AnalyticsPage.stories.tsx
import { NuqsTestingAdapter } from "nuqs/adapters/testing"

const meta = {
  decorators: [
    (Story) => (
      <NuqsTestingAdapter>
        <Story />
      </NuqsTestingAdapter>
    ),
  ],
} satisfies Meta<typeof MyComponent>
```

## Testing

Mock only `useQueryStates`, let real parsers run (they're pure functions):

```ts
vi.mock('nuqs', async (importActual) => {
  const actual = await importActual<typeof import('nuqs')>()
  return { ...actual, useQueryStates: vi.fn() }
})

beforeEach(() => {
  vi.mocked(useQueryStates).mockReturnValue([defaultParams, mockSetP])
})
```
