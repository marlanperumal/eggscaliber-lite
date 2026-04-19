export interface PaletteConfig {
  baseHue: number
  baseChroma: number
  hueShift: number // stored for documentation; per-step hue offsets are fixed in SCALE_STEPS
}

export interface DestructiveConfig {
  light: string // --destructive in :root (must contrast against #ffffff foreground)
  dark: string // --destructive in .dark (used as both filled-button bg and outline text)
  foregroundDark: string // --destructive-foreground in .dark (text on filled destructive button)
}

export interface ThemeConfig {
  palette: PaletteConfig
  brand: {
    name: string
    logoUrl: string | null
  }
  radius: string
  /**
   * Override the destructive colour tokens. Omit to use the default dark-violet,
   * which is visually distinct from any warm (red/orange/rose) brand primary.
   * For cool-hue palettes (blue, teal, etc.) a conventional red is usually a better choice.
   */
  destructive?: DestructiveConfig
}

// Each entry: [step, lightness, chroma multiplier, hue offset]
// Hue offset: positive = toward orange (highlights), negative = toward magenta (shadows)
const SCALE_STEPS = [
  [50, 0.971, 0.054, +14],
  [100, 0.938, 0.143, +11],
  [200, 0.886, 0.323, +8],
  [300, 0.82, 0.583, +5],
  [400, 0.726, 0.83, +3],
  [500, 0.62, 0.987, +1],
  [600, 0.533, 1.0, 0], // base — primary colour lives here
  [700, 0.44, 0.875, -4],
  [800, 0.345, 0.695, -9],
  [900, 0.265, 0.494, -12],
  [950, 0.19, 0.314, -16],
] as const

type Scale = Record<number, string>

export function generateOklchScale(palette: PaletteConfig): Scale {
  const { baseHue: H, baseChroma: C } = palette
  return Object.fromEntries(
    SCALE_STEPS.map(([step, L, cMult, dH]) => {
      const rawHue = H + dH
      // Wrap to [0, 360) — JS % preserves sign, so add 360 before second modulo
      const hue = ((rawHue % 360) + 360) % 360
      return [step, `oklch(${L} ${(C * cMult).toFixed(3)} ${hue}deg)`]
    }),
  )
}

// Default destructive — dark violet, visually distinct from any warm (red/orange/rose) brand primary.
// Light: very dark violet (11.6:1 on white). Dark: lighter violet used as both filled-button
// background and outline text on dark surfaces (4.7:1 on #1c1c1e). Paired with a near-black
// violet foreground in dark mode so the filled button also passes (5.6:1).
export const DEFAULT_DESTRUCTIVE: DestructiveConfig = {
  light: "oklch(0.37 0.2 295deg)",
  dark: "oklch(0.64 0.2 295deg)",
  foregroundDark: "oklch(0.12 0.08 295deg)",
}

// 8 hue stops evenly distributed around the wheel from the base hue.
const CHART_HUE_OFFSETS = [0, 45, 90, 135, 180, 225, 270, 315] as const

function generateChartTokens(baseHue: number, lightness: number, chroma: number): string {
  return CHART_HUE_OFFSETS.map((offset, i) => {
    const hue = (((baseHue + offset) % 360) + 360) % 360
    return `      --chart-${i + 1}: oklch(${lightness} ${chroma} ${hue}deg);`
  }).join("\n")
}

export function generateThemeCSS(config: ThemeConfig): string {
  const s = generateOklchScale(config.palette)
  const d = config.destructive ?? DEFAULT_DESTRUCTIVE
  const { baseHue } = config.palette

  return `
    :root {
      --background: ${s[50]};
      --foreground: ${s[950]};
      --card: #ffffff;
      --card-foreground: ${s[950]};
      --popover: #ffffff;
      --popover-foreground: ${s[950]};
      --primary: ${s[600]};
      --primary-foreground: #ffffff;
      --secondary: ${s[100]};
      --secondary-foreground: ${s[900]};
      --muted: ${s[50]};
      --muted-foreground: ${s[800]};
      --accent: ${s[100]};
      --accent-foreground: ${s[900]};
      --destructive: ${d.light};
      --destructive-foreground: #ffffff;
      --border: ${s[200]};
      --input: ${s[200]};
      --ring: ${s[600]};
      --nav: ${s[900]};
      --nav-foreground: #ffffff;
      --radius: ${config.radius};
      --field-type-categorical: #6366f1;
      --field-type-multi-response: #0ea5e9;
      --field-type-ordinal: #f59e0b;
      --field-type-numeric: #10b981;
      --zone-rows: #6366f1;
      --zone-columns: #d97706;
      --zone-breakdown: #059669;
      --success: oklch(0.45 0.15 145deg);
      --success-foreground: oklch(0.98 0.01 145deg);
      --success-subtle: oklch(0.95 0.04 145deg);
      --warning: oklch(0.55 0.15 75deg);
      --warning-foreground: oklch(0.35 0.12 75deg);
      --warning-subtle: oklch(0.96 0.04 75deg);
      --info: oklch(0.50 0.18 240deg);
      --info-foreground: oklch(0.20 0.08 240deg);
      --info-subtle: oklch(0.95 0.04 240deg);
${generateChartTokens(baseHue, 0.58, 0.15)}
    }
    .dark {
      --background: ${s[950]};
      --foreground: ${s[50]};
      --card: ${s[900]};
      --card-foreground: ${s[50]};
      --popover: ${s[900]};
      --popover-foreground: ${s[50]};
      --primary: ${s[400]};
      --primary-foreground: ${s[950]};
      --secondary: ${s[800]};
      --secondary-foreground: ${s[100]};
      --muted: ${s[900]};
      --muted-foreground: ${s[300]};
      --accent: ${s[800]};
      --accent-foreground: ${s[100]};
      --destructive: ${d.dark};
      --destructive-foreground: ${d.foregroundDark};
      --border: ${s[800]};
      --input: ${s[800]};
      --ring: ${s[400]};
      --nav: ${s[950]};
      --radius: ${config.radius};
      --success: oklch(0.65 0.15 145deg);
      --success-foreground: oklch(0.15 0.05 145deg);
      --success-subtle: oklch(0.25 0.06 145deg);
      --warning: oklch(0.72 0.14 75deg);
      --warning-foreground: oklch(0.20 0.08 75deg);
      --warning-subtle: oklch(0.25 0.06 75deg);
      --info: oklch(0.65 0.15 240deg);
      --info-foreground: oklch(0.15 0.05 240deg);
      --info-subtle: oklch(0.22 0.06 240deg);
${generateChartTokens(baseHue, 0.72, 0.15)}
    }
  `.trim()
}
