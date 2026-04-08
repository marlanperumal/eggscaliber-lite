# Storybook — Next.js Vite Integration

This project uses `@storybook/nextjs-vite` (Vite-based). Do NOT use `@storybook/nextjs` (Webpack-based) — it is incompatible with Next.js 16.

## Running Storybook

```bash
just storybook          # dev server at localhost:6006
cd apps/web && pnpm build-storybook  # production build
```

## Story Format

Use `satisfies Meta<typeof Component>` (Storybook 10 pattern). Import from `@storybook/nextjs-vite`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Button } from "./Button"

const meta = {
  component: Button,
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: "Click me" },
}

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
}
```

## File Placement

Stories live alongside components — not in a separate `stories/` folder:

```
src/components/ui/
  Button.tsx
  Button.stories.tsx    ← colocated
  Button.test.tsx       ← colocated (if needed)
```

## App Router Setup

Add `nextjs.appDirectory: true` globally in `.storybook/preview.ts` (already configured):

```ts
parameters: {
  nextjs: {
    appDirectory: true,
  },
}
```

## Navigation Mocks

For components using `next/navigation` hooks, set segments in the story:

```tsx
export const WithParams: Story = {
  parameters: {
    nextjs: {
      navigation: {
        segments: [['id', '123']],
      },
    },
  },
}
```

## Images & Fonts

- `next/image` works without configuration
- `next/font/google` works automatically
- `next/font/local` requires `staticDirs` mapping in `.storybook/main.ts`
- In CI, set `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` to avoid network calls

## Tailwind CSS

Import globals in `.storybook/preview.ts` (already configured):
```ts
import "../src/app/globals.css"
```

## Server Components (RSC)

Enable experimentally in `.storybook/main.ts`:
```ts
const config: StorybookConfig = {
  features: { experimentalRSC: true },
}
```

Stories wrap automatically in Suspense. Disable per-story with `parameters: { react: { rsc: false } }`.

## Data Fetching Gotcha

Server components that fetch data often import Node-only modules. **Extract the pure UI** into a separate file and write stories against that, not the page file that fetches data.

## Interaction Tests

Use `play` functions to simulate interactions:

```tsx
import { userEvent, within } from "@storybook/nextjs-vite"

export const Clicked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button"))
  },
}
```
