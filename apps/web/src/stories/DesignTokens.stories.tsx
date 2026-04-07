import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Design System/Tokens",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

const colours = [
  { name: "Primary", var: "--primary" },
  { name: "Primary Foreground", var: "--primary-foreground" },
  { name: "Secondary", var: "--secondary" },
  { name: "Secondary Foreground", var: "--secondary-foreground" },
  { name: "Destructive", var: "--destructive" },
  { name: "Muted", var: "--muted" },
  { name: "Muted Foreground", var: "--muted-foreground" },
  { name: "Accent", var: "--accent" },
  { name: "Background", var: "--background" },
  { name: "Foreground", var: "--foreground" },
  { name: "Border", var: "--border" },
  { name: "Card", var: "--card" },
]

export const ColourPalette: StoryObj = {
  render: () => (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Colour Palette</h2>
      <div className="grid grid-cols-3 gap-4">
        {colours.map(({ name, var: v }) => (
          <div key={v} className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-md border"
              style={{ backgroundColor: `hsl(var(${v}))` }}
            />
            <div>
              <p className="text-sm font-medium">{name}</p>
              <p className="font-mono text-xs text-muted-foreground">{v}</p>
            </div>
          </div>
        ))}
      </div>
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
