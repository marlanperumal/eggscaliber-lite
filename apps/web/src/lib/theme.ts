export interface PaletteConfig {
  baseHue: number
  baseChroma: number
  hueShift: number
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
      // Clamp to [0, 360) keeping hue as non-negative for CSS compatibility
      const hue = Math.max(0, rawHue % 360)
      return [step, `oklch(${L} ${(C * cMult).toFixed(3)} ${hue}deg)`]
    }),
  )
}

export function generateThemeCSS(config: ThemeConfig): string {
  const s = generateOklchScale(config.palette)

  return `
    :root {
      --background: ${s[50]};
      --foreground: ${s[950]};
      --card: #ffffff;
      --card-foreground: ${s[950]};
      --primary: ${s[600]};
      --primary-foreground: #ffffff;
      --muted: ${s[50]};
      --muted-foreground: ${s[800]};
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
      --primary: ${s[600]};
      --primary-foreground: #ffffff;
      --muted: ${s[900]};
      --muted-foreground: ${s[300]};
      --border: ${s[800]};
      --input: ${s[800]};
      --ring: ${s[400]};
      --nav: ${s[950]};
      --radius: ${config.radius};
    }
  `.trim()
}
