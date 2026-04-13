import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { themes } from "@/config/theme.config"
import type { ThemeConfig } from "@/lib/theme"
import { DEFAULT_DESTRUCTIVE, generateOklchScale } from "@/lib/theme"

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

const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

export const ThemeComparison: StoryObj = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Theme Comparison</h2>
        <p className="text-sm text-muted-foreground mb-3">
          To switch the active palette, edit one line in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            src/config/theme.config.ts
          </code>
          :
        </p>
        <pre className="rounded-md bg-muted px-4 py-3 font-mono text-sm leading-relaxed">
          {`// ← change "orange" to "steel" (or any key in the themes object)\nexport const themeConfig = themes.orange`}
        </pre>
      </div>

      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
        {(Object.entries(themes) as [string, ThemeConfig][]).map(([name, config]) => {
          const scale = generateOklchScale(config.palette)
          const destructive = config.destructive ?? DEFAULT_DESTRUCTIVE
          return (
            <div key={name}>
              <h3 className="mb-4 text-base font-semibold capitalize">{name}</h3>

              {/* Colour scale */}
              <div className="space-y-1.5 mb-6">
                {SCALE_STEPS.map((step) => (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className="h-7 w-14 shrink-0 rounded border"
                      style={{ backgroundColor: scale[step] }}
                    />
                    <span className="w-8 shrink-0 font-mono text-xs text-right text-muted-foreground">
                      {step}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {scale[step]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Destructive */}
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Destructive
                </p>
                {(
                  [
                    ["Light mode", destructive.light],
                    ["Dark mode", destructive.dark],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center gap-3 mb-2">
                    <div
                      className="h-7 w-14 shrink-0 rounded border"
                      style={{ backgroundColor: value }}
                    />
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
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
