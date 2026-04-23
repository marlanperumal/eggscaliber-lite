# Weighted Measure Field Picker — Follow-up from Sub-project 10

**Surfaced by:** `docs/superpowers/plans/2026-04-23-verify-existing-functionality.md` Task 11
**Current state:** The analytics query builder has a 3x3 measure matrix (Count/Weighted/Value × N/% Col/% Row) that sets `measure.type` and `measure.display`, but no UI surface to pick `measure.field_key`. The backend accepts `measure.field_key` on `/api/v1/analytics/crosstab` and exposes `/api/v1/datasets/{id}/weight-fields` returning only weight-typed fields; `InlineResult` can hydrate `measure.field_key` from the URL (`mf` param), but there is no way for a user to select it in the panel.
**Gap:** When the user picks Weighted (or Value), they cannot choose which weight/value field to use. A dropdown restricted to weight-typed fields (via `/weight-fields` endpoint) needs to appear under the measure matrix whenever `measure.type === "weighted"` (and a similar numeric-field dropdown for `value_field`).
**Estimated effort:** ~2h — UI design for the conditional dropdown, wiring to `/weight-fields` endpoint, state handling, a11y, Storybook story, vitest coverage for "only weight-typed options render".
**Next step:** brainstorm the UX (inline dropdown vs. expanding the matrix) then plan directly.

---
