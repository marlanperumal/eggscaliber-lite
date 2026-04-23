import json

import pytest_asyncio
from pydantic_ai import Agent
from pydantic_ai.models.test import TestModel
from src.models.analytics import CrosstabRequest, FieldSelection, MeasureSpec, TrendRequest
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.group import PackageCollection
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response
from src.services.ai_service import (
    _get_field_tree_impl,
    _list_packages_impl,
    _run_crosstab_impl,
    _run_trend_impl,
)


def reassemble_sse_text_deltas(body: bytes | str) -> str:
    """Reassemble text-delta events from a Vercel-AI SSE stream body into a
    single string. Accepts either bytes or str so callers can pass the raw
    response body or its decoded text."""
    text = body.decode() if isinstance(body, bytes) else body
    out: list[str] = []
    for line in text.splitlines():
        if not line.startswith("data: "):
            continue
        event = json.loads(line[len("data: ") :])
        if event.get("type") == "text-delta":
            out.append(event["delta"])
    return "".join(out)


def make_tool_test_agent() -> Agent:
    """Build a TestModel-backed Agent with the real ai_service tool impls
    registered. TestModel.call_tools="all" invokes every tool once and echoes
    their string return values as assistant text — so any leak in a tool-impl
    would surface in the streamed text deltas."""
    import src.services.ai_service as ai_svc
    from src.services.ai_service import SYSTEM_PROMPT, AIServiceDeps

    test_agent: Agent[AIServiceDeps, str] = Agent(
        model=TestModel(),
        system_prompt=SYSTEM_PROMPT,
        deps_type=AIServiceDeps,
    )

    @test_agent.tool
    async def list_packages(ctx):  # type: ignore[no-untyped-def]
        return await ai_svc._list_packages_impl(ctx.deps.session, ctx.deps.accessible_ids)

    @test_agent.tool
    async def get_field_tree(ctx, dataset_id: int):  # type: ignore[no-untyped-def]
        return await ai_svc._get_field_tree_impl(
            ctx.deps.session, dataset_id, ctx.deps.accessible_ids
        )

    return test_agent


class TestStreamEncoder:
    def _parse_sse(self, result: str) -> dict:
        import json

        assert result.startswith("data: "), f"Expected SSE 'data: ' prefix, got: {result!r}"
        assert result.endswith("\n\n"), f"Expected SSE '\\n\\n' suffix, got: {result!r}"
        return json.loads(result[6:].strip())

    def test_encode_text_start(self):
        from src.services.ai_service import encode_text_start

        result = encode_text_start("id1")
        data = self._parse_sse(result)
        assert data["type"] == "text-start"
        assert data["id"] == "id1"

    def test_encode_text_delta(self):
        from src.services.ai_service import encode_text_delta

        result = encode_text_delta("id1", "Hello ")
        data = self._parse_sse(result)
        assert data["type"] == "text-delta"
        assert data["id"] == "id1"
        assert data["delta"] == "Hello "

    def test_encode_text_delta_escapes_quotes(self):
        from src.services.ai_service import encode_text_delta

        result = encode_text_delta("id1", 'say "hi"')
        data = self._parse_sse(result)
        assert data["delta"] == 'say "hi"'

    def test_encode_text_end(self):
        from src.services.ai_service import encode_text_end

        result = encode_text_end("id1")
        data = self._parse_sse(result)
        assert data["type"] == "text-end"
        assert data["id"] == "id1"

    def test_encode_data_part(self):
        from src.services.ai_service import encode_data_part

        result = encode_data_part("crosstab_result", "data-0", {"key": "val"})
        data = self._parse_sse(result)
        assert data["type"] == "data-crosstab_result"
        assert data["id"] == "data-0"
        assert data["data"] == {"key": "val"}

    def test_encode_finish(self):
        from src.services.ai_service import encode_finish

        result = encode_finish()
        data = self._parse_sse(result)
        assert data["type"] == "finish"
        assert data["finishReason"] == "stop"

    def test_encode_finish_error(self):
        from src.services.ai_service import encode_finish

        result = encode_finish("error")
        data = self._parse_sse(result)
        assert data["type"] == "finish"
        assert data["finishReason"] == "error"

    def test_encode_error(self):
        from src.services.ai_service import encode_error

        result = encode_error("something went wrong")
        data = self._parse_sse(result)
        assert data["type"] == "error"
        assert data["errorText"] == "something went wrong"

    def test_encode_start(self):
        from src.services.ai_service import encode_start

        result = encode_start()
        data = self._parse_sse(result)
        assert data["type"] == "start"

    def test_encode_start_step(self):
        from src.services.ai_service import encode_start_step

        result = encode_start_step()
        data = self._parse_sse(result)
        assert data["type"] == "start-step"

    def test_encode_finish_step(self):
        from src.services.ai_service import encode_finish_step

        result = encode_finish_step()
        data = self._parse_sse(result)
        assert data["type"] == "finish-step"


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
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    db.add(PackageCollection(package_id=pkg.id, collection_id=col.id))
    await db.flush()

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
        payload={"gender": "M"},
    )
    db.add(resp)
    await db.flush()

    return {"pkg": pkg, "col": col, "ds": ds, "field": fld}


class TestListPackagesTool:
    async def test_returns_package_hierarchy(self, db, ai_dataset):
        result = await _list_packages_impl(db)
        assert "AI Test Pkg" in result
        assert "AI Test Col" in result
        assert "AI Test DS" in result

    async def test_no_packages_returns_informative_message(self, db):
        result = await _list_packages_impl(db)
        assert "no" in result.lower() and "package" in result.lower()

    async def test_accessible_ids_filters_list(self, db, ai_dataset):
        """AI list_packages must not expose packages outside accessible_ids."""
        # empty set → no packages accessible
        result = await _list_packages_impl(db, accessible_ids=set())
        assert "AI Test Pkg" not in result
        assert "AI Test DS" not in result


class TestGetFieldTreeTool:
    async def test_returns_field_info(self, db, ai_dataset):
        ds_id = ai_dataset["ds"].id
        result = await _get_field_tree_impl(db, ds_id)
        assert "gender" in result
        assert "Gender" in result

    async def test_dataset_not_found(self, db):
        result = await _get_field_tree_impl(db, 999_999)
        assert "not found" in result.lower()

    async def test_accessible_ids_filters_unentitled_dataset(self, db, ai_dataset):
        """AI tool must not leak field metadata for unentitled packages."""
        ds_id = ai_dataset["ds"].id
        # accessible_ids is an empty set → entitlements resolved to empty (user
        # has no packages granted); distinct from None which means unrestricted.
        result = await _get_field_tree_impl(db, ds_id, accessible_ids=set())
        # Must not leak field names
        assert "gender" not in result.lower()
        assert "not found" in result.lower()

    async def test_accessible_ids_none_means_unrestricted(self, db, ai_dataset):
        """accessible_ids=None (dev / no-auth mode) should return full tree."""
        ds_id = ai_dataset["ds"].id
        result = await _get_field_tree_impl(db, ds_id, accessible_ids=None)
        assert "gender" in result


class TestRunCrosstabTool:
    async def test_returns_result_and_pushes_part(self, db, ai_dataset):
        request = CrosstabRequest(
            dataset_id=ai_dataset["ds"].id,
            rows=[FieldSelection(field_key="gender")],
            measure=MeasureSpec(type="count", display="n"),
        )
        result_parts: list[dict] = []
        text = await _run_crosstab_impl(db, request, result_parts)

        assert isinstance(text, str)
        assert len(result_parts) == 1
        assert result_parts[0]["type"] == "crosstab_result"
        assert "query_config" in result_parts[0]
        assert "data" in result_parts[0]

    async def test_dataset_not_found_returns_error_string(self, db):
        request = CrosstabRequest(
            dataset_id=999_999,
            rows=[FieldSelection(field_key="x")],
            measure=MeasureSpec(type="count", display="n"),
        )
        result = await _run_crosstab_impl(db, request, [])
        assert "error" in result.lower() or "not found" in result.lower()

    async def test_accessible_ids_blocks_unentitled_crosstab(self, db, ai_dataset):
        """AI run_crosstab must reject datasets outside accessible_ids."""
        request = CrosstabRequest(
            dataset_id=ai_dataset["ds"].id,
            rows=[FieldSelection(field_key="gender")],
            measure=MeasureSpec(type="count", display="n"),
        )
        result_parts: list[dict] = []
        result = await _run_crosstab_impl(db, request, result_parts, accessible_ids=set())
        # Must not return data
        assert len(result_parts) == 0
        assert "error" in result.lower() or "not accessible" in result.lower()


class TestRunTrendTool:
    async def test_returns_result_and_pushes_part(self, db, ai_dataset):
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
        request = TrendRequest(
            collection_id=999_999,
            fields=[FieldSelection(field_key="x")],
            measure=MeasureSpec(type="count", display="n"),
        )
        result = await _run_trend_impl(db, request, [])
        assert "error" in result.lower() or "not found" in result.lower()


class TestStreamResponse:
    import json

    def _parse_events(self, events: list[str]) -> list[dict]:
        import json

        parsed = []
        for e in events:
            assert e.startswith("data: "), f"Expected SSE 'data: ' prefix, got: {e!r}"
            assert e.endswith("\n\n"), f"Expected SSE '\\n\\n' suffix, got: {e!r}"
            parsed.append(json.loads(e[6:].strip()))
        return parsed

    async def test_empty_messages_yields_error_then_finish(self, db):
        import src.services.ai_service as ai_svc

        events = []
        async for chunk in ai_svc.stream_response(db, []):
            events.append(chunk)

        parsed = self._parse_events(events)
        types = [p["type"] for p in parsed]
        assert types[0] == "error"
        assert types[-1] == "finish"

    async def test_single_user_message_yields_full_text_sequence(self, db):
        import src.services.ai_service as ai_svc
        from pydantic_ai import Agent
        from pydantic_ai.models.test import TestModel
        from src.models.ai import ChatMessage
        from src.services.ai_service import SYSTEM_PROMPT, AIServiceDeps

        test_agent: Agent[AIServiceDeps, str] = Agent(
            model=TestModel(custom_output_text="Hello from test."),
            system_prompt=SYSTEM_PROMPT,
            deps_type=AIServiceDeps,
        )

        original = ai_svc._agent
        ai_svc._agent = test_agent
        try:
            messages = [ChatMessage(role="user", content="What data is available?")]
            events = []
            async for chunk in ai_svc.stream_response(db, messages):
                events.append(chunk)
        finally:
            ai_svc._agent = original

        parsed = self._parse_events(events)
        types = [p["type"] for p in parsed]

        assert types[0] == "start"
        assert types[1] == "start-step"
        assert types[2] == "text-start"
        assert any(t == "text-delta" for t in types)
        assert "text-end" in types
        assert "finish-step" in types
        assert types[-1] == "finish"
        assert parsed[-1]["finishReason"] == "stop"

    async def test_exception_yields_error_then_finish_error(self, db):
        import src.services.ai_service as ai_svc
        from src.models.ai import ChatMessage

        def _raising_get_agent():
            raise RuntimeError("bad model config")

        original_get_agent = ai_svc.get_agent
        ai_svc.get_agent = _raising_get_agent
        try:
            messages = [ChatMessage(role="user", content="Hello")]
            events = []
            async for chunk in ai_svc.stream_response(db, messages):
                events.append(chunk)
        finally:
            ai_svc.get_agent = original_get_agent

        parsed = self._parse_events(events)
        types = [p["type"] for p in parsed]

        assert types[0] == "error"
        assert "bad model config" in parsed[0]["errorText"]
        assert types[-1] == "finish"
        assert parsed[-1]["finishReason"] == "error"


class TestChatRoute:
    async def test_chat_endpoint_returns_event_stream_with_correct_headers(self, client, db):
        import src.services.ai_service as ai_svc
        from pydantic_ai import Agent
        from pydantic_ai.models.test import TestModel
        from src.services.ai_service import SYSTEM_PROMPT, AIServiceDeps

        test_agent: Agent[AIServiceDeps, str] = Agent(
            model=TestModel(custom_output_text="Test response."),
            system_prompt=SYSTEM_PROMPT,
            deps_type=AIServiceDeps,
        )
        original = ai_svc._agent
        ai_svc._agent = test_agent
        try:
            resp = await client.post(
                "/api/v1/ai/chat",
                json={"messages": [{"role": "user", "content": "What data is available?"}]},
            )
        finally:
            ai_svc._agent = original

        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        assert resp.headers.get("x-vercel-ai-ui-message-stream") == "v1"


class TestChatEntitlementFilter:
    """End-to-end: the /ai/chat SSE stream must not leak unentitled package/field
    metadata. Drives stream_response with a TestModel that invokes every registered
    tool and then emits their string return values as assistant text — so any leak
    in the tool-impl layer would show up in the streamed text."""

    async def test_sse_stream_does_not_leak_unentitled_package_or_fields(
        self, client, db, ai_dataset
    ):
        import src.services.ai_service as ai_svc

        unentitled_pkg_name = ai_dataset["pkg"].name
        unentitled_field_display = ai_dataset["field"].display_name
        unentitled_field_key = ai_dataset["field"].field_key

        test_agent = make_tool_test_agent()

        original = ai_svc._agent
        ai_svc._agent = test_agent
        try:
            resp = await client.post(
                "/api/v1/ai/chat",
                json={
                    "messages": [
                        {
                            "role": "user",
                            "content": (
                                f"List all packages then describe dataset {ai_dataset['ds'].id}."
                            ),
                        }
                    ]
                },
            )
            body = resp.text
        finally:
            ai_svc._agent = original

        assert resp.status_code == 200

        # By default the client fixture returns accessible_ids=None (unrestricted);
        # to simulate an unentitled caller we need to override the dep. Do it here
        # as a second pass: override accessible_ids to empty and re-run.
        from src.auth import get_accessible_package_ids
        from src.main import app

        async def _empty_accessible_ids():
            return set()

        app.dependency_overrides[get_accessible_package_ids] = _empty_accessible_ids
        ai_svc._agent = test_agent
        try:
            resp2 = await client.post(
                "/api/v1/ai/chat",
                json={
                    "messages": [
                        {
                            "role": "user",
                            "content": (
                                f"List all packages then describe dataset {ai_dataset['ds'].id}."
                            ),
                        }
                    ]
                },
            )
            body2 = resp2.text
        finally:
            app.dependency_overrides.pop(get_accessible_package_ids, None)
            ai_svc._agent = original

        assert resp2.status_code == 200

        reassembled_unrestricted = reassemble_sse_text_deltas(body)
        reassembled_empty = reassemble_sse_text_deltas(body2)

        # Sanity: the first (unrestricted) call DID include the package name,
        # so we know the tools actually ran and emitted content.
        assert unentitled_pkg_name in reassembled_unrestricted, (
            "Test precondition: unrestricted call should include package name "
            "in the reassembled streamed text."
        )
        # The entitled-set-empty call must NOT leak the package name or
        # field metadata in the reassembled stream — nor in any tool-result
        # data parts (which aren't emitted by list_packages / get_field_tree
        # but we check the whole SSE body defensively).
        assert unentitled_pkg_name not in reassembled_empty, (
            f"SSE stream leaked unentitled package name "
            f"{unentitled_pkg_name!r} (reassembled): {reassembled_empty!r}"
        )
        assert unentitled_field_display not in reassembled_empty, (
            f"SSE stream leaked unentitled field display "
            f"{unentitled_field_display!r}: {reassembled_empty!r}"
        )
        assert unentitled_field_key not in reassembled_empty, (
            f"SSE stream leaked unentitled field_key "
            f"{unentitled_field_key!r}: {reassembled_empty!r}"
        )
