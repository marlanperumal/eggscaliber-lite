# AI Interface — Design Spec

**Sub-project 7 of the Eggscaliber-Lite roadmap**  
**Date:** 2026-04-19  
**Status:** Approved

---

## Overview

A dedicated `/ai` page that lets users ask natural-language questions about their data. A PydanticAI agent on the backend autonomously discovers relevant data sources, executes crosstab and trend queries in parallel, and streams a grounded text response with inline charts and tables to the frontend via the Vercel AI SDK data stream protocol. The LLM never answers from world knowledge — every claim is backed by a tool call against real data.

Conversation history is **not persisted** in this sub-project (deferred to sub-project 8 — AuthN/AuthZ).

---

## Architecture & Data Flow

```
Browser (useChat hook)
  │  POST {messages} → /api/v1/ai/chat
  │  ← SSE stream (Vercel AI SDK data stream format)
  ↓
FastAPI route  apps/api/src/routes/ai.py
  │  validates ChatRequest, opens StreamingResponse
  ↓
AI Service  apps/api/src/services/ai_service.py
  │  PydanticAI Agent with 4 tools (injected AsyncSession):
  │    list_packages   → scope_repo
  │    get_field_tree  → analytics_repo
  │    run_crosstab    → crosstab_service
  │    run_trend       → trend_service
  ↓
Stream encoder
  │  text delta:   0:"chunk"\n
  │  data part:    2:[{"type":"crosstab_result"|"trend_result", ...}]\n
  │  finish:       d:{"finishReason":"stop"}\n
```

The model is selected via `AI_MODEL` env var (e.g. `anthropic:claude-sonnet-4-6`). PydanticAI's model abstraction means swapping providers requires only that env var change — no code changes.

The agent is fully autonomous: it decides which datasets and fields to query without asking the user for confirmation.

---

## Backend

### New files

| Path | Purpose |
|------|---------|
| `apps/api/src/routes/ai.py` | `POST /api/v1/ai/chat` — tagged `ai`, returns `StreamingResponse` |
| `apps/api/src/services/ai_service.py` | Agent definition, tool implementations, stream encoder |
| `apps/api/src/models/ai.py` | `ChatMessage`, `ChatRequest`, `CrosstabResultPart`, `TrendResultPart` |

`AIServiceError` added to `apps/api/src/errors.py`.

### Request schema

```python
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]  # full conversation history from client
```

### Agent tools

Each tool receives an injected `AsyncSession` via PydanticAI's dependency injection.

| Tool | Input | Output | Purpose |
|------|-------|--------|---------|
| `list_packages` | — | packages with collections and dataset names/IDs | Dataset discovery |
| `get_field_tree` | `dataset_id: int` | field groups and fields with types and level values | Field discovery before constructing a query |
| `run_crosstab` | `CrosstabRequest` | `CrosstabResponse` + emits `CrosstabResultPart` to stream | Execute a cross-tabulation |
| `run_trend` | `TrendRequest` | `TrendResponse` + emits `TrendResultPart` to stream | Execute a trend query |

`run_crosstab` and `run_trend` reuse the existing `CrosstabRequest`/`TrendRequest` schemas from `models/analytics.py` as their input types. The agent constructs these from its knowledge of the field tree.

### Structured data parts

Emitted as Vercel AI SDK **message annotation** stream parts (`a:` prefix) so each result block is attached to the assistant message it belongs to — not the flat `data` array. The `query_config` field carries the serialised request, used by the frontend to construct the "Open in Analytics" URL.

```python
class CrosstabResultPart(BaseModel):
    type: Literal["crosstab_result"]
    query_config: dict   # serialised CrosstabRequest
    data: CrosstabResponse

class TrendResultPart(BaseModel):
    type: Literal["trend_result"]
    query_config: dict   # serialised TrendRequest
    data: TrendResponse
```

### System prompt

The agent is instructed to:
- Always use tools — never answer from LLM world knowledge
- Always cite the dataset name and field queried
- When uncertain which dataset is relevant, call `list_packages` first, then `get_field_tree`
- Run multiple queries in parallel when answering multi-part questions

### Streaming implementation

The route opens a `StreamingResponse(media_type="text/event-stream")` and yields from an async generator. PydanticAI's `.run_stream()` yields text deltas; tool result emissions are interleaved before the next text delta using an async queue shared between the tool callbacks and the generator.

### Environment variables

`AI_MODEL` — PydanticAI model string (e.g. `anthropic:claude-sonnet-4-6`, `openai:gpt-4o`). Added to `.env.example`. Required in production; defaults to `anthropic:claude-sonnet-4-6` in development.

The corresponding provider API key (e.g. `ANTHROPIC_API_KEY`) must also be set.

---

## Frontend

### New files (all in `apps/web/src/app/ai/`)

| File | Purpose |
|------|---------|
| `page.tsx` | Feature-flagged (`ai-interface`), renders `AIChatPage` |
| `AIChatPage.tsx` + story | Top-level layout: message list + input bar, wires `useChat` |
| `MessageList.tsx` + story | Scrollable list, auto-scrolls to bottom on new messages |
| `MessageBubble.tsx` + story | User bubble (right-aligned) or assistant bubble (left-aligned); supports streaming partial text |
| `AssistantMessage.tsx` + story | Renders text content + embedded `InlineResult` blocks below |
| `InlineResult.tsx` + story | Mini chart (reuses `AnalyticsChart`, moved to `components/` shared location first) + summary stats + "Open in Analytics" button |
| `ChatInput.tsx` + story | Textarea (Enter to send, Shift+Enter for newline) + send button + disabled state while streaming |

### `useChat` wiring

```typescript
const { messages, input, handleSubmit, isLoading, data } = useChat({
  api: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/chat`,
  streamProtocol: 'data',
})
```

Structured result parts arrive as `message.annotations` on the assistant message they belong to (Vercel AI SDK `a:` stream parts). `AssistantMessage` reads `message.annotations` to render `InlineResult` blocks below the text content.

### "Open in Analytics" button

`InlineResult` receives `query_config` from the result part. The button navigates to `/analytics` with nuqs-encoded URL params built from `query_config`, reusing the existing short-key schema (`ds`, `r`, `c`, `m`, `col`, `bd`, etc.). The analytics page hydrates the query builder automatically on load.

### Navigation

An "AI" link is added to the top nav alongside "Analytics". Both the nav link and the `/ai` page are gated by the `ai-interface` PostHog feature flag.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Tool failure (dataset not found, query error) | Caught inside the tool; error string returned to the agent so it can incorporate it gracefully into the response |
| Agent init failure (missing API key, bad model string) | `AIServiceError` raised; route maps to `500` |
| Malformed request | `422` via standard FastAPI validation |
| Stream error on frontend | `useChat` exposes `error` state; rendered as a system message in the chat with a "Try again" button |

---

## Testing

### Backend

- **Tool integration tests** (real test DB, seed data): `test_list_packages_tool`, `test_get_field_tree_tool`, `test_run_crosstab_tool`, `test_run_trend_tool` — each verifies well-shaped output against seed datasets
- **Agent-level test** using PydanticAI's `TestModel` (no real LLM call): verifies the stream encoder emits valid Vercel AI SDK format chunks and that `CrosstabResultPart`/`TrendResultPart` are well-formed

### Frontend

- Storybook stories for all 6 components with a11y passing; `InlineResult` stories cover both crosstab and trend variants with realistic seed data
- Vitest unit tests:
  - `InlineResult` — verifies "Open in Analytics" URL construction from `query_config`
  - `MessageBubble` — user vs. assistant rendering, streaming partial text state

---

## Out of Scope (this sub-project)

- Conversation persistence (deferred to sub-project 8)
- Per-user or per-org access control on AI (deferred to sub-project 8)
- File/image inputs
- Agent memory across turns beyond the messages array passed in the request
