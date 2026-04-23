# Eggscaliber-Lite Roadmap

Five sub-projects, each with its own spec → plan → implementation cycle.

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
