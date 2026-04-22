# MCP Interface — Design Spec

**Sub-project 9 of the Eggscaliber-Lite roadmap.**

## Goal

Expose Eggscaliber's analytics and data browsing capabilities as an MCP server so users can query their entitled datasets from Claude Desktop or Claude Code, authenticated with a Personal Access Token (PAT). The existing internal `/mcp` endpoint (auto-generated, dev auth) is left completely unchanged.

**Done when:** A user can generate a PAT in the web app, add the MCP config to Claude Desktop or Claude Code, and run a full analytics query against their entitled packages.

---

## Architecture

Two MCP surfaces on one FastAPI app:

| Endpoint | Audience | Auth | Tools |
|---|---|---|---|
| `/mcp` | Internal dev | Dev bypass / Clerk JWT | Auto-generated from all 5 exposed route tags (unchanged) |
| `/mcp/external` | External users (Claude Desktop/Code) | PAT → CurrentUser | 7 hand-crafted tools |

The external MCP lives in a new `mcp_external/` module. It calls existing service functions directly — no new service layer, no HTTP round-trips. `main.py` mounts `external_mcp_app` at `/mcp/external` and adds its lifespan to `combine_lifespans`.

---

## Data Model

### New table: `api_tokens`

```sql
CREATE TABLE api_tokens (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    token_hash   TEXT NOT NULL UNIQUE,   -- SHA-256 of raw token
    prefix       TEXT NOT NULL,          -- first 8 chars of raw token, shown in UI
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,            -- updated on each successful auth
    revoked_at   TIMESTAMPTZ             -- NULL = active, non-NULL = revoked
);
```

**Token format:** `eggsec_<64 hex chars>` (72 chars total). The `eggsec_` prefix enables secret scanning. The raw token is shown once at creation; only the SHA-256 hash is persisted.

**Auth flow:**
1. Client sends `Authorization: Bearer eggsec_...`
2. Hash the token with SHA-256
3. Query `api_tokens WHERE token_hash = $hash AND revoked_at IS NULL`
4. Load user from `users` table via `user_id`
5. Build `CurrentUser` (same shape as Clerk JWT auth produces). If the user row is missing (deleted user with orphaned token), treat as invalid — return the same MCP error as a bad hash.
6. Fire-and-forget update of `last_used_at`

**Access control:** PATs inherit the user's existing group membership — same package entitlements as the web app. No additional scoping per token in V1.

---

## Backend: `mcp_external/` Module

```
apps/api/src/mcp_external/
├── __init__.py
├── server.py        # FastMCP instance, tool registrations, exports external_mcp_app
├── auth.py          # resolve_pat(token, session) -> CurrentUser
└── tools/
    ├── __init__.py
    ├── browse.py    # list_packages, list_collections, list_datasets, describe_dataset
    └── analyse.py   # describe_field_tree, run_crosstab, run_trend
```

### Tools

**Browse tools** (`tools/browse.py`):
- `list_packages` — list packages the user's org is entitled to
- `list_collections` — list collections within a package
- `list_datasets` — list datasets within a collection
- `describe_dataset` — metadata for a dataset (title, date range, field count)

**Analyse tools** (`tools/analyse.py`):
- `describe_field_tree` — fields available in a dataset (wraps `/scope`)
- `run_crosstab` — cross-tabulation with rows, columns, optional breakdown and weighting
- `run_trend` — trend analysis over time

All tools have clear docstrings (used by FastMCP as tool descriptions). All tools enforce access control: `list_packages` filters by the user's accessible package IDs; downstream tools validate the requested package is in that set.

### Auth (`auth.py`)

```python
async def resolve_pat(token: str, session: AsyncSession) -> CurrentUser:
    """Hash the token, look up api_tokens, return CurrentUser. Raises MCPError on failure."""
```

Errors surface as MCP-level tool errors, not HTTP status codes: `"Invalid or revoked API token"`, `"Missing Authorization header"`.

### `main.py` changes

```python
from mcp_external.server import external_mcp_app

app.mount("/mcp/external", external_mcp_app)
app.router.lifespan_context = combine_lifespans(
    db_lifespan, mcp_app.lifespan, external_mcp_app.lifespan
)
```

---

## Backend: Token API Routes

New routes, tagged `account` (not MCP-exposed), under the existing auth dependency:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/tokens` | Generate a new PAT. Returns `{ id, name, prefix, raw_token, created_at }`. `raw_token` only in this response. |
| `GET` | `/api/v1/tokens` | List active tokens for the current user. No `raw_token` field. |
| `DELETE` | `/api/v1/tokens/{id}` | Revoke a token (sets `revoked_at`). 404 if not found or not owned by user. |

Follows the existing route → service → repository pattern.

---

## Frontend: PAT Management UI

A new "API Tokens" section on the existing `/account` page.

### Components

| Component | Stories required |
|---|---|
| `ApiTokensSection` | empty state, with tokens, post-generation flow |
| `TokenList` | empty, 1 token, multiple tokens |
| `TokenListRow` | active, with/without last-used date, revoke button |
| `RevokeConfirmDialog` | open, loading, confirmed |
| `GenerateTokenForm` | empty, loading, validation error |
| `TokenRevealCallout` | one-time display with copy-to-clipboard, dismissed state |

All stories must have a11y passing.

### UI Flows

**View tokens:** Table showing name, prefix (`eggsec_a1b2c3d4...`), created date, last used date, Revoke button. Empty state with a "Generate your first token" prompt.

**Generate:** "New Token" button → inline `GenerateTokenForm` (name field + Generate button) → on success, `TokenRevealCallout` showing raw token once with copy-to-clipboard and warning: "Store this — it won't be shown again." Dismissing returns to token list.

**Revoke:** Revoke button → `RevokeConfirmDialog` ("Revoke token 'Claude Desktop'? This cannot be undone.") → confirm → token removed from list.

### Config snippets

The `/account` page shows ready-to-paste MCP config alongside each token's prefix:

**Claude Code** (`.mcp.json`):
```json
{
  "eggscaliber": {
    "type": "http",
    "url": "https://eggscaliber-lite-api.onrender.com/mcp/external",
    "headers": { "Authorization": "Bearer eggsec_<your-token>" }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "eggscaliber": {
      "type": "http",
      "url": "https://eggscaliber-lite-api.onrender.com/mcp/external",
      "headers": { "Authorization": "Bearer eggsec_<your-token>" }
    }
  }
}
```

---

## Testing

**`test_api_tokens.py`** — token CRUD against real test DB: create, list, revoke, hash verification, ownership enforcement (cannot revoke another user's token).

**`test_mcp_external_auth.py`** — PAT resolution: valid token → correct `CurrentUser`; revoked token → MCP error; unknown token → MCP error; missing header → MCP error.

**`test_mcp_external_tools.py`** — one happy-path test per tool against seed data. Access filtering verified: a user in group A cannot retrieve packages outside their entitlement.

---

## Out of Scope (V1)

- PAT expiry dates
- Per-token package scoping
- OAuth 2.0 / PKCE flow for Claude Desktop
- Streaming results (tools return structured JSON; streaming deferred to V2)
- Rate limiting per token
