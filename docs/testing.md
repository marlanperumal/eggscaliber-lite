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
| PostHog | Mock `@posthog/next` hooks |

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

Use `@testing-library/react` and query by role or visible text — not by class names or test IDs:

```typescript
import { render, screen } from '@testing-library/react'

it('renders the heading', () => {
  render(<Page />)
  expect(screen.getByRole('heading', { name: /eggscaliber-lite/i })).toBeInTheDocument()
})
```

Components that use nuqs hooks will need those hooks mocked as above. Components that use `NuqsAdapter` context can be wrapped with it in the test render if needed.

### Running tests

```bash
just test-web    # vitest only
just test        # all tests (pytest + vitest)
```

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
