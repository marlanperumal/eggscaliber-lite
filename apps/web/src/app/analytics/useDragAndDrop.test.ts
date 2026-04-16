import { describe, expect, it } from "vitest"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { applyDragEnd } from "./useDragAndDrop"

function makeQuery(overrides: Partial<QueryConfig> = {}): QueryConfig {
  return { ...DEFAULT_QUERY, ...overrides }
}

describe("applyDragEnd", () => {
  // ── From field tree ──────────────────────────────────────────────────────

  it("field drag into rows zone adds field to rows", () => {
    const q = makeQuery()
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-rows",
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].field_key).toBe("brand_awareness")
  })

  it("field drag into columns zone adds field to columns", () => {
    const q = makeQuery()
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "gender",
      displayName: "Gender",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-columns",
    })
    expect(result.columns).toHaveLength(1)
    expect(result.columns[0].field_key).toBe("gender")
  })

  it("field drag into breakdown zone sets breakdown", () => {
    const q = makeQuery()
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "age_group",
      displayName: "Age Group",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-breakdown",
    })
    expect(result.breakdown?.field_key).toBe("age_group")
  })

  it("field drag into breakdown zone replaces existing breakdown", () => {
    const q = makeQuery({ breakdown: { field_key: "gender", display_name: "Gender" } })
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "age_group",
      displayName: "Age Group",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-breakdown",
    })
    expect(result.breakdown?.field_key).toBe("age_group")
  })

  it("field drag does not duplicate if already in rows", () => {
    const q = makeQuery({
      rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    })
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: null,
      overId: "zone-rows",
    })
    expect(result.rows).toHaveLength(1)
  })

  it("field drag with null overId does nothing", () => {
    const q = makeQuery()
    const result = applyDragEnd(q, {
      activeType: "field",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: null,
      overId: null,
    })
    expect(result).toEqual(q)
  })

  // ── Chip drag — remove ───────────────────────────────────────────────────

  it("chip drag outside any zone removes it from source zone only", () => {
    const q = makeQuery({
      rows: [
        { field_key: "brand_awareness", display_name: "Brand Awareness" },
        { field_key: "gender", display_name: "Gender" },
      ],
      columns: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    })
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: "rows",
      overId: null,
    })
    expect(result.rows.map((r) => r.field_key)).toEqual(["gender"])
    expect(result.columns).toHaveLength(1) // unchanged
  })

  it("chip drag outside any zone removes breakdown chip", () => {
    const q = makeQuery({ breakdown: { field_key: "gender", display_name: "Gender" } })
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "gender",
      displayName: "Gender",
      fieldType: "categorical",
      sourceZone: "breakdown",
      overId: null,
    })
    expect(result.breakdown).toBeNull()
  })

  // ── Chip drag — move between zones ──────────────────────────────────────

  it("chip dragged from rows to columns zone moves it", () => {
    const q = makeQuery({
      rows: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
    })
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: "rows",
      overId: "zone-columns",
    })
    expect(result.rows).toHaveLength(0)
    expect(result.columns[0].field_key).toBe("brand_awareness")
  })

  // ── Chip drag — reorder within zone ─────────────────────────────────────

  it("chip dragged onto another chip in same zone reorders", () => {
    const q = makeQuery({
      rows: [
        { field_key: "brand_awareness", display_name: "Brand Awareness" },
        { field_key: "gender", display_name: "Gender" },
        { field_key: "age_group", display_name: "Age Group" },
      ],
    })
    // Move brand_awareness (index 0) after age_group (index 2)
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "brand_awareness",
      displayName: "Brand Awareness",
      fieldType: "categorical",
      sourceZone: "rows",
      overId: "chip-rows-age_group",
    })
    expect(result.rows.map((r) => r.field_key)).toEqual(["gender", "age_group", "brand_awareness"])
  })

  it("chip dropped on zone-rows id (not a chip) keeps order unchanged", () => {
    const q = makeQuery({
      rows: [
        { field_key: "brand_awareness", display_name: "Brand Awareness" },
        { field_key: "gender", display_name: "Gender" },
      ],
    })
    const result = applyDragEnd(q, {
      activeType: "chip",
      fieldKey: "gender",
      displayName: "Gender",
      fieldType: "categorical",
      sourceZone: "rows",
      overId: "zone-rows",
    })
    // No change expected — same zone, no specific chip target
    expect(result.rows.map((r) => r.field_key)).toEqual(["brand_awareness", "gender"])
  })
})
