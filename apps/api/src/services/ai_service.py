import json
import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field

from pydantic_ai import Agent, RunContext
from pydantic_ai._agent_graph import ModelRequestNode
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, UserPromptPart
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.errors import CollectionNotFoundError, DatasetNotFoundError, ForbiddenError
from src.models.ai import AICrosstabResultPart, AITrendResultPart, ChatMessage
from src.models.analytics import CrosstabRequest, TrendRequest
from src.services import analytics_service, package_service

# ── Stream encoding ────────────────────────────────────────────────────────────


def _sse(data: dict) -> str:
    """Encode a single SSE event."""
    return f"data: {json.dumps(data)}\n\n"


def encode_text_start(msg_id: str) -> str:
    return _sse({"type": "text-start", "id": msg_id})


def encode_text_delta(msg_id: str, delta: str) -> str:
    return _sse({"type": "text-delta", "id": msg_id, "delta": delta})


def encode_text_end(msg_id: str) -> str:
    return _sse({"type": "text-end", "id": msg_id})


def encode_start() -> str:
    return _sse({"type": "start"})


def encode_start_step() -> str:
    return _sse({"type": "start-step"})


def encode_finish_step() -> str:
    return _sse({"type": "finish-step"})


def encode_data_part(data_type: str, data_id: str, data: dict) -> str:
    """Encode a custom data part (e.g. crosstab_result, trend_result)."""
    return _sse({"type": f"data-{data_type}", "id": data_id, "data": data})


def encode_finish(finish_reason: str = "stop") -> str:
    return _sse({"type": "finish", "finishReason": finish_reason})


def encode_error(message: str) -> str:
    return _sse({"type": "error", "errorText": message})


# ── Tool implementation functions (called by agent tools and tested directly) ──


async def _list_packages_impl(session: AsyncSession, accessible_ids: set[int] | None = None) -> str:
    packages = await package_service.get_scope(session)
    if accessible_ids is not None:
        packages = [p for p in packages if p.id in accessible_ids]
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


async def _get_field_tree_impl(
    session: AsyncSession,
    dataset_id: int,
    accessible_ids: set[int] | None = None,
) -> str:
    try:
        await analytics_service.assert_dataset_accessible(session, dataset_id, accessible_ids)
        tree = await analytics_service.get_field_tree(session, dataset_id)
    except DatasetNotFoundError:
        return f"Dataset {dataset_id} not found."
    except ForbiddenError:
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
    accessible_ids: set[int] | None = None,
) -> str:
    try:
        result = await analytics_service.run_crosstab(session, request, accessible_ids)
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
    accessible_ids: set[int] | None = None,
) -> str:
    try:
        result = await analytics_service.run_trend(session, request, accessible_ids)
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
    accessible_ids: set[int] | None = None
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


def _build_agent() -> "Agent[AIServiceDeps, str]":
    agent: Agent[AIServiceDeps, str] = Agent(
        model=settings.ai_model,
        system_prompt=SYSTEM_PROMPT,
        deps_type=AIServiceDeps,
    )

    @agent.tool
    async def list_packages(ctx: RunContext[AIServiceDeps]) -> str:
        """List all available data packages, collections, and datasets with their IDs."""
        return await _list_packages_impl(ctx.deps.session, ctx.deps.accessible_ids)

    @agent.tool
    async def get_field_tree(ctx: RunContext[AIServiceDeps], dataset_id: int) -> str:
        """Get all fields available in a dataset. Call this before constructing a query."""
        return await _get_field_tree_impl(ctx.deps.session, dataset_id, ctx.deps.accessible_ids)

    @agent.tool
    async def run_crosstab(ctx: RunContext[AIServiceDeps], request: CrosstabRequest) -> str:
        """Run a cross-tabulation query on a dataset."""
        return await _run_crosstab_impl(
            ctx.deps.session, request, ctx.deps.result_parts, ctx.deps.accessible_ids
        )

    @agent.tool
    async def run_trend(ctx: RunContext[AIServiceDeps], request: TrendRequest) -> str:
        """Run a trend query across datasets in a collection."""
        return await _run_trend_impl(
            ctx.deps.session, request, ctx.deps.result_parts, ctx.deps.accessible_ids
        )

    return agent


_agent: "Agent[AIServiceDeps, str] | None" = None


def get_agent() -> "Agent[AIServiceDeps, str]":
    global _agent
    if _agent is None:
        _agent = _build_agent()
    return _agent


# ── Message history conversion ─────────────────────────────────────────────────


def _to_model_messages(messages: list[ChatMessage]) -> list[ModelMessage]:
    result: list[ModelMessage] = []
    for msg in messages:
        if msg.role == "user":
            result.append(ModelRequest(parts=[UserPromptPart(content=msg.get_text())]))
        elif msg.role == "assistant":
            result.append(ModelResponse(parts=[TextPart(content=msg.get_text())]))
    return result


# ── Public streaming function ──────────────────────────────────────────────────


async def stream_response(
    session: AsyncSession,
    messages: list[ChatMessage],
    accessible_ids: set[int] | None = None,
) -> AsyncGenerator[str, None]:
    if not messages:
        yield encode_error("No messages provided.")
        yield encode_finish()
        return

    deps = AIServiceDeps(session=session, accessible_ids=accessible_ids)
    message_history = _to_model_messages(messages[:-1])
    user_prompt = messages[-1].get_text()
    text_id = str(uuid.uuid4())

    try:
        agent = get_agent()
        yield encode_start()
        yield encode_start_step()
        yield encode_text_start(text_id)

        # Use iter() so tool calls are fully executed before the final text is streamed.
        # run_stream() stops at the first text output (treating it as final), which causes
        # intermediate "Let me check..." text to be returned instead of the tool results.
        async with agent.iter(user_prompt, message_history=message_history, deps=deps) as agent_run:
            async for node in agent_run:
                if isinstance(node, ModelRequestNode):
                    async with node.stream(agent_run.ctx) as agent_stream:
                        async for chunk in agent_stream.stream_text(delta=True, debounce_by=None):
                            yield encode_text_delta(text_id, chunk)

        yield encode_text_end(text_id)

        for i, part in enumerate(deps.result_parts):
            data_type = part["type"]
            yield encode_data_part(data_type, f"data-{i}", part)

        yield encode_finish_step()
        yield encode_finish()
    except Exception as e:
        yield encode_error(str(e))
        yield encode_finish("error")
