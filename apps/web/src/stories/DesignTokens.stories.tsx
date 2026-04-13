import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Design System/Tokens",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type TokenGroup = { heading: string; tokens: { name: string; var: string }[] }

const tokenGroups: TokenGroup[] = [
  {
    heading: "Surface",
    tokens: [
      { name: "Background", var: "--background" },
      { name: "Foreground", var: "--foreground" },
    ],
  },
  {
    heading: "Card",
    tokens: [
      { name: "Card", var: "--card" },
      { name: "Card Foreground", var: "--card-foreground" },
    ],
  },
  {
    heading: "Popover",
    tokens: [
      { name: "Popover", var: "--popover" },
      { name: "Popover Foreground", var: "--popover-foreground" },
    ],
  },
  {
    heading: "Primary",
    tokens: [
      { name: "Primary", var: "--primary" },
      { name: "Primary Foreground", var: "--primary-foreground" },
    ],
  },
  {
    heading: "Secondary",
    tokens: [
      { name: "Secondary", var: "--secondary" },
      { name: "Secondary Foreground", var: "--secondary-foreground" },
    ],
  },
  {
    heading: "Muted",
    tokens: [
      { name: "Muted", var: "--muted" },
      { name: "Muted Foreground", var: "--muted-foreground" },
    ],
  },
  {
    heading: "Accent",
    tokens: [
      { name: "Accent", var: "--accent" },
      { name: "Accent Foreground", var: "--accent-foreground" },
    ],
  },
  {
    heading: "Destructive",
    tokens: [
      { name: "Destructive", var: "--destructive" },
      { name: "Destructive Foreground", var: "--destructive-foreground" },
    ],
  },
  {
    heading: "Chrome",
    tokens: [
      { name: "Border", var: "--border" },
      { name: "Input", var: "--input" },
      { name: "Ring", var: "--ring" },
      { name: "Nav", var: "--nav" },
    ],
  },
]

export const ColourPalette: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Colour Palette</h2>
      {tokenGroups.map(({ heading, tokens }) => (
        <div key={heading}>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {heading}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tokens.map(({ name, var: v }) => (
              <div key={v} className="flex items-center gap-3">
                <div
                  className="h-10 w-10 shrink-0 rounded-md border"
                  style={{ backgroundColor: `var(${v})` }}
                />
                <div>
                  <p className="text-sm font-medium leading-none">{name}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{v}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
}

export const Typography: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <h2 className="mb-4 text-xl font-semibold">Typography</h2>
      <h1 className="text-4xl font-bold">Heading 1 — text-4xl font-bold</h1>
      <h2 className="text-3xl font-semibold">Heading 2 — text-3xl font-semibold</h2>
      <h3 className="text-2xl font-semibold">Heading 3 — text-2xl font-semibold</h3>
      <h4 className="text-xl font-medium">Heading 4 — text-xl font-medium</h4>
      <p className="text-base">
        Body text — text-base. The quick brown fox jumps over the lazy dog.
      </p>
      <p className="text-sm text-muted-foreground">Muted text — text-sm text-muted-foreground.</p>
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">code snippet</code>
    </div>
  ),
}
