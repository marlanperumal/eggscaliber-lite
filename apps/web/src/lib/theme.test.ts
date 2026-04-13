import { describe, expect, test } from "vitest"
import type { ThemeConfig } from "./theme"
import { generateOklchScale, generateThemeCSS } from "./theme"

const testConfig: ThemeConfig = {
  palette: { baseHue: 14, baseChroma: 0.223, hueShift: 14 },
  brand: { name: "Test", logoUrl: null },
  radius: "0.5rem",
}

const directionalConfig: ThemeConfig = {
  palette: { baseHue: 200, baseChroma: 0.223, hueShift: 14 },
  brand: { name: "Test", logoUrl: null },
  radius: "0.5rem",
}

describe("generateOklchScale", () => {
  test("returns all 11 scale steps", () => {
    const scale = generateOklchScale(testConfig.palette)
    expect(
      Object.keys(scale)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950])
  })

  test("s[600] uses base values with no hue offset", () => {
    const scale = generateOklchScale(testConfig.palette)
    expect(scale[600]).toBe("oklch(0.533 0.223 14deg)")
  })

  test("s[50] has higher hue than s[600] (highlight rotates toward orange)", () => {
    const scale = generateOklchScale(directionalConfig.palette)
    const hOf = (s: string) => parseFloat(s.match(/oklch\([\d.]+ [\d.]+ ([\d.]+)deg\)/)?.[1] ?? "")
    expect(hOf(scale[50])).toBeGreaterThan(hOf(scale[600]))
  })

  test("s[950] has lower hue than s[600] (shadow rotates toward magenta)", () => {
    const scale = generateOklchScale(directionalConfig.palette)
    const hOf = (s: string) => parseFloat(s.match(/oklch\([\d.]+ [\d.]+ ([\d.]+)deg\)/)?.[1] ?? "")
    expect(hOf(scale[950])).toBeLessThan(hOf(scale[600]))
  })

  test("hue wraps correctly for baseHue near 0 (does not clamp to 0)", () => {
    const scale = generateOklchScale({ baseHue: 2, baseChroma: 0.2, hueShift: 14 })
    const hOf = (s: string) => parseFloat(s.match(/oklch\([\d.]+ [\d.]+ ([\d.]+)deg\)/)?.[1] ?? "")
    // step 950: rawHue = 2 + (-16) = -14, should wrap to 346, not clamp to 0
    expect(hOf(scale[950])).toBeCloseTo(346, 0)
  })

  test("s[50] has highest lightness, s[950] has lowest", () => {
    const scale = generateOklchScale(testConfig.palette)
    const lOf = (s: string) => parseFloat(s.match(/oklch\(([\d.]+)/)?.[1] ?? "")
    expect(lOf(scale[50])).toBeGreaterThan(lOf(scale[600]))
    expect(lOf(scale[950])).toBeLessThan(lOf(scale[600]))
  })
})

describe("generateThemeCSS", () => {
  test("contains :root and .dark blocks", () => {
    const css = generateThemeCSS(testConfig)
    expect(css).toContain(":root {")
    expect(css).toContain(".dark {")
  })

  test("contains all required custom properties in both blocks", () => {
    const css = generateThemeCSS(testConfig)
    const required = [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--destructive",
      "--destructive-foreground",
      "--border",
      "--input",
      "--ring",
      "--nav",
      "--radius",
    ]
    for (const v of required) {
      const count = (css.match(new RegExp(`${v}:`, "g")) ?? []).length
      expect(count, `${v} should appear twice (once in :root, once in .dark)`).toBe(2)
    }
  })

  test("primary-foreground is #ffffff in :root and a dark scale step in .dark", () => {
    const css = generateThemeCSS(testConfig)
    // Light mode: white text on dark primary (s[600])
    expect(css).toContain("--primary-foreground: #ffffff")
    // Dark mode: primary flips to a lighter step (s[400]), so foreground must be dark (s[950])
    // to maintain contrast on both filled buttons and outline text on dark surfaces.
    const scale = generateOklchScale(testConfig.palette)
    const darkBlock = css.slice(css.indexOf(".dark {"))
    expect(darkBlock).toContain(`--primary-foreground: ${scale[950]}`)
  })

  test("primary uses s[600] in :root and s[400] in .dark for accessible dark-mode outline buttons", () => {
    const css = generateThemeCSS(testConfig)
    const scale = generateOklchScale(testConfig.palette)
    // Light mode: s[600] is dark enough for white text on filled buttons
    const rootBlock = css.slice(0, css.indexOf(".dark {"))
    expect(rootBlock).toContain(`--primary: ${scale[600]}`)
    // Dark mode: s[400] is light enough to pass 4.5:1 as outline text on dark surfaces,
    // while s[950] foreground keeps the filled button readable (6.9:1)
    const darkBlock = css.slice(css.indexOf(".dark {"))
    expect(darkBlock).toContain(`--primary: ${scale[400]}`)
  })

  test("radius is injected from config", () => {
    const css = generateThemeCSS({ ...testConfig, radius: "0.75rem" })
    const matches = css.match(/--radius:\s*0\.75rem/g)
    expect(matches).toHaveLength(2)
  })
})
