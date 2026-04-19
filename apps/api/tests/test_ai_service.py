import pytest_asyncio
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.level import Level
from src.models.package import Package
from src.models.response import Response


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
        payload={"gender": "M"},
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
        assert isinstance(result, str)


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

        assert isinstance(text, str)
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
