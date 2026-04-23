# Multi-Response Field Expansion in Field Tree — Follow-up from Sub-project 10

**Surfaced by:** `docs/superpowers/plans/2026-04-23-verify-existing-functionality.md` Task 12
**Current state:** The analytics field tree (`apps/web/src/app/analytics/FieldTreePanel.tsx`) renders groups as expandable branches and fields as flat rows. The backend `FieldTreeFieldOut` schema (`apps/api/src/models/analytics.py`) only carries `{id, field_key, display_name, field_type, sort_order, is_filterable}` — no `options`/`levels`/child nodes. `multi_response` fields exist in the model layer and are handled by the crosstab service (`apply_filters` + `aggregate_stacked`) but surface in the UI as a single row with no ability to drill into individual response options.
**Gap:** Spec says `multi_response` fields should render as expandable branches where each child represents an option/level. That requires (a) extending the backend schema and `analytics_service.get_field_tree` to emit level children for multi_response fields, (b) extending the frontend `FieldTreePanel` to render disclosure chevrons + children for multi_response rows, (c) deciding whether a child option is draggable as its own row/column entry (semantically a pre-filtered version of the parent field) or purely informational.
**Estimated effort:** ~3–4h — schema + service + repo changes, frontend rendering + drag semantics, Storybook + vitest coverage, backend test coverage for the new tree shape.
**Next step:** brainstorm the drag semantics (does dropping an option into Rows create a pre-filtered row, or a filter?), then plan directly.

---
