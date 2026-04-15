# Testing Standards

## Core Principles

**Integration-first.** Tests run against the real `eggscaliber_test` Postgres database — same container, different DB name. Never use SQLite. No dialect mismatch, full pgvector support.

**Test real behaviour.** Tests should catch real bugs. Do not write tests that only assert values you set up, or that verify internal functions were called.

**No unnecessary mocking.** Only mock at true external boundaries:
- External HTTP APIs (third-party services)
- Clerk authentication (in tests, use `AUTH_MODE=dev` and a dev JWT)
- Cloudflare R2 (use a test bucket or skip storage assertions in unit tests)

Never mock: the database, internal services, repositories.

## Transaction Rollback Isolation

Every test runs inside a transaction that is rolled back on teardown. This means:
- No test data leaks between tests
- Tests can run in parallel safely
- No `DELETE FROM` teardown needed

The fixtures in `apps/api/tests/conftest.py` implement this pattern. Use them — do not create your own engine/session fixtures.

## Fixture Scopes

| Fixture | Scope | Purpose |
| --- | --- | --- |
| `async_engine` | session | one async engine for the whole test run |
| `db` | function | transaction-wrapped `AsyncSession`, rolled back after each test |
| `client` | function | `AsyncClient` with `get_session` overridden to use `db` |

## Migration Tests

Three tests in `tests/test_migrations.py` run as part of every test suite:

1. `test_single_migration_head` — linear history, no branches
2. `test_no_pending_model_changes` — all model changes have a migration
3. `test_migration_upgrade_downgrade_cycle` — full cycle on dedicated migrations DB

These run in CI before any other tests (migrations are applied to `eggscaliber_test` first).

## Naming Conventions

```python
async def test_<thing>_<condition>_<expected_outcome>():
    ...

# Examples:
async def test_create_dataset_with_duplicate_name_raises_409(): ...
async def test_health_returns_ok(): ...
async def test_cross_tab_with_no_data_returns_empty_table(): ...
```

---

## Frontend Testing

### Tools

- **Vitest** — test runner for all frontend unit and hook tests
- **@testing-library/react** — `render` and `renderHook` for components and hooks
- Tests live alongside the code they test: `Button.tsx` + `Button.test.tsx` in the same directory

### What to test

Write tests that catch real bugs. Good targets:

- **Pure logic** (e.g. `generateThemeCSS`, parsers, formatters) — test the outputs given known inputs
- **Custom hooks** — test that the hook returns the right shape given controlled external state
- **Component behaviour** — assert what the user sees (`screen.getByRole`) or what callbacks are called, not implementation details

Avoid tests that only assert values you set up, or that verify internal functions were called with specific arguments.

### Mocking

Mock only at true external boundaries. For frontend code, the boundaries are:

| Boundary | Mock approach |
|----------|---------------|
| URL state (nuqs) | `vi.mock('nuqs', ...)` — mock `useQueryStates`, keep real parsers |
| Clerk auth | Use `AUTH_MODE=dev` where possible; mock `@clerk/nextjs` in unit tests |
| API calls (`openapi-fetch`) | Mock the `api` client instance |
| PostHog (E2E) | Playwright network interception in `e2e/fixtures.ts` — intercepts `/flags` endpoint at network level |
| PostHog (unit) | Not needed — analytics components don't call PostHog hooks directly; the flag gate lives at the page level |

**Do not mock `next/navigation` directly.** URL state is managed through nuqs — mock `useQueryStates` instead. This keeps tests decoupled from Next.js router internals.

### Hook tests with nuqs

When testing a hook that wraps `useQueryStates`, mock only that hook and keep the real parsers:

```typescript
import { useQueryStates } from 'nuqs'
import { vi, beforeEach } from 'vitest'

vi.mock('nuqs', async (importActual) => {
  const actual = await importActual<typeof import('nuqs')>()
  return { ...actual, useQueryStates: vi.fn() }
})

const mockSetP = vi.fn()

beforeEach(() => {
  vi.mocked(useQueryStates).mockReturnValue([
    { mode: 'crosstab', ds: null, /* ...rest of param defaults */ },
    mockSetP,
  ])
  mockSetP.mockClear()
})
```

Test that the hook assembles the right domain type from params, and that calling the setter passes the correct flat params back.

### Component tests

Use `@testing-library/react` with a consistent locator strategy:

- **`getByTestId`** to find structural containers (chip wrappers, list rows, panel regions)
- **`getByRole`** / **`getByText`** to find interactive elements within those containers, and for content assertions
- **Never locate by CSS class** — Tailwind class names are implementation details
- **Exception — `Skeleton`**: the shadcn `Skeleton` component has no semantic role or text. Assert on the `animate-pulse` class to verify skeletons are rendered:
  ```typescript
  const skeletons = document.querySelectorAll(".animate-pulse")
  expect(skeletons.length).toBeGreaterThan(0)
  ```

### Testing loading states

Use a never-resolving promise to freeze a component in its loading state:

```typescript
it("shows loading skeleton while fetching", () => {
  mockGet.mockReturnValue(new Promise(() => {}) as never)
  render(<FieldTreePanel ... />)
  const skeletons = document.querySelectorAll(".animate-pulse")
  expect(skeletons.length).toBeGreaterThan(0)
})
```

The cast to `never` is required because `mockReturnValue` expects the resolved
type, not a `Promise` — this is an intentional type escape at the mock boundary.

Verify the spinner element is present via its role:

```typescript
expect(screen.getByRole("status")).toBeInTheDocument()
```

```typescript
import { render, screen, within } from '@testing-library/react'

it('renders the heading', () => {
  render(<Page />)
  // Content assertion — getByRole is appropriate here
  expect(screen.getByRole('heading', { name: /eggscaliber-lite/i })).toBeInTheDocument()
})

it('removes a chip when × is clicked', async () => {
  render(<Zone fields={[{ field_key: 'gender', display_name: 'Gender' }]} ... />)
  // Locate the container by testid, then the button by role within it
  const chip = screen.getByTestId('field-chip-gender')
  await userEvent.click(within(chip).getByRole('button'))
  expect(onRemove).toHaveBeenCalledWith('gender')
})
```

See `docs/patterns/frontend.md` for the full testid naming convention and which elements should carry a testid.

Components that use nuqs hooks will need those hooks mocked as above. Components that use `NuqsAdapter` context can be wrapped with it in the test render if needed.

### Integration tests for feature panels

The integration-test layer is the most cost-effective for catching real bugs. When a feature panel (like `QueryBuilderPanel` or `FieldTreePanel`) has user-interaction logic, write a test that:

1. Renders the full parent component with real child components
2. Mocks only the true external boundary — the API client (`@/lib/api`)
3. Uses `userEvent` to interact, `screen` queries to assert visible output

```typescript
vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
}))

it("calls crosstab API on Run", async () => {
  const user = userEvent.setup()
  vi.mocked(api.POST).mockResolvedValueOnce({ data: mockResult } as never)
  render(<QueryBuilderPanel ... />)
  await user.click(screen.getByRole("button", { name: "Run" }))
  await waitFor(() => expect(api.POST).toHaveBeenCalled())
})
```

When a rendered page has multiple identical-name elements (e.g., many `+R` buttons), scope queries with `within`:

```typescript
import { within } from "@testing-library/react"

const chip = screen.getByText("Gender").closest("div")!
await user.click(within(chip).getByRole("button"))
```

### Running tests

```bash
just test-web    # vitest only
just test        # all tests (pytest + vitest)
```

---

## E2E Tests (Playwright)

E2E tests live in `e2e/` at the repo root. They run against **real running dev servers** and the **real local database** — the full stack end-to-end.

### When to run

These are **not** part of the pre-commit hook or CI by default. Run them:
- Before deploying a significant feature to staging/production
- After changes that touch multiple layers (API + frontend wiring)
- When manual testing finds a regression you want to guard against permanently

### Setup

```bash
# One-time: install browsers
just install-browsers

# Make sure dev servers and seed data are in place
just db-up
just db-seed   # seeds demo-data package if not already present

# Run all E2E tests
just test-e2e

# Run with visible browser (useful when writing new tests)
just test-e2e --headed

# Run a specific spec file
just test-e2e e2e/analytics.spec.ts
```

### Structure

```
e2e/
  fixtures.ts         # Extended test fixture — mocks PostHog feature flags
  analytics.spec.ts   # Analytics feature smoke tests
playwright.config.ts  # Config: servers, retries, reporter
```

### Feature flag mocking

The analytics page is gated by a PostHog feature flag. The `e2e/fixtures.ts` fixture intercepts PostHog's `/flags` endpoint at the network level and returns all flags as enabled — no real PostHog account or configured flag required. It also swallows PostHog's capture/ingestion calls so tests don't depend on external network access.

Always import from `./fixtures` rather than `@playwright/test` directly so the PostHog mock is active:

```typescript
import { expect, test } from "./fixtures"   // ✅ PostHog mocked
import { expect, test } from "@playwright/test"  // ❌ flag gate not bypassed
```

### Writing new E2E tests

- Test the happy path of a user flow, not implementation details
- Use `page.getByTestId` for structural containers, `getByRole`/`getByText` for interactive elements and content assertions — never CSS class selectors
- Scope clicks on repeated elements (e.g. multiple `+R` buttons) through their row's testid: `page.getByTestId("field-row-gender").getByRole("button", { name: "+R" })`
- When asserting on text that also appears in hidden `<option>` elements, prefer `getByRole("cell", ...)` or scope to the results container via testid to avoid strict mode violations
- Assert on what the user would actually see (displayed labels, n counts) — not raw API values
- Keep tests independent: each test navigates to the page fresh
- Seed data names are stable (`Brand Tracker`, `Wave 1`, `Brand Awareness`, etc.) — reference them directly

---

## Storybook Accessibility (a11y)

Every UI component must have a Storybook story. Every story must pass the
`addon-a11y` accessibility checks before the component is considered done.

### Running a11y checks

```bash
just storybook   # open Storybook at localhost:6006
```

Select a story, open the **Accessibility** panel at the bottom. All rules
must show green. Violations block merging.

### What counts as passing

- Zero violations in the **Violations** tab
- Incomplete checks (amber) must be manually reviewed and confirmed not
  applicable — add a comment in the story if dismissing one

### Writing stories for new components

Every new shadcn component added to `src/components/ui/` requires a story:

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Select } from "./select"

const meta = {
  component: Select,
  // Wrap in ThemeProvider so dark mode tokens resolve correctly
  decorators: [(Story) => <Story />],
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

// Cover the states that are most likely to have contrast issues
export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
```

Cover at minimum: default state, disabled state, and any error/active states
that change colour. These are the states most likely to introduce contrast
violations.

### Accessibility rule that always applies

Do not use `text-primary` as a text colour — see
`docs/patterns/design-system.md`. The a11y panel will catch this on light
backgrounds but may not catch it on all surfaces. Follow the token rules
proactively.

## Test Data

Use fixtures for frequently reused test data. Define them in `conftest.py` with `scope="function"` so they are rolled back with the transaction.

```python
@pytest_asyncio.fixture
async def sample_dataset(db):
    dataset = Dataset(name="test-dataset", description="For testing")
    db.add(dataset)
    await db.flush()  # assigns ID without committing
    return dataset
```
