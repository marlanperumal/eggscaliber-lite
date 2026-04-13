import type { ThemeConfig } from "@/lib/theme"

// To white-label this deployment, edit baseHue and baseChroma.
// All scale steps, semantic tokens, hover states, and shadows derive from them.
// See docs/patterns/design-system.md for the full palette and token reference.
export const themeConfig: ThemeConfig = {
  palette: {
    baseHue: 14, // 0–360: hue angle — 14 = crimson/rose
    baseChroma: 0.223, // 0–0.37: saturation — 0.223 = vivid, saturated
    hueShift: 14, // stored for documentation; per-step hue offsets are fixed in SCALE_STEPS
  },
  brand: {
    name: "Eggscaliber",
    logoUrl: null, // null = text logo; set to '/logo.svg' to use an image
  },
  radius: "0.5rem", // maps to --radius (8px default)
}
