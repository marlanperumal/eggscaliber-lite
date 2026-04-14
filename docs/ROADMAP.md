# Eggscaliber-Lite Roadmap

Five sub-projects, each with its own spec → plan → implementation cycle.

| # | Sub-project | Status | Spec | Plan |
|---|---|---|---|---|
| 1 | Project Foundation | ✅ Complete | [spec](superpowers/specs/2026-04-07-project-foundation-design.md) | [plan](superpowers/plans/2026-04-07-project-foundation.md) |
| 2 | Nomenclature & Data Model | ✅ Complete | [spec](superpowers/specs/2026-04-10-nomenclature-data-model-design.md) | [plan](superpowers/plans/2026-04-10-nomenclature-data-model.md) |
| 3 | Analytics Engine | ✅ Complete | — | [plan](superpowers/plans/2026-04-10-analytics-engine.md) |
| 4 | UX Polish | 🔜 Next | — | — |
| 5 | Data Ingestion & Metadata Editor | ⏳ Pending | — | — |
| 6 | AI Interface | ⏳ Pending | — | — |

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

### 4 — UX Polish ⏳

Bringing the frontend from unstyled prototype to a polished, usable product:

- **Iteration 0 — Design system** ✅ — Brand palette, typography scale, spacing/radius tokens defined in CSS variables; shadcn components installed and wired to tokens
- **Iteration 1 — App shell & panel chrome** ✅ — Top nav bar (logo, links, user avatar), visible panel borders/backgrounds/headers, page frame
- **Iteration 2 — Query builder controls** — Styled tabs (Crosstab/Trending), proper dataset Select, pill/toggle button groups for measures
- **Iteration 3 — Empty & loading states** — Icon + instructional copy for field tree, query zones, and results panel; loading skeletons
- **Iteration 4 — Home page** — Minimal landing with CTA or redirect to `/analytics`

**Done when:** All iterations shipped and analytics engine feels polished end-to-end.

---

### 5 — Data Ingestion & Metadata Editor ⏳
File upload (CSV, SPSS), metadata GUI (field types, display names, multi-response config), template from previous dataset instance. Analytics engine serves as the immediate testbed.  
**Done when:** Upload a real dataset → configure metadata → query it in the analytics engine.

### 6 — AI Interface ⏳
NL query → PydanticAI identifies relevant data sources → executes queries in parallel → streams structured results (text + tables + charts) to frontend via Vercel AI SDK. Responses grounded in real data only — no LLM world knowledge.  
**Done when:** Ask "how has X changed over 5 years?" → receive a cited, data-grounded response with tables and charts.
