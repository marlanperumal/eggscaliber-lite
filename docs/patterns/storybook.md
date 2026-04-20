# Storybook Patterns

Companion to `docs/patterns/frontend.md`. Covers async data, error states, and
mock strategy in Storybook 10 with `@storybook/nextjs-vite`.

## Stories vs Tests — what goes where

| Concern | Where |
|---------|-------|
| Visual states (loading, empty, error, success) | `.stories.tsx` |
| Interaction demos (hover, open menu, fill form) | `.stories.tsx` `play()` |
| Behaviour assertions (`expect(...)`) | `.test.tsx` with Vitest |
| Accessibility (a11y addon) | `.stories.tsx` — a11y must pass on every story |

Stories are for **showing** states; tests are for **asserting** outcomes. Do not
write `expect(...)` calls inside `play()` functions.

## Async Data Fetching — use props, not a real API

Stories run without a backend. Represent async states by defining explicit story
variants that pass the right props directly. Never call `api.GET(...)` inside a
story component.

```tsx
// ✅ Three variants covering all async states
export const Loading: Story = { args: { isLoading: true } }
export const Success: Story = { args: { data: mockData } }
export const Error: Story = { args: { error: "Failed to load — please retry." } }
```

For components that own their own data fetching (e.g. a panel that calls the API
internally), wrap the component with a mock via `parameters.msw` (MSW addon) —
see **Props mock vs MSW** below.

## Error State Coverage

Every component that can display an error must have an `Error` story variant.
Pair it with a `Success` variant so reviewers can compare both states side-by-side.

Name the variant `Error`, `ErrorState`, or `WithError` — use one name consistently
within a component family.

## Props mock vs MSW

| Situation | Mock strategy |
|-----------|---------------|
| Single, isolated UI primitive (`Button`, `Badge`, `Textarea`) | Props only — no network |
| Feature component with internal API calls (`QueryBuilderPanel`, `ReconciliationRow`) | `parameters.msw` from `msw-storybook-addon` |
| Component that receives API data as props from a parent | Props mock on the story, MSW on the parent's story |

## Interaction demos with `play()`

Use `play()` to demonstrate UI interactions — not to assert outcomes:

```tsx
import { userEvent, within } from "@storybook/test"

// ✅ demo: show the menu opening
export const MenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Options" }))
  },
}

// ❌ don't assert in stories — use .test.tsx
export const BadExample: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Submit" }))
    expect(canvas.getByText("Success")).toBeInTheDocument()  // belongs in .test.tsx
  },
}
```

## Accessibility

Every story must pass the a11y addon check. If a story inherits a violation from
a parent layout (e.g. missing skip-link), disable only the specific rule:

```tsx
export const Default: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "skip-link", enabled: false }] } },
  },
}
```

Never disable a11y globally (`parameters: { a11y: { disable: true } }`).
