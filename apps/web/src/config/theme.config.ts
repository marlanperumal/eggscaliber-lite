import type { DestructiveConfig, ThemeConfig } from "@/lib/theme"

// Conventional red — distinct from any blue/steel primary.
// Light: dark red (≈7.8:1 on white). Dark: medium red, works as outline text on dark bg (≈5.7:1)
// and as a filled-button bg with near-black foreground (≈6.3:1).
const RED_DESTRUCTIVE: DestructiveConfig = {
  light: "oklch(0.44 0.22 27deg)",
  dark: "oklch(0.65 0.22 27deg)",
  foregroundDark: "oklch(0.12 0.08 27deg)",
}

export const themes = {
  /**
   * Warm orange/rose palette — the original Eggscaliber brand colour.
   * Destructive defaults to dark violet (visually distinct from the warm primary).
   */
  orange: {
    palette: {
      baseHue: 14, // 0–360: hue angle — 14 = crimson/rose
      baseChroma: 0.223, // 0–0.37: saturation — 0.223 = vivid, saturated
      hueShift: 14, // stored for documentation; per-step hue offsets are fixed in SCALE_STEPS
    },
    brand: {
      name: "Eggscaliber",
      logoUrl: null,
    },
    radius: "0.5rem",
    // destructive omitted → defaults to dark violet in generateThemeCSS
  },

  /**
   * Cool steel-blue palette — muted, professional, high contrast.
   * Destructive uses conventional red (distinct from the blue primary).
   */
  steel: {
    palette: {
      baseHue: 213, // 213 = steel blue
      baseChroma: 0.16, // lower saturation for a cool, muted feel
      hueShift: 12,
    },
    brand: {
      name: "Eggscaliber",
      logoUrl: null,
    },
    radius: "0.5rem",
    destructive: RED_DESTRUCTIVE,
  },
} satisfies Record<string, ThemeConfig>

// ← Change "orange" to "steel" (or any key above) to switch the active colour palette.
export const themeConfig = themes.orange
