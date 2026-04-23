# Eggscaliber-Lite Roadmap

Sub-projects, each with its own spec → plan → implementation cycle.

| # | Sub-project | Status | Spec | Plan |
|---|---|---|---|---|
| 1 | Project Foundation | ✅ Complete | [spec](superpowers/specs/2026-04-07-project-foundation-design.md) | [plan](superpowers/plans/2026-04-07-project-foundation.md) |
| 2 | Nomenclature & Data Model | ✅ Complete | [spec](superpowers/specs/2026-04-10-nomenclature-data-model-design.md) | [plan](superpowers/plans/2026-04-10-nomenclature-data-model.md) |
| 3 | Analytics Engine | ✅ Complete | — | [plan](superpowers/plans/2026-04-10-analytics-engine.md) |
| 4 | UX Polish | ✅ Complete | — | [plan](superpowers/plans/2026-04-15-ux-polish-iteration-3.md) |
| 5 | Drag & Drop | ✅ Complete | — | — |
| 6 | Data Ingestion & Metadata Editor | ✅ Complete | [spec](superpowers/specs/2026-04-16-data-ingestion-metadata-editor-design.md) | [plan](superpowers/plans/2026-04-17-data-ingestion-metadata-editor.md) |
| 7 | AI Interface | ✅ Complete | [spec](superpowers/specs/2026-04-19-ai-interface-design.md) | [plan](superpowers/plans/2026-04-19-ai-interface.md) |
| 8 | Full AuthN & AuthZ | ✅ Complete | [spec](superpowers/specs/2026-04-20-authn-authz-design.md) | [plan](superpowers/plans/2026-04-20-authn-authz-phase1.md) |
| 9 | MCP Interface | ✅ Complete | [spec](superpowers/specs/2026-04-22-mcp-interface-design.md) | [plan](superpowers/plans/2026-04-22-mcp-interface-gap-fill.md) |
| 10 | Verify Existing Functionality | 🔜 Next | — | — |
| 11 | Design System V2 & Mobile | ⏳ Planned | — | — |
| 12 | Platform Hardening | ⏳ Planned | — | — |
| 13 | Analytics V2 | ⏳ Planned | — | — |
| 14 | Ingestion V2 | ⏳ Planned | — | — |
| 15 | MCP Interface V2 | ⏳ Planned | — | — |
| 16 | AI Interface V2 | ⏳ Planned | — | — |
| 17 | External Data Sources | ⏳ Planned | — | — |

---

## Sub-project Summaries

### 1 — Project Foundation ✅
Scaffold the monorepo, configure all services, set up MCPs, establish design system foundations (tokens + 5 atomic components), CI pipeline, justfile.  
**Done when:** Hello-world running on all services, design system deployed to Chromatic, CI green.

### 2 — Nomenclature & Data Model ✅
Land on the naming hierarchy for data entities, define all field types (numeric, ordinal, multi-response variants), design the Postgres schema, establish the migration system.  
**Done when:** Schema finalised, seed data representing 2–3 real dataset structures, OpenAPI types generated.

### 3 — Analytics Engine ✅
Cross-tab and trending queries against seed data, table + chart output components, query builder UI, working prototype deployed and accessible via feature flag.  
**Done when:** End-to-end — select dataset → configure analysis → view table + chart — deployed to Vercel/Render.

### 4 — UX Polish ✅

Bringing the frontend from unstyled prototype to a polished, usable product:

- **Iteration 0 — Design system** ✅ — Brand palette, typography scale, spacing/radius tokens defined in CSS variables; shadcn components installed and wired to tokens
- **Iteration 1 — App shell & panel chrome** ✅ — Top nav bar (logo, links, user avatar), visible panel borders/backgrounds/headers, page frame
- **Iteration 2 — Query builder controls** ✅ — Mode mini-cards, shadcn Select with breadcrumb hierarchy, type-circle field chips, zone empty/populated states, stacked/nested toggle, measure matrix
- **Iteration 3 — Empty & loading states** ✅ — Illustrated empty states (SVG + title + copy) for field tree, query zones, and results panel; skeleton + spinner loading states
- **Iteration 4 — Home page** ✅ — Minimal landing with CTA or redirect to `/analytics`

**Done when:** All iterations shipped and analytics engine feels polished end-to-end.

---

### 5 — Drag & Drop ✅
Drag fields from the field tree into the Rows, Columns, and Breakdown zones. Drag to reorder fields within a zone. Remove by dragging out.  
**Done when:** Fields can be dragged from the tree into all zones; chips within a zone can be reordered by drag; +R/+C buttons remain as a keyboard-accessible fallback.

---

### 6 — Data Ingestion & Metadata Editor ✅
File upload (CSV, SPSS), metadata GUI (field types, display names, multi-response config), template from previous dataset instance. Analytics engine serves as the immediate testbed.  
**Done when:** Upload a real dataset → configure metadata → query it in the analytics engine.

### 7 — AI Interface ✅
NL query → PydanticAI identifies relevant data sources → executes queries in parallel → streams structured results (text + tables + charts) to frontend via Vercel AI SDK. Responses grounded in real data only — no LLM world knowledge.  
**Done when:** Ask "how has X changed over 5 years?" → receive a cited, data-grounded response with tables and charts.

---

### 8 — Full AuthN & AuthZ

- **Phase 1 — Identity Stack** ✅ Complete — Clerk wired end-to-end: sign-in/sign-up/account UI, Next.js middleware route protection, FastAPI JWT verification, webhook-synced `users`/`organisations`/`org_memberships` tables, org creation and invite flows via Clerk's built-in UI.
- **Phase 2 — Access Control** ✅ Complete — `groups` table, `group_memberships`, `group_packages`, `org_subscriptions`, `package_collections`; analytics and package endpoints filter by group membership; super-user subscription management UI (`/admin`); org groups management UI (`/org/groups`).

**Done when:** A user can register, join an org, be assigned to a group, and access only the packages that group is entitled to — end-to-end in production.

---

### 9 — MCP Interface ✅
External MCP server at `/mcp/external` authenticated via Personal Access Tokens (PATs), exposing 7 hand-crafted tools (browse + analyse) that reuse the existing service layer and inherit the user's group-based package entitlements. PAT management UI on `/account` with per-token Claude Code and Claude Desktop config snippets.

- **Auth-aware MCP tools** ✅ — PATs hashed (SHA-256) and resolved via Starlette middleware; access control piggybacks on the sub-project 8 entitlement layer
- **Analytics tools** ✅ — `describe_field_tree`, `run_crosstab`, `run_trend`
- **Dataset & package browsing** ✅ — `list_packages`, `list_collections`, `list_datasets`, `describe_dataset`
- Streaming results — deferred to V2 (tools return structured JSON)
- PAT expiry / per-token scoping / OAuth — deferred to V2

**Done when:** A user can generate a PAT on `/account`, paste the config snippet into Claude Desktop/Code, and run a full analytics query against their entitled packages.

---

### 10 — Verify Existing Functionality 🔜

Audit the shipped sub-projects against their own specs. Each item below was either declared in-scope in a spec but may not have landed, or was deferred to a sub-project that has since been marked complete without explicit confirmation.

**Approach — hybrid fix/spin-out:**
- Verify each item in code. Add a backend test where cheap (pytest for filtering/entitlements/webhook/token-hash logic) or a targeted unit/Storybook check for UI-shape items. Skip tests where a full E2E harness would be disproportionate.
- If broken and <1 hour of work: fix inline (failing test first where practical), commit.
- If broken and larger: file a concrete follow-up plan (or fold into an existing planned sub-project like Ingestion V2 / AI V2) and mark the item 📋 spun-out.
- Regression tests land in the normal pytest/vitest suites — no separate audit harness.

**Phase 0 — Triage stale deferrals** (do first, before the main audit):
- Clerk `useUser()` wired into top-nav avatar (real profile image, not placeholder)
- AI conversation persistence (multi-turn history survives page reload)
- AI per-user/org access control (AI tools honour group entitlements)
- Enhanced home page — originally "UX Polish Iteration 4"

Each classified as ✅ verified / 🔧 fix-inline / 📋 spin-out before Phase 1 begins.

**Phase 1 — Sub-project 8 (AuthZ):**
- **Package filtering** — all data endpoints (`/packages`, `/analytics`, `/ai/chat`) filter by package visibility and active org subscription dates
- **Default group auto-assignment** — `organizationMembership.created` webhook adds new members to the org's Default group

**Phase 2 — Sub-project 6 (Ingestion):**
- **Virtual list pagination** — reconciliation step uses cursor-based API + `@tanstack/react-virtual` under "Show all"
- **Bulk reconciliation** — `POST /datasets/upload/{id}/reconcile/bulk` exists and the select-all flow hits it
- **Deep field-group nesting** — tree supports 4+ levels with drag-drop intact

**Phase 3 — Sub-project 3 (Analytics):**
- **Field tree hygiene** — identifier and weight fields excluded from the tree
- **Weighted measure picker** — only weight fields appear in the Weighted-mode dropdown
- **Multi-response expansion** — multi_response fields render as expandable branches
- **Filter logic** — OR within a field, AND across fields

**Phase 4 — Sub-project 7 (AI):**
- **Agent system prompt** — responses cite dataset names and return multiple structured parts
- **"Open in Analytics"** — button constructs a valid nuqs URL that loads the query
- **SSE stream shape** — `/ai/chat` emits text deltas + structured result parts + finish events

**Phase 5 — Sub-project 9 (MCP):**
- **Token hash verification** — SHA-256 compare; invalid/revoked tokens rejected
- **Group entitlement filtering** — tool responses restricted to the PAT owner's entitled packages
- **`last_used_at` update** — timestamp advances asynchronously on each tool call

**Done when:** Each item above is either ✅ verified (with a test where practical) or moved to a follow-up sub-project with a concrete plan.

---

### 11 — Design System V2 & Mobile ⏳

Polish items deferred from the Design System and UX Polish specs.

- **Touch support for drag & drop** — mobile-friendly field dragging
- **Mobile-optimised layouts** — real responsive design beyond hiding columns at `md`
- **Home page animations** — scroll-triggered micro-interactions
- **Dark-mode chart palette** — Recharts colours tuned for dark tokens
- **Animation & transition tokens** — formal tokens for easing/duration
- **Font customisation hook** — honour `ThemeConfig` font override
- **On-demand shadcn components** — `dialog`, `popover`, `toast`, `sheet` as needed

**Done when:** The app is genuinely usable on a phone and the design system carries a full motion + theming vocabulary.

---

### 12 — Platform Hardening ⏳

Cost and observability guardrails that were explicitly deferred from Project Foundation and the MCP spec.

- **Rate limiting on AI endpoints** — per-user/org throttling on `/ai/chat` to cap LLM spend
- **Rate limiting per PAT** — per-token throttling on `/mcp/external`
- **OpenTelemetry tracing** — distributed traces for analytics queries and LLM tool calls; dataset/field-level usage metrics

**Done when:** Runaway AI or MCP usage is capped before it becomes a bill; we can answer "which datasets are hot?" and "where is latency spent?" from traces.

---

### 13 — Analytics V2 ⏳

Analytics features explicitly pushed out of Sub-project 3, ordered by user value.

- **Query export** — CSV download of results; PNG/PDF export of charts
- **Saved queries** — persist query configurations; new `saved_queries` table + endpoints
- **Advanced chart types** — histogram, box plot, scatter, heatmap (architecture already accommodates `chartType` + `value_field`)
- **Weighted quantiles & histogram binning** — statistical ops for numeric fields
- **SQL push-down aggregation** — move aggregation from Python to SQL for scale

**Done when:** Analysts can export, revisit, and visualise numeric distributions without leaving the app; queries scale past seed-data volumes.

---

### 14 — Ingestion V2 ⏳

Deferred from Sub-project 6.

- **Dataset versioning & post-commit edit** — mutate field definitions without losing query reproducibility
- **API-based ingestion** — programmatic upload endpoint for ETL/batch jobs
- **Dataset download/export** — wire up the placeholder button on the datasets page
- **SPSS edge cases** — split files, system missing value codes
- **Concurrent uploads per user** — relax single-session constraint
- **Drag-handle reordering for field levels** — replace integer sort-order input in the metadata editor

**Done when:** Enterprise/automation flows can ingest, and analysts can correct metadata without re-uploading.

---

### 15 — MCP Interface V2 ⏳

V2 items called out in the MCP spec.

- **OAuth 2.0 / PKCE flow** — browser-based auth for Claude Desktop, alternative to manual PAT paste
- **Per-token package scoping** — restrict a PAT to a subset of the owner's entitlements
- **PAT expiry dates** — TTL on tokens with a rotation flow
- **Streaming tool results** — SSE-style progressive output for long-running analytics

**Done when:** Integrators can issue narrowly-scoped, expiring credentials and connect Claude Desktop with no manual token handling.

---

### 16 — AI Interface V2 ⏳

Deferred from Sub-project 7.

- **File & image inputs** — upload a chart or document as part of a prompt
- **Agent memory across turns** — remember user preferences and prior dataset context beyond the message array

**Done when:** AI interactions feel persistent and multimodal rather than single-shot text.

---

### 17 — External Data Sources ⏳

- **ExternalTableWorker** — generalise the analytics worker abstraction so queries can run against arbitrary Postgres tables, not just JSONB response payloads

**Done when:** A new dataset backed by an external table can be registered and queried through the same UI and MCP tools as native datasets.
