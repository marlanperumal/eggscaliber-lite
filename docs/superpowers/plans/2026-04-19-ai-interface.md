# AI Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/ai` page where users ask NL questions, a PydanticAI agent autonomously queries datasets via existing analytics services, and streams grounded text + inline chart results to the frontend.

**Architecture:** FastAPI `POST /api/v1/ai/chat` streams Vercel AI SDK data format chunks (`0:` text, `a:` message annotations). PydanticAI agent has 4 tools that call existing repos/services. Frontend uses `useChat` from `@ai-sdk/react` pointed at the FastAPI endpoint; assistant message annotations hold structured `CrosstabResultPart`/`TrendResultPart` objects rendered as inline charts with "Open in Analytics" buttons.

**Tech Stack:** `pydantic-ai`, `@ai-sdk/react`, FastAPI `StreamingResponse`, existing recharts `AnalyticsChart` component (relocated to `src/components/analytics/`)

---

## File Map

**Backend — Create:**
- `apps/api/src/models/ai.py` — `ChatMessage`, `ChatRequest`, `AICrosstabResultPart`, `AITrendResultPart`
- `apps/api/src/services/ai_service.py` — agent, deps, 4 tools, stream encoder, `stream_response()`
- `apps/api/src/routes/ai.py` — `POST /api/v1/ai/chat`
- `apps/api/tests/test_ai_service.py` — tool integration tests + stream encoder test

**Backend — Modify:**
- `apps/api/src/errors.py` — add `AIServiceError`
- `apps/api/src/config.py` — add `ai_model: str` setting
- `apps/api/src/main.py` — register `ai` router (NOT in MCP route maps)
- `.env.example` — add `AI_MODEL`, `ANTHROPIC_API_KEY`

**Frontend — Create:**
- `apps/web/src/components/analytics/AnalyticsChart.tsx` — moved from analytics page dir
- `apps/web/src/app/ai/page.tsx`
- `apps/web/src/app/ai/AIChatPage.tsx` + `AIChatPage.stories.tsx`
- `apps/web/src/app/ai/ChatInput.tsx` + `ChatInput.stories.tsx`
- `apps/web/src/app/ai/MessageBubble.tsx` + `MessageBubble.stories.tsx`
- `apps/web/src/app/ai/AssistantMessage.tsx` + `AssistantMessage.stories.tsx`
- `apps/web/src/app/ai/MessageList.tsx` + `MessageList.stories.tsx`
- `apps/web/src/app/ai/InlineResult.tsx` + `InlineResult.stories.tsx` + `InlineResult.test.tsx`

**Frontend — Modify:**
- `apps/web/src/app/analytics/AnalyticsChart.stories.tsx` — update import path
- `apps/web/src/app/analytics/ResultsPanel.tsx` — update import path
- `apps/web/src/components/ui/top-nav.tsx` — add "AI" link

---

## Task 1: Install pydantic-ai and check its streaming API

**Files:**
- Modify: `apps/api/pyproject.toml` (via just add-api-dep)

- [ ] **Step 1: Check latest pydantic-ai version**

```bash
uv pip index versions pydantic-ai 2>/dev/null | head -3
```

Note the latest stable version. Then check its streaming docs:
```bash
uv run --project apps/api python3 -c "import pydantic_ai; print(pydantic_ai.__version__)" 2>/dev/null || echo "not installed"
```

- [ ] **Step 2: Add pydantic-ai to the API dependencies**

```bash
just add-api-dep pydantic-ai
```

For Anthropic support (default provider), also add:
```bash
just add-api-dep anthropic
```

- [ ] **Step 3: Verify the install**

```bash
just test-api -k "not test_" --collect-only 2>&1 | head -5
```
Expected: collection works without import errors.

- [ ] **Step 4: Verify pydantic-ai streaming API is `.stream_text(delta=True)`**

```bash
uv run --project apps/api python3 -c "
from pydantic_ai import Agent
import inspect
import pydantic_ai.result as r
# Check the StreamedRunResult API
print([m for m in dir(r.StreamedRunResult) if not m.startswith('_')])
"
```

If `stream_text` is present, proceed. If the streaming API differs from `result.stream_text(delta=True)`, adjust `ai_service.py` in Task 4 accordingly. The pydantic-ai streaming API has evolved — the current method may be `stream()` or `stream_text()`. Use whichever is current.

- [ ] **Step 5: Commit**

```bash
git add apps/api/pyproject.toml apps/api/uv.lock
```
Write `/tmp/commit-msg.txt`:
```
chore(api): add pydantic-ai and anthropic dependencies
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 2: Backend models, errors, config

**Files:**
- Create: `apps/api/src/models/ai.py`
- Modify: `apps/api/src/errors.py`
- Modify: `apps/api/src/config.py`
- Modify: `.env.example`

- [ ] **Step 1: Add `AIServiceError` to errors.py**

Open `apps/api/src/errors.py` and append:

```python
class AIServiceError(DomainError): ...
```

- [ ] **Step 2: Add `ai_model` to Settings in config.py**

In `apps/api/src/config.py`, add to the `Settings` class body (after `environment`):

```python
    ai_model: str = "anthropic:claude-sonnet-4-6"
```

- [ ] **Step 3: Create apps/api/src/models/ai.py**

```python
from typing import Literal

from sqlmodel import SQLModel

from src.models.analytics import CrosstabResponse, TrendResponse


class ChatMessage(SQLModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(SQLModel):
    messages: list[ChatMessage]


class AICrosstabResultPart(SQLModel):
    type: Literal["crosstab_result"] = "crosstab_result"
    query_config: dict
    data: CrosstabResponse


class AITrendResultPart(SQLModel):
    type: Literal["trend_result"] = "trend_result"
    query_config: dict
    data: TrendResponse
```

- [ ] **Step 4: Update .env.example**

Append to `.env.example`:

```
# AI Interface — pydantic-ai model string (e.g. anthropic:claude-sonnet-4-6, openai:gpt-4o)
AI_MODEL=anthropic:claude-sonnet-4-6
# Anthropic API key (required when AI_MODEL starts with anthropic:)
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 5: Verify no import errors**

```bash
just typecheck 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/models/ai.py apps/api/src/errors.py apps/api/src/config.py .env.example
```
Write `/tmp/commit-msg.txt`:
```
feat(api): add AI interface models, AIServiceError, and AI_MODEL config
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 3: AI service — stream encoder helpers (TDD)

**Files:**
- Create: `apps/api/tests/test_ai_service.py` (encoder tests only for now)
- Create: `apps/api/src/services/ai_service.py` (encoder section only)

- [ ] **Step 1: Write failing tests for the stream encoder**

Create `apps/api/tests/test_ai_service.py`:

```python
import json

import pytest


class TestStreamEncoder:
    def test_encode_text_chunk(self):
        from src.services.ai_service import encode_text_chunk

        result = encode_text_chunk("Hello ")
        assert result == '0:"Hello "\n'

    def test_encode_text_chunk_escapes_quotes(self):
        from src.services.ai_service import encode_text_chunk

        result = encode_text_chunk('say "hi"')
        assert result == '0:"say \\"hi\\""\n'

    def test_encode_annotation_part(self):
        from src.services.ai_service import encode_annotation_part

        result = encode_annotation_part({"type": "crosstab_result", "query_config": {}})
        assert result == 'a:[{"type": "crosstab_result", "query_config": {}}]\n'

    def test_encode_finish(self):
        from src.services.ai_service import encode_finish

        result = encode_finish()
        assert result == 'd:{"finishReason": "stop"}\n'

    def test_encode_error(self):
        from src.services.ai_service import encode_error

        result = encode_error("something went wrong")
        assert result == '3:"something went wrong"\n'
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
just test-api tests/test_ai_service.py::TestStreamEncoder -v
```
Expected: `ModuleNotFoundError` or `ImportError` — `ai_service` doesn't exist yet.

- [ ] **Step 3: Create apps/api/src/services/ai_service.py with encoder only**

```python
import json
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession


# ── Stream encoding ────────────────────────────────────────────────────────────


def encode_text_chunk(text: str) -> str:
    return f"0:{json.dumps(text)}\n"


def encode_annotation_part(data: dict) -> str:
    return f"a:{json.dumps([data])}\n"


def encode_finish(finish_reason: str = "stop") -> str:
    return f'd:{json.dumps({"finishReason": finish_reason})}\n'


def encode_error(message: str) -> str:
    return f"3:{json.dumps(message)}\n"
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
just test-api tests/test_ai_service.py::TestStreamEncoder -v
```
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/test_ai_service.py apps/api/src/services/ai_service.py
```
Write `/tmp/commit-msg.txt`:
```
feat(api): add AI stream encoder helpers with tests
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 4: AI service — agent and tool integration tests

**Files:**
- Modify: `apps/api/tests/test_ai_service.py` — add tool tests
- Modify: `apps/api/src/services/ai_service.py` — add agent, deps, tools

The tests call tool implementation functions directly (not via the agent), so we don't need a real LLM for integration testing.

- [ ] **Step 1: Add tool integration tests to test_ai_service.py**

Append to `apps/api/tests/test_ai_service.py`:

```python
import pytest_asyncio
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response


@pytest_asyncio.fixture
async def ai_dataset(db):
    """Package→Collection→Dataset with one categorical field and responses."""
    pkg = Package(name="AI Test Pkg", slug="ai-test-pkg")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    col = Collection(
        name="AI Test Col",
        slug="ai-test-col",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    ds = Dataset(
        name="AI Test DS",
        slug="ai-test-ds",
        collection_id=col.id,
        sort_order=0,
    )
    db.add(ds)
    await db.flush()
    await db.refresh(ds)

    grp = FieldGroup(
        name="Demographics",
        slug="demographics",
        dataset_id=ds.id,
        sort_order=0,
    )
    db.add(grp)
    await db.flush()
    await db.refresh(grp)

    fld = Field(
        field_key="gender",
        display_name="Gender",
        field_type=FieldType.categorical,
        dataset_id=ds.id,
        group_id=grp.id,
        sort_order=0,
        is_filterable=True,
    )
    db.add(fld)
    await db.flush()
    await db.refresh(fld)

    for val, label in [("M", "Male"), ("F", "Female")]:
        lv = Level(value=val, display_label=label, field_id=fld.id, sort_order=0)
        db.add(lv)

    resp = Response(
        dataset_id=ds.id,
        data={"gender": "M"},
        worker_type="jsonb_response",
    )
    db.add(resp)
    await db.flush()

    return {"pkg": pkg, "col": col, "ds": ds, "field": fld}


class TestListPackagesTool:
    async def test_returns_package_hierarchy(self, db, ai_dataset):
        from src.services.ai_service import _list_packages_impl

        result = await _list_packages_impl(db)
        assert "AI Test Pkg" in result
        assert "AI Test Col" in result
        assert "AI Test DS" in result

    async def test_empty_when_no_packages(self, db):
        from src.services.ai_service import _list_packages_impl

        result = await _list_packages_impl(db)
        assert "No data packages" in result or isinstance(result, str)


class TestGetFieldTreeTool:
    async def test_returns_field_info(self, db, ai_dataset):
        from src.services.ai_service import _get_field_tree_impl

        ds_id = ai_dataset["ds"].id
        result = await _get_field_tree_impl(db, ds_id)
        assert "gender" in result
        assert "Gender" in result

    async def test_dataset_not_found(self, db):
        from src.services.ai_service import _get_field_tree_impl

        result = await _get_field_tree_impl(db, 999_999)
        assert "not found" in result.lower()


class TestRunCrosstabTool:
    async def test_returns_result_and_pushes_part(self, db, ai_dataset):
        from src.models.analytics import CrosstabRequest, FieldSelection, MeasureSpec
        from src.services.ai_service import _run_crosstab_impl

        request = CrosstabRequest(
            dataset_id=ai_dataset["ds"].id,
            rows=[FieldSelection(field_key="gender")],
            measure=MeasureSpec(type="count", display="n"),
        )
        result_parts: list[dict] = []
        text = await _run_crosstab_impl(db, request, result_parts)

        assert "complete" in text.lower() or "crosstab" in text.lower()
        assert len(result_parts) == 1
        assert result_parts[0]["type"] == "crosstab_result"
        assert "query_config" in result_parts[0]
        assert "data" in result_parts[0]

    async def test_dataset_not_found_returns_error_string(self, db):
        from src.models.analytics import CrosstabRequest, FieldSelection, MeasureSpec
        from src.services.ai_service import _run_crosstab_impl

        request = CrosstabRequest(
            dataset_id=999_999,
            rows=[FieldSelection(field_key="x")],
            measure=MeasureSpec(type="count", display="n"),
        )
        result = await _run_crosstab_impl(db, request, [])
        assert "error" in result.lower() or "not found" in result.lower()


class TestRunTrendTool:
    async def test_returns_result_and_pushes_part(self, db, ai_dataset):
        from src.models.analytics import FieldSelection, MeasureSpec, TrendRequest
        from src.services.ai_service import _run_trend_impl

        request = TrendRequest(
            collection_id=ai_dataset["col"].id,
            fields=[FieldSelection(field_key="gender")],
            measure=MeasureSpec(type="count", display="n"),
        )
        result_parts: list[dict] = []
        text = await _run_trend_impl(db, request, result_parts)

        assert isinstance(text, str)
        assert len(result_parts) == 1
        assert result_parts[0]["type"] == "trend_result"

    async def test_collection_not_found_returns_error_string(self, db):
        from src.models.analytics import FieldSelection, MeasureSpec, TrendRequest
        from src.services.ai_service import _run_trend_impl

        request = TrendRequest(
            collection_id=999_999,
            fields=[FieldSelection(field_key="x")],
            measure=MeasureSpec(type="count", display="n"),
        )
        result = await _run_trend_impl(db, request, [])
        assert "error" in result.lower() or "not found" in result.lower()
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
just test-api tests/test_ai_service.py -k "Tool" -v
```
Expected: `ImportError` — `_list_packages_impl` etc. don't exist yet.

- [ ] **Step 3: Implement the tool impl functions and agent in ai_service.py**

Replace the contents of `apps/api/src/services/ai_service.py` with:

```python
import json
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, UserPromptPart
from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import AIServiceError, CollectionNotFoundError, DatasetNotFoundError
from src.models.ai import AICrosstabResultPart, AITrendResultPart, ChatMessage
from src.models.analytics import CrosstabRequest, TrendRequest
from src.services import analytics_service, package_service


# ── Stream encoding ────────────────────────────────────────────────────────────


def encode_text_chunk(text: str) -> str:
    return f"0:{json.dumps(text)}\n"


def encode_annotation_part(data: dict) -> str:
    return f"a:{json.dumps([data])}\n"


def encode_finish(finish_reason: str = "stop") -> str:
    return f'd:{json.dumps({"finishReason": finish_reason})}\n'


def encode_error(message: str) -> str:
    return f"3:{json.dumps(message)}\n"


# ── Tool implementation functions (called by agent tools and tested directly) ──


async def _list_packages_impl(session: AsyncSession) -> str:
    packages = await package_service.get_scope(session)
    if not packages:
        return "No data packages are available."
    lines: list[str] = []
    for pkg in packages:
        lines.append(f"Package: {pkg.name} (id={pkg.id})")
        for col in pkg.collections:
            lines.append(f"  Collection: {col.name} (id={col.id})")
            for ds in col.datasets:
                lines.append(f"    Dataset: {ds.name} (id={ds.id})")
    return "\n".join(lines)


async def _get_field_tree_impl(session: AsyncSession, dataset_id: int) -> str:
    try:
        tree = await analytics_service.get_field_tree(session, dataset_id)
    except DatasetNotFoundError:
        return f"Dataset {dataset_id} not found."
    lines: list[str] = []
    for group in tree.groups:
        lines.append(f"Group: {group.name}")
        for f in group.fields:
            lines.append(
                f"  field_key={f.field_key!r} display={f.display_name!r} type={f.field_type}"
            )
    for f in tree.ungrouped_fields:
        lines.append(f"field_key={f.field_key!r} display={f.display_name!r} type={f.field_type}")
    return "\n".join(lines) if lines else "No fields found."


async def _run_crosstab_impl(
    session: AsyncSession,
    request: CrosstabRequest,
    result_parts: list[dict],
) -> str:
    try:
        result = await analytics_service.run_crosstab(session, request)
    except DatasetNotFoundError:
        return f"Error: dataset {request.dataset_id} not found."
    except Exception as e:
        return f"Error running crosstab: {e}"
    result_parts.append(
        AICrosstabResultPart(
            query_config=request.model_dump(),
            data=result,
        ).model_dump()
    )
    return (
        f"Crosstab complete: {result.meta.dataset_name}, "
        f"{result.meta.base_n} respondents, {len(result.rows)} row combinations."
    )


async def _run_trend_impl(
    session: AsyncSession,
    request: TrendRequest,
    result_parts: list[dict],
) -> str:
    try:
        result = await analytics_service.run_trend(session, request)
    except CollectionNotFoundError:
        return f"Error: collection {request.collection_id} not found."
    except Exception as e:
        return f"Error running trend: {e}"
    result_parts.append(
        AITrendResultPart(
            query_config=request.model_dump(),
            data=result,
        ).model_dump()
    )
    return (
        f"Trend complete: {result.meta.collection_name}, "
        f"{result.meta.base_n} total respondents, {len(result.rows)} data points."
    )


# ── Agent ──────────────────────────────────────────────────────────────────────


@dataclass
class AIServiceDeps:
    session: AsyncSession
    result_parts: list[dict] = field(default_factory=list)


SYSTEM_PROMPT = """\
You are a data analysis assistant. You answer questions ONLY using data from the available datasets.
Never use world knowledge or assumptions — every factual claim must be backed by a tool call.

When answering:
1. Call list_packages first if you don't know which dataset contains the relevant data.
2. Call get_field_tree to understand what fields a dataset has before running a query.
3. Call run_crosstab for cross-tabulations (comparing fields within one dataset).
4. Call run_trend for tracking how a field changes across time/datasets in a collection.
5. Run multiple tool calls in parallel when answering multi-part questions.
6. Always cite the dataset name and field you queried.
7. If a dataset or field is not found, say so clearly.
"""


def _build_agent() -> Agent[AIServiceDeps, str]:
    from src.config import settings

    agent: Agent[AIServiceDeps, str] = Agent(
        model=settings.ai_model,
        system_prompt=SYSTEM_PROMPT,
        deps_type=AIServiceDeps,
    )

    @agent.tool
    async def list_packages(ctx: RunContext[AIServiceDeps]) -> str:
        """List all available data packages, collections, and datasets with their IDs."""
        return await _list_packages_impl(ctx.deps.session)

    @agent.tool
    async def get_field_tree(ctx: RunContext[AIServiceDeps], dataset_id: int) -> str:
        """Get all fields available in a dataset. Call this before constructing a query."""
        return await _get_field_tree_impl(ctx.deps.session, dataset_id)

    @agent.tool
    async def run_crosstab(ctx: RunContext[AIServiceDeps], request: CrosstabRequest) -> str:
        """Run a cross-tabulation query on a dataset."""
        return await _run_crosstab_impl(ctx.deps.session, request, ctx.deps.result_parts)

    @agent.tool
    async def run_trend(ctx: RunContext[AIServiceDeps], request: TrendRequest) -> str:
        """Run a trend query across datasets in a collection."""
        return await _run_trend_impl(ctx.deps.session, request, ctx.deps.result_parts)

    return agent


_agent: Agent[AIServiceDeps, str] | None = None


def get_agent() -> Agent[AIServiceDeps, str]:
    global _agent
    if _agent is None:
        _agent = _build_agent()
    return _agent


# ── Message history conversion ─────────────────────────────────────────────────


def _to_model_messages(messages: list[ChatMessage]) -> list[ModelMessage]:
    result: list[ModelMessage] = []
    for msg in messages:
        if msg.role == "user":
            result.append(ModelRequest(parts=[UserPromptPart(content=msg.content)]))
        elif msg.role == "assistant":
            result.append(ModelResponse(parts=[TextPart(content=msg.content)]))
    return result


# ── Public streaming function ──────────────────────────────────────────────────


async def stream_response(
    session: AsyncSession, messages: list[ChatMessage]
) -> AsyncGenerator[str, None]:
    if not messages:
        yield encode_error("No messages provided.")
        yield encode_finish()
        return

    deps = AIServiceDeps(session=session)
    message_history = _to_model_messages(messages[:-1])
    user_prompt = messages[-1].content

    try:
        agent = get_agent()
        async with agent.run_stream(
            user_prompt, message_history=message_history, deps=deps
        ) as result:
            async for chunk in result.stream_text(delta=True):
                yield encode_text_chunk(chunk)

        for part in deps.result_parts:
            yield encode_annotation_part(part)

        yield encode_finish()
    except Exception as e:
        yield encode_error(str(e))
        yield encode_finish("error")
```

**Important:** After writing this file, verify that the pydantic-ai streaming API (`result.stream_text(delta=True)`) matches the installed version. If it differs, adjust accordingly — the pydantic-ai API evolves rapidly. Common alternatives:
- `result.stream(delta=True)` — if `stream_text` was renamed
- `result.text_stream` — async iterator in some versions

- [ ] **Step 4: Run tool tests — verify they pass**

```bash
just test-api tests/test_ai_service.py -k "Tool" -v
```
Expected: all `TestListPackagesTool`, `TestGetFieldTreeTool`, `TestRunCrosstabTool`, `TestRunTrendTool` tests PASS.

- [ ] **Step 5: Run all ai_service tests**

```bash
just test-api tests/test_ai_service.py -v
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/ai_service.py apps/api/tests/test_ai_service.py
```
Write `/tmp/commit-msg.txt`:
```
feat(api): add PydanticAI agent service with 4 tools and streaming encoder
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 5: AI route + main.py registration

**Files:**
- Create: `apps/api/src/routes/ai.py`
- Modify: `apps/api/src/main.py`

- [ ] **Step 1: Create apps/api/src/routes/ai.py**

```python
from fastapi import Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.ai import ChatRequest
from src.services.ai_service import stream_response

from fastapi import APIRouter

router = APIRouter(tags=["ai"])


@router.post(
    "/ai/chat",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/plain": {}}, "description": "Vercel AI SDK data stream"}},
)
async def chat(request: ChatRequest, session: AsyncSession = Depends(get_session)):
    """Stream a grounded AI response to a natural-language question about your data."""
    return StreamingResponse(
        stream_response(session, request.messages),
        media_type="text/plain; charset=utf-8",
        headers={"X-Vercel-AI-Data-Stream": "v1"},
    )
```

- [ ] **Step 2: Register the router in main.py**

In `apps/api/src/main.py`, add the import:
```python
from src.routes import ai, analytics, collections, datasets, health, packages, scope, sentry, uploads
```

Add the router include (after the analytics router):
```python
app.include_router(ai.router, prefix="/api/v1")
```

Do NOT add `ai` to the MCP `route_maps` — the streaming endpoint is not compatible with MCP tools.

- [ ] **Step 3: Start the API and verify the endpoint exists**

```bash
just api &
sleep 3
curl -s -X POST http://localhost:8000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}' | head -5
```
Expected: streaming output starting with `0:` chunks (may error without a real API key, but the endpoint should respond).

Kill the background API server after testing:
```bash
just kill-api
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/ai.py apps/api/src/main.py
```
Write `/tmp/commit-msg.txt`:
```
feat(api): add POST /api/v1/ai/chat streaming endpoint
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 6: Generate types and verify

**Files:**
- Auto-modified: `packages/shared/api.d.ts`

- [ ] **Step 1: Regenerate TypeScript types**

```bash
just generate-types
```

- [ ] **Step 2: Verify no new `unknown` types for AI route**

The `/api/v1/ai/chat` endpoint uses `StreamingResponse` with a custom content type, not a JSON `response_model`. It will appear in the OpenAPI spec but without a typed JSON body — this is expected and does not affect the frontend (which uses `useChat` directly, not `openapi-fetch`).

```bash
grep -n "ai" packages/shared/api.d.ts | head -10
```

Expected: the chat path appears but its response type may be `unknown` — this is acceptable for streaming endpoints. The frontend never calls this via `openapi-fetch`.

- [ ] **Step 3: Commit if types changed**

```bash
git add packages/shared/api.d.ts
```
Write `/tmp/commit-msg.txt`:
```
chore(shared): regenerate types after adding AI chat endpoint
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 7: Install @ai-sdk/react frontend dependency

**Files:**
- Modify: `apps/web/package.json` (via just add-web-dep)

- [ ] **Step 1: Check latest @ai-sdk/react version**

```bash
npm show @ai-sdk/react version
```

- [ ] **Step 2: Add the dependency**

```bash
just add-web-dep @ai-sdk/react
```

- [ ] **Step 3: Verify the package is importable**

```bash
pnpm --filter web run build 2>&1 | tail -5
```
Or just check that `node_modules/@ai-sdk/react` exists:
```bash
ls apps/web/node_modules/@ai-sdk/react/dist 2>/dev/null | head -3
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
```
Write `/tmp/commit-msg.txt`:
```
chore(web): add @ai-sdk/react for AI chat streaming
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 8: Relocate AnalyticsChart to shared components directory

**Files:**
- Create: `apps/web/src/components/analytics/AnalyticsChart.tsx` (move from analytics page dir)
- Modify: `apps/web/src/app/analytics/AnalyticsChart.stories.tsx` — update import
- Modify: `apps/web/src/app/analytics/ResultsPanel.tsx` — update import

- [ ] **Step 1: Create the target directory and copy the file**

```bash
mkdir -p apps/web/src/components/analytics
cp apps/web/src/app/analytics/AnalyticsChart.tsx apps/web/src/components/analytics/AnalyticsChart.tsx
```

- [ ] **Step 2: Delete the original**

```bash
rm apps/web/src/app/analytics/AnalyticsChart.tsx
```

- [ ] **Step 3: Update the analytics-types import inside AnalyticsChart.tsx itself**

The moved file has `import type { AnalyticsResult, ChartType } from "./analytics-types"` — that relative path no longer resolves from `components/analytics/`. Change it to:

```typescript
import type { AnalyticsResult, ChartType } from "@/app/analytics/analytics-types"
```

- [ ] **Step 4: Update the import in ResultsPanel.tsx**

In `apps/web/src/app/analytics/ResultsPanel.tsx`, change:
```typescript
import { AnalyticsChart, ... } from "./AnalyticsChart"
```
to:
```typescript
import { AnalyticsChart, ... } from "@/components/analytics/AnalyticsChart"
```

(Search the file for `AnalyticsChart` to find the exact import line, then update the path.)

- [ ] **Step 5: Update the import in AnalyticsChart.stories.tsx**

In `apps/web/src/app/analytics/AnalyticsChart.stories.tsx`, change the import to:
```typescript
import { AnalyticsChart } from "@/components/analytics/AnalyticsChart"
```

- [ ] **Step 6: Verify typecheck passes**

```bash
just typecheck 2>&1 | tail -10
```
Expected: no errors related to AnalyticsChart.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/analytics/AnalyticsChart.tsx
git add apps/web/src/app/analytics/AnalyticsChart.stories.tsx apps/web/src/app/analytics/ResultsPanel.tsx
git add -u apps/web/src/app/analytics/AnalyticsChart.tsx
```
Write `/tmp/commit-msg.txt`:
```
refactor(web): relocate AnalyticsChart to components/analytics for shared use
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 9: Build ChatInput component

**Files:**
- Create: `apps/web/src/app/ai/ChatInput.tsx`
- Create: `apps/web/src/app/ai/ChatInput.stories.tsx`

- [ ] **Step 1: Create ChatInput.tsx**

```typescript
"use client"
import { type FormEvent, type KeyboardEvent, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  input: string
  isLoading: boolean
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

export function ChatInput({ input, isLoading, onInputChange, onSubmit }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex items-end gap-2 border-t border-border p-3"
    >
      <Textarea
        data-testid="chat-input"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your data…"
        rows={2}
        disabled={isLoading}
        className="resize-none"
      />
      <Button type="submit" disabled={isLoading || !input.trim()}>
        Send
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create ChatInput.stories.tsx**

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ChatInput } from "./ChatInput"

const meta = {
  component: ChatInput,
  args: {
    input: "",
    isLoading: false,
    onInputChange: () => {},
    onSubmit: (e) => e.preventDefault(),
  },
} satisfies Meta<typeof ChatInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithText: Story = {
  args: { input: "How has brand awareness changed over time?" },
}

export const Loading: Story = {
  args: { input: "How has brand awareness changed over time?", isLoading: true },
}
```

- [ ] **Step 3: Verify Storybook compiles**

```bash
just storybook &
sleep 10
curl -s http://localhost:6006 | grep -q "Storybook" && echo "OK" || echo "FAIL"
just kill-web 2>/dev/null; kill %1 2>/dev/null
```

Or simply run:
```bash
pnpm --filter web exec storybook build --quiet 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/ai/ChatInput.tsx apps/web/src/app/ai/ChatInput.stories.tsx
```
Write `/tmp/commit-msg.txt`:
```
feat(web): add ChatInput component for AI chat
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 10: Build MessageBubble and AssistantMessage components

**Files:**
- Create: `apps/web/src/app/ai/MessageBubble.tsx`
- Create: `apps/web/src/app/ai/MessageBubble.stories.tsx`
- Create: `apps/web/src/app/ai/AssistantMessage.tsx`
- Create: `apps/web/src/app/ai/AssistantMessage.stories.tsx`

- [ ] **Step 1: Create MessageBubble.tsx**

```typescript
interface Props {
  role: "user" | "assistant"
  content: React.ReactNode
}

export function MessageBubble({ role, content }: Props) {
  const isUser = role === "user"
  return (
    <div
      data-testid={`message-bubble-${role}`}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create MessageBubble.stories.tsx**

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { MessageBubble } from "./MessageBubble"

const meta = {
  component: MessageBubble,
} satisfies Meta<typeof MessageBubble>

export default meta
type Story = StoryObj<typeof meta>

export const UserMessage: Story = {
  args: { role: "user", content: "How has brand awareness changed over time?" },
}

export const AssistantMessageBubble: Story = {
  args: { role: "assistant", content: "Brand awareness rose from 42% to 67% between 2022 and 2024." },
}

export const StreamingAssistant: Story = {
  args: { role: "assistant", content: "Analyzing your data…" },
}
```

- [ ] **Step 3: Create AssistantMessage.tsx**

`AssistantMessage` renders the text content and any `InlineResult` blocks from `message.annotations`.

```typescript
import type { Message } from "@ai-sdk/react"
import type { AICrosstabResultPart, AITrendResultPart } from "./ai-types"
import { InlineResult } from "./InlineResult"

interface Props {
  message: Message
}

export function AssistantMessage({ message }: Props) {
  const resultParts = (message.annotations ?? []) as Array<
    AICrosstabResultPart | AITrendResultPart
  >

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      {resultParts.map((part, i) => (
        <InlineResult key={i} part={part} />
      ))}
    </div>
  )
}
```

Note: `ai-types.ts` is created in Task 11. Write it as a stub here if TypeScript complains during development:

```typescript
// apps/web/src/app/ai/ai-types.ts  (stub — replace in Task 11)
export type AICrosstabResultPart = {
  type: "crosstab_result"
  query_config: Record<string, unknown>
  data: unknown
}
export type AITrendResultPart = {
  type: "trend_result"
  query_config: Record<string, unknown>
  data: unknown
}
```

- [ ] **Step 4: Create AssistantMessage.stories.tsx**

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AssistantMessage } from "./AssistantMessage"

const mockMessage = (content: string, annotations?: unknown[]) => ({
  id: "1",
  role: "assistant" as const,
  content,
  annotations,
})

const meta = {
  component: AssistantMessage,
} satisfies Meta<typeof AssistantMessage>

export default meta
type Story = StoryObj<typeof meta>

export const TextOnly: Story = {
  args: { message: mockMessage("Brand awareness rose from 42% to 67% between 2022 and 2024.") },
}

export const WithCrosstabResult: Story = {
  args: {
    message: mockMessage("Here is the gender breakdown:", [
      {
        type: "crosstab_result",
        query_config: { dataset_id: 1, rows: [{ field_key: "gender" }], measure: { type: "count", display: "pct_col" } },
        data: {
          meta: { mode: "crosstab", row_fields: [{ field_key: "gender", display_name: "Gender" }], col_fields: [], row_mode: "stacked", col_mode: "stacked", measure: { type: "count", display: "pct_col" }, dataset_name: "Wave 1", base_n: 100, level_labels: { gender: { M: "Male", F: "Female" } } },
          rows: [{ key: ["M"], values: { Total: 52 } }, { key: ["F"], values: { Total: 48 } }],
        },
      },
    ]),
  },
}
```

- [ ] **Step 5: Run typecheck**

```bash
just typecheck 2>&1 | grep "ai/" | head -10
```

Fix any type errors before committing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/ai/MessageBubble.tsx apps/web/src/app/ai/MessageBubble.stories.tsx
git add apps/web/src/app/ai/AssistantMessage.tsx apps/web/src/app/ai/AssistantMessage.stories.tsx
```
Write `/tmp/commit-msg.txt`:
```
feat(web): add MessageBubble and AssistantMessage AI chat components
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 11: Build InlineResult component (TDD)

**Files:**
- Create: `apps/web/src/app/ai/ai-types.ts`
- Create: `apps/web/src/app/ai/InlineResult.tsx`
- Create: `apps/web/src/app/ai/InlineResult.stories.tsx`
- Create: `apps/web/src/app/ai/InlineResult.test.tsx`

- [ ] **Step 1: Write failing tests for buildAnalyticsUrl**

Create `apps/web/src/app/ai/InlineResult.test.tsx`:

```typescript
import { describe, expect, it } from "vitest"
import { buildAnalyticsUrl } from "./InlineResult"

describe("buildAnalyticsUrl", () => {
  it("builds crosstab URL with required params", () => {
    const url = buildAnalyticsUrl(
      {
        dataset_id: 42,
        rows: [{ field_key: "gender" }],
        columns: [],
        row_mode: "stacked",
        col_mode: "stacked",
        filters: [],
        measure: { type: "count", display: "n", field_key: null, aggregation: null },
      },
      "crosstab",
    )
    expect(url).toContain("/analytics")
    expect(url).toContain("mode=crosstab")
    expect(url).toContain("ds=42")
    expect(url).toContain("gender")
  })

  it("builds trend URL with required params", () => {
    const url = buildAnalyticsUrl(
      {
        collection_id: 7,
        fields: [{ field_key: "brand_awareness" }],
        breakdown: null,
        filters: [],
        measure: { type: "count", display: "pct_col", field_key: null, aggregation: null },
      },
      "trend",
    )
    expect(url).toContain("mode=trend")
    expect(url).toContain("col=7")
    expect(url).toContain("brand_awareness")
  })

  it("includes breakdown in trend URL when present", () => {
    const url = buildAnalyticsUrl(
      {
        collection_id: 7,
        fields: [{ field_key: "brand_awareness" }],
        breakdown: { field_key: "gender" },
        filters: [],
        measure: { type: "count", display: "n", field_key: null, aggregation: null },
      },
      "trend",
    )
    expect(url).toContain("bd=gender")
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
just test-web -t "buildAnalyticsUrl"
```
Expected: `Cannot find module './InlineResult'`

- [ ] **Step 3: Create ai-types.ts**

```typescript
import type { components } from "@shared/api"

export type CrosstabResponse = components["schemas"]["CrosstabResponse"]
export type TrendResponse = components["schemas"]["TrendResponse"]

export interface AICrosstabResultPart {
  type: "crosstab_result"
  query_config: Record<string, unknown>
  data: CrosstabResponse
}

export interface AITrendResultPart {
  type: "trend_result"
  query_config: Record<string, unknown>
  data: TrendResponse
}
```

- [ ] **Step 4: Create InlineResult.tsx**

```typescript
"use client"
import Link from "next/link"
import { AnalyticsChart } from "@/components/analytics/AnalyticsChart"
import type { AnalyticsResult } from "@/app/analytics/analytics-types"
import type { AICrosstabResultPart, AITrendResultPart } from "./ai-types"

type ResultPart = AICrosstabResultPart | AITrendResultPart

interface Props {
  part: ResultPart
}

export function buildAnalyticsUrl(
  queryConfig: Record<string, unknown>,
  type: "crosstab" | "trend",
): string {
  const params = new URLSearchParams()
  params.set("mode", type)

  if (type === "crosstab") {
    const ds = queryConfig.dataset_id as number | undefined
    if (ds) params.set("ds", String(ds))
    const rows = queryConfig.rows as unknown[] | undefined
    if (rows?.length) params.set("rows", JSON.stringify(rows))
    const cols = queryConfig.columns as unknown[] | undefined
    if (cols?.length) params.set("cols", JSON.stringify(cols))
    const rowMode = queryConfig.row_mode as string | undefined
    if (rowMode && rowMode !== "stacked") params.set("row_mode", rowMode)
    const colMode = queryConfig.col_mode as string | undefined
    if (colMode && colMode !== "stacked") params.set("col_mode", colMode)
  } else {
    const col = queryConfig.collection_id as number | undefined
    if (col) params.set("col", String(col))
    const fields = queryConfig.fields as unknown[] | undefined
    if (fields?.length) params.set("rows", JSON.stringify(fields))
    const bd = queryConfig.breakdown as { field_key: string } | null | undefined
    if (bd) params.set("bd", bd.field_key)
  }

  const measure = queryConfig.measure as Record<string, unknown> | undefined
  if (measure) {
    params.set("mt", String(measure.type ?? "count"))
    params.set("md", String(measure.display ?? "n"))
    if (measure.field_key) params.set("mf", String(measure.field_key))
    if (measure.aggregation) params.set("ma", String(measure.aggregation))
  }

  return `/analytics?${params.toString()}`
}

export function InlineResult({ part }: Props) {
  const result = part.data as AnalyticsResult
  const type = part.type === "crosstab_result" ? "crosstab" : "trend"
  const chartType = type === "trend" ? "line" : "grouped_bar"
  const analyticsUrl = buildAnalyticsUrl(part.query_config, type)

  return (
    <div
      data-testid="inline-result"
      className="rounded-md border border-border bg-card p-3 flex flex-col gap-2"
    >
      <div className="text-xs text-muted-foreground">
        {type === "crosstab"
          ? `${result.meta.dataset_name ?? "Dataset"} — ${result.meta.base_n ?? 0} respondents`
          : `${result.meta.collection_name ?? "Collection"} — ${result.meta.base_n ?? 0} respondents`}
      </div>
      <div className="h-48">
        <AnalyticsChart result={result} chartType={chartType} />
      </div>
      <Link
        href={analyticsUrl}
        className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Open in Analytics →
      </Link>
    </div>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
just test-web -t "buildAnalyticsUrl"
```
Expected: 3 tests PASS.

- [ ] **Step 6: Create InlineResult.stories.tsx**

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { InlineResult } from "./InlineResult"

const crosstabPart = {
  type: "crosstab_result" as const,
  query_config: {
    dataset_id: 1,
    rows: [{ field_key: "gender" }],
    columns: [],
    row_mode: "stacked",
    col_mode: "stacked",
    filters: [],
    measure: { type: "count", display: "pct_col", field_key: null, aggregation: null },
  },
  data: {
    meta: {
      mode: "crosstab",
      row_fields: [{ field_key: "gender", display_name: "Gender" }],
      col_fields: [],
      row_mode: "stacked",
      col_mode: "stacked",
      measure: { type: "count", display: "pct_col" },
      dataset_name: "Brand Tracker Wave 1",
      base_n: 1200,
      level_labels: { gender: { M: "Male", F: "Female" } },
    },
    rows: [
      { key: ["M"], values: { Total: 52.0 } },
      { key: ["F"], values: { Total: 48.0 } },
    ],
  },
}

const trendPart = {
  type: "trend_result" as const,
  query_config: {
    collection_id: 1,
    fields: [{ field_key: "brand_awareness" }],
    breakdown: null,
    filters: [],
    measure: { type: "count", display: "pct_col", field_key: null, aggregation: null },
  },
  data: {
    meta: {
      mode: "trend",
      fields: [{ field_key: "brand_awareness", display_name: "Brand Awareness" }],
      breakdown: null,
      measure: { type: "count", display: "pct_col" },
      collection_name: "Brand Tracker",
      base_n: 4800,
      level_labels: { brand_awareness: { "1": "Yes", "0": "No" } },
    },
    rows: [
      { key: ["Wave 1", "brand_awareness", "1"], values: { Total: 42.0 } },
      { key: ["Wave 2", "brand_awareness", "1"], values: { Total: 51.0 } },
      { key: ["Wave 3", "brand_awareness", "1"], values: { Total: 59.0 } },
      { key: ["Wave 4", "brand_awareness", "1"], values: { Total: 67.0 } },
    ],
  },
}

const meta = {
  component: InlineResult,
} satisfies Meta<typeof InlineResult>

export default meta
type Story = StoryObj<typeof meta>

export const CrosstabResult: Story = { args: { part: crosstabPart } }
export const TrendResult: Story = { args: { part: trendPart } }
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/ai/ai-types.ts apps/web/src/app/ai/InlineResult.tsx
git add apps/web/src/app/ai/InlineResult.stories.tsx apps/web/src/app/ai/InlineResult.test.tsx
```
Write `/tmp/commit-msg.txt`:
```
feat(web): add InlineResult component with Open in Analytics link
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 12: Build MessageList component

**Files:**
- Create: `apps/web/src/app/ai/MessageList.tsx`
- Create: `apps/web/src/app/ai/MessageList.stories.tsx`

- [ ] **Step 1: Create MessageList.tsx**

```typescript
"use client"
import { useEffect, useRef } from "react"
import type { Message } from "@ai-sdk/react"
import { AssistantMessage } from "./AssistantMessage"
import { MessageBubble } from "./MessageBubble"

interface Props {
  messages: Message[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div
        data-testid="message-list-empty"
        className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
      >
        Ask a question to get started.
      </div>
    )
  }

  return (
    <div
      data-testid="message-list"
      className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
    >
      {messages.map((msg) =>
        msg.role === "user" ? (
          <MessageBubble key={msg.id} role="user" content={msg.content} />
        ) : (
          <MessageBubble
            key={msg.id}
            role="assistant"
            content={<AssistantMessage message={msg} />}
          />
        ),
      )}
      {isLoading && (
        <MessageBubble
          role="assistant"
          content={
            <span className="text-muted-foreground text-sm italic">Thinking…</span>
          }
        />
      )}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 2: Create MessageList.stories.tsx**

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { MessageList } from "./MessageList"

const messages = [
  { id: "1", role: "user" as const, content: "How has brand awareness changed?" },
  { id: "2", role: "assistant" as const, content: "Brand awareness rose from 42% to 67% between Wave 1 and Wave 4.", annotations: [] },
  { id: "3", role: "user" as const, content: "Break it down by gender." },
]

const meta = {
  component: MessageList,
  args: { isLoading: false },
} satisfies Meta<typeof MessageList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = { args: { messages: [] } }
export const WithMessages: Story = { args: { messages } }
export const Loading: Story = { args: { messages, isLoading: true } }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/ai/MessageList.tsx apps/web/src/app/ai/MessageList.stories.tsx
```
Write `/tmp/commit-msg.txt`:
```
feat(web): add MessageList component for AI chat
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 13: Build AIChatPage and page.tsx

**Files:**
- Create: `apps/web/src/app/ai/AIChatPage.tsx`
- Create: `apps/web/src/app/ai/AIChatPage.stories.tsx`
- Create: `apps/web/src/app/ai/page.tsx`

- [ ] **Step 1: Create AIChatPage.tsx**

```typescript
"use client"
import { useChat } from "@ai-sdk/react"
import type { FormEvent } from "react"
import { ChatInput } from "./ChatInput"
import { MessageList } from "./MessageList"

export function AIChatPage() {
  const { messages, input, handleSubmit, setInput, isLoading, error } = useChat({
    api: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/chat`,
    streamProtocol: "data",
  })

  function handleInputChange(value: string) {
    setInput(value)
  }

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    handleSubmit(e)
  }

  return (
    <div
      data-testid="ai-chat-page"
      className="flex h-full flex-col"
    >
      {error && (
        <div className="border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Something went wrong. Please try again.
        </div>
      )}
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={handleInputChange}
        onSubmit={handleFormSubmit}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create AIChatPage.stories.tsx**

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AIChatPage } from "./AIChatPage"

const meta = {
  component: AIChatPage,
} satisfies Meta<typeof AIChatPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
```

- [ ] **Step 3: Create apps/web/src/app/ai/page.tsx**

Follow the same feature-flag pattern as the analytics page:

```typescript
"use client"
import { useFeatureFlag } from "@posthog/next"
import { notFound } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { AIChatPage } from "./AIChatPage"

const loadingFallback = (
  <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground text-sm">Loading…</p>
  </div>
)

function AIPageInner() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const showAI = useFeatureFlag("ai-interface")

  if (!mounted) return loadingFallback
  if (showAI === undefined) return loadingFallback
  if (!showAI.enabled) notFound()
  return <AIChatPage />
}

export default function AIPage() {
  return (
    <Suspense fallback={loadingFallback}>
      <AIPageInner />
    </Suspense>
  )
}
```

- [ ] **Step 4: Run typecheck**

```bash
just typecheck 2>&1 | grep "ai/" | head -10
```

Fix any type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/ai/AIChatPage.tsx apps/web/src/app/ai/AIChatPage.stories.tsx apps/web/src/app/ai/page.tsx
```
Write `/tmp/commit-msg.txt`:
```
feat(web): add AIChatPage component and /ai route
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 14: Add "AI" nav link to TopNav

**Files:**
- Modify: `apps/web/src/components/ui/top-nav.tsx`

- [ ] **Step 1: Add "AI" to NAV_LINKS**

In `apps/web/src/components/ui/top-nav.tsx`, change:

```typescript
const NAV_LINKS = [{ href: "/analytics", label: "Analytics" }]
```

to:

```typescript
const NAV_LINKS = [
  { href: "/analytics", label: "Analytics" },
  { href: "/ai", label: "AI" },
]
```

- [ ] **Step 2: Run typecheck and tests**

```bash
just typecheck 2>&1 | tail -5
just test-web 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/top-nav.tsx
```
Write `/tmp/commit-msg.txt`:
```
feat(web): add AI nav link to TopNav
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Task 15: Update AssistantMessage stub types + final typecheck

After Task 11 created `ai-types.ts`, replace the stub in `AssistantMessage.tsx` if it was used.

**Files:**
- Modify: `apps/web/src/app/ai/AssistantMessage.tsx` — remove stub import if present

- [ ] **Step 1: Verify AssistantMessage.tsx imports from ai-types.ts (not a local stub)**

Open `apps/web/src/app/ai/AssistantMessage.tsx` and confirm the import is:
```typescript
import type { AICrosstabResultPart, AITrendResultPart } from "./ai-types"
```

If a stub `ai-types.ts` was created earlier in a different location, delete it.

- [ ] **Step 2: Run full typecheck**

```bash
just typecheck
```

Expected: clean.

- [ ] **Step 3: Run all tests**

```bash
just test
```

Expected: all pass.

- [ ] **Step 4: Update ROADMAP.md**

In `docs/ROADMAP.md`, change:
```markdown
| 7 | AI Interface | ⏳ Pending | — | — |
```
to:
```markdown
| 7 | AI Interface | ✅ Complete | — | [plan](superpowers/plans/2026-04-19-ai-interface.md) |
```

- [ ] **Step 5: Commit**

```bash
git add docs/ROADMAP.md
```
Write `/tmp/commit-msg.txt`:
```
feat(web): complete AI interface — /ai page with streaming PydanticAI agent
```
```bash
git commit -F /tmp/commit-msg.txt
```

---

## Self-Review Notes

- Streaming endpoint uses `response_class=StreamingResponse` with no `response_model=` — acceptable exception documented in `backend.md` ("routes that intentionally return arbitrary JSON/stream"). The `ai` tag is excluded from MCP tools in `main.py`.
- `buildAnalyticsUrl` uses the exact nuqs short keys from `useAnalyticsState.ts`: `ds`, `col`, `rows`, `cols`, `row_mode`, `col_mode`, `bd`, `mt`, `md`, `mf`, `ma`.
- All tool implementations are extracted as `_*_impl` functions so tests call them directly without needing a real LLM.
- PydanticAI streaming API: check that `result.stream_text(delta=True)` matches the installed version in Task 4 Step 4.
- The `useFeatureFlag` pattern follows the existing analytics page: check `.enabled` property.
