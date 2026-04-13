export interface PaletteConfig {
  baseHue: number
  baseChroma: number
  hueShift: number // stored for documentation; per-step hue offsets are fixed in SCALE_STEPS
}

export interface ThemeConfig {
  palette: PaletteConfig
  brand: {
    name: string
    logoUrl: string | null
  }
  radius: string
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

// Fixed destructive violet — visually distinct from any red/orange brand primary.
// Light: very dark violet (11.6:1 on white). Dark: lighter violet used as both filled-button
// background and outline text on dark surfaces (4.7:1 on #1c1c1e). Paired with a near-black
// violet foreground in dark mode so the filled button also passes (5.6:1).
const DESTRUCTIVE_LIGHT = "oklch(0.37 0.2 295deg)"
const DESTRUCTIVE_DARK = "oklch(0.64 0.2 295deg)"
const DESTRUCTIVE_FOREGROUND_DARK = "oklch(0.12 0.08 295deg)"

export function generateThemeCSS(config: ThemeConfig): string {
  const s = generateOklchScale(config.palette)

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
      --destructive: ${DESTRUCTIVE_LIGHT};
      --destructive-foreground: #ffffff;
      --border: ${s[200]};
      --input: ${s[200]};
      --ring: ${s[600]};
      --nav: ${s[900]};
      --radius: ${config.radius};
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
      --destructive: ${DESTRUCTIVE_DARK};
      --destructive-foreground: ${DESTRUCTIVE_FOREGROUND_DARK};
      --border: ${s[800]};
      --input: ${s[800]};
      --ring: ${s[400]};
      --nav: ${s[950]};
      --radius: ${config.radius};
    }
  `.trim()
}
