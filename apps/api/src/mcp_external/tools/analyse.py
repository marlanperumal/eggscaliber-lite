from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request

from src.auth import CurrentUser, _get_accessible_package_ids
from src.database import SessionLocal
from src.models.analytics import (
    CrosstabRequest,
    FieldSelection,
    MeasureSpec,
    TrendRequest,
)
from src.services import analytics_service
from src.services.analytics_service import assert_dataset_accessible


def _user() -> CurrentUser:
    return get_http_request().state.current_user


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    async def describe_field_tree(dataset_id: int) -> dict:
        """Get the full field tree for a dataset: field keys, display names, types, and groups.
        Use this before run_crosstab to discover valid field_key values."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            await assert_dataset_accessible(session, dataset_id, accessible_ids)
            tree = await analytics_service.get_field_tree(session, dataset_id)
        return tree.model_dump()

    @mcp.tool()
    async def run_crosstab(
        dataset_id: int,
        row_field_keys: list[str],
        column_field_keys: list[str],
        measure_type: str = "count",
        display: str = "pct_col",
        row_mode: str = "stacked",
        col_mode: str = "stacked",
    ) -> dict:
        """Run a cross-tabulation. Returns a table of row × column frequencies.
        measure_type: 'count' | 'weighted'. display: 'pct_col' | 'pct_row' | 'n'.
        row_mode / col_mode: 'stacked' | 'nested'. Use describe_field_tree to find field_keys."""
        user = _user()
        request = CrosstabRequest(
            dataset_id=dataset_id,
            rows=[FieldSelection(field_key=k) for k in row_field_keys],
            columns=[FieldSelection(field_key=k) for k in column_field_keys],
            row_mode=row_mode,  # type: ignore[arg-type]
            col_mode=col_mode,  # type: ignore[arg-type]
            measure=MeasureSpec(type=measure_type, display=display),  # type: ignore[arg-type]
        )
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            result = await analytics_service.run_crosstab(session, request, accessible_ids)
        return result.model_dump()

    @mcp.tool()
    async def run_trend(
        collection_id: int,
        field_keys: list[str],
        measure_type: str = "count",
        display: str = "pct_col",
    ) -> dict:
        """Track how a field's distribution changes across datasets in a collection over time.
        Use list_datasets to confirm the collection has multiple datasets before calling."""
        user = _user()
        request = TrendRequest(
            collection_id=collection_id,
            fields=[FieldSelection(field_key=k) for k in field_keys],
            measure=MeasureSpec(type=measure_type, display=display),  # type: ignore[arg-type]
        )
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            result = await analytics_service.run_trend(session, request, accessible_ids)
        return result.model_dump()
