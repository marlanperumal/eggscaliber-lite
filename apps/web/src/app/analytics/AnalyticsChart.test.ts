import { describe, expect, it } from "vitest"
import { resolveColLabel, resolveLevel } from "@/components/analytics/AnalyticsChart"

describe("resolveLevel", () => {
  it("returns the human label when found in levelLabels", () => {
    const labels = { gender: { male: "Male", female: "Female" } }
    expect(resolveLevel("gender", "male", labels)).toBe("Male")
    expect(resolveLevel("gender", "female", labels)).toBe("Female")
  })

  it("falls back to the raw code when the field key is absent from levelLabels", () => {
    const labels = { brand: { good: "Good" } }
    expect(resolveLevel("gender", "male", labels)).toBe("male")
  })

  it("falls back to the raw code when the level code is absent from the field map", () => {
    const labels = { gender: { male: "Male" } }
    expect(resolveLevel("gender", "unknown_code", labels)).toBe("unknown_code")
  })

  it("falls back to the raw code when levelLabels is undefined", () => {
    expect(resolveLevel("gender", "male", undefined)).toBe("male")
  })
})

describe("resolveColLabel", () => {
  it("returns 'Total' unchanged for the Total key", () => {
    expect(resolveColLabel("Total", undefined, undefined)).toBe("Total")
    expect(resolveColLabel("Total", [], {})).toBe("Total")
  })

  it("returns the human label when found via colFields lookup", () => {
    const colFields = [{ field_key: "gender", display_name: "Gender" }]
    const labels = { gender: { male: "Male", female: "Female" } }
    expect(resolveColLabel("male", colFields, labels)).toBe("Male")
    expect(resolveColLabel("female", colFields, labels)).toBe("Female")
  })

  it("returns the raw key when the level code is not in any colField's label map", () => {
    const colFields = [{ field_key: "gender", display_name: "Gender" }]
    const labels = { gender: { male: "Male" } }
    expect(resolveColLabel("unknown_code", colFields, labels)).toBe("unknown_code")
  })

  it("returns the raw key when colFields is undefined", () => {
    const labels = { gender: { male: "Male" } }
    expect(resolveColLabel("male", undefined, labels)).toBe("male")
  })

  it("returns the raw key when colFields is empty", () => {
    const labels = { gender: { male: "Male" } }
    expect(resolveColLabel("male", [], labels)).toBe("male")
  })

  it("resolves from the first matching colField when multiple colFields are present", () => {
    const colFields = [
      { field_key: "gender", display_name: "Gender" },
      { field_key: "region", display_name: "Region" },
    ]
    const labels = {
      gender: { male: "Male" },
      region: { north: "North" },
    }
    expect(resolveColLabel("north", colFields, labels)).toBe("North")
    expect(resolveColLabel("male", colFields, labels)).toBe("Male")
  })
})
