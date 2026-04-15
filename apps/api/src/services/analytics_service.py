from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import CollectionNotFoundError, DatasetNotFoundError
from src.models.analytics import (
    CrosstabMeta,
    CrosstabRequest,
    CrosstabResponse,
    FieldTreeFieldOut,
    FieldTreeGroupOut,
    FieldTreeOut,
    MetaField,
    ResultRow,
    TrendMeta,
    TrendRequest,
    TrendResponse,
)
from src.models.dataset import FieldOut
from src.models.field import Field
from src.models.field_group import FieldGroup
from src.repositories import analytics_repo, collection_repo
from src.services import crosstab_service, trend_service
from src.workers.factory import WorkerFactory


async def run_crosstab(session: AsyncSession, request: CrosstabRequest) -> CrosstabResponse:
    dataset = await analytics_repo.get_dataset(session, request.dataset_id)
    if dataset is None:
        raise DatasetNotFoundError(request.dataset_id)

    row_keys = [f.field_key for f in request.rows]
    col_keys = [f.field_key for f in request.columns]
    filter_keys = [f.field_key for f in request.filters]
    extra_keys = []
    if request.measure.type in ("weighted", "value_field") and request.measure.field_key:
        extra_keys.append(request.measure.field_key)
    all_keys = list(set(row_keys + col_keys + filter_keys + extra_keys))

    field_metas = await analytics_repo.get_field_metas(session, request.dataset_id, all_keys)

    worker = WorkerFactory.for_dataset(dataset, session)
    data = await worker.fetch(request.dataset_id, all_keys, {})

    filters_raw = [f.model_dump() for f in request.filters]
    data = crosstab_service.apply_filters(data, filters_raw, field_metas)
    base_n = len(data)

    row_metas = [{"field_key": k, **field_metas[k]} for k in row_keys if k in field_metas]
    col_metas = [{"field_key": k, **field_metas[k]} for k in col_keys if k in field_metas]
    measure_dict = request.measure.model_dump()

    if request.row_mode == "nested" and len(row_metas) >= 2:
        raw_rows = crosstab_service.aggregate_nested(data, row_metas, col_metas, measure_dict)
    else:
        raw_rows = crosstab_service.aggregate_stacked(data, row_metas, col_metas, measure_dict)

    result_rows = crosstab_service.apply_display(raw_rows, request.measure.display)

    # Merge level_labels from all fields used in this query
    level_labels: dict[str, dict[str, str]] = {
        k: field_metas[k]["level_labels"]
        for k in (row_keys + col_keys)
        if k in field_metas and field_metas[k].get("level_labels")
    }

    meta = CrosstabMeta(
        row_fields=[
            MetaField(field_key=m["field_key"], display_name=m["display_name"]) for m in row_metas
        ],
        col_fields=[
            MetaField(field_key=m["field_key"], display_name=m["display_name"]) for m in col_metas
        ],
        row_mode=request.row_mode,
        col_mode=request.col_mode,
        measure=request.measure,
        dataset_name=dataset.name,
        base_n=base_n,
        level_labels=level_labels,
    )
    return CrosstabResponse(meta=meta, rows=[ResultRow(**r) for r in result_rows])


async def run_trend(session: AsyncSession, request: TrendRequest) -> TrendResponse:
    col = await collection_repo.get_by_id(session, request.collection_id)
    if col is None:
        raise CollectionNotFoundError(request.collection_id)

    datasets = await collection_repo.get_datasets_for_collection(session, request.collection_id)
    field_keys = [f.field_key for f in request.fields]
    breakdown_key = request.breakdown.field_key if request.breakdown else None
    filter_keys = [f.field_key for f in request.filters]
    all_keys = list(set(field_keys + ([breakdown_key] if breakdown_key else []) + filter_keys))

    field_metas: dict = {}
    for ds in datasets:
        for k, v in (
            await analytics_repo.get_field_metas(session, cast(int, ds.id), all_keys)
        ).items():
            if k not in field_metas:
                field_metas[k] = v

    measure_dict = request.measure.model_dump()
    datasets_data = []
    for ds in datasets:
        worker = WorkerFactory.for_dataset(ds, session)
        data = await worker.fetch(cast(int, ds.id), all_keys, {})
        data = crosstab_service.apply_filters(
            data, [f.model_dump() for f in request.filters], field_metas
        )
        datasets_data.append({"dataset_name": ds.name, "data": data})

    raw_rows = trend_service.run_trend(
        datasets_data, field_keys, breakdown_key, field_metas, measure_dict
    )
    result_rows = crosstab_service.apply_display(raw_rows, request.measure.display)

    # base_n: total respondents across all datasets after filters applied
    total_n = sum(len(d["data"]) for d in datasets_data)

    # Merge level_labels from all fields used in this query
    trend_level_labels: dict[str, dict[str, str]] = {
        k: field_metas[k]["level_labels"]
        for k in field_keys + ([breakdown_key] if breakdown_key else [])
        if k in field_metas and field_metas[k].get("level_labels")
    }

    meta = TrendMeta(
        fields=[
            MetaField(field_key=k, display_name=field_metas[k]["display_name"])
            for k in field_keys
            if k in field_metas
        ],
        breakdown=MetaField(
            field_key=breakdown_key,
            display_name=field_metas[breakdown_key]["display_name"],
        )
        if breakdown_key and breakdown_key in field_metas
        else None,
        measure=request.measure,
        collection_name=col.name,
        base_n=total_n,
        level_labels=trend_level_labels,
    )
    return TrendResponse(meta=meta, rows=[ResultRow(**r) for r in result_rows])


def _build_group_out(
    g: FieldGroup,
    groups_by_parent: dict[int | None, list[FieldGroup]],
    fields_by_group: dict[int | None, list[Field]],
) -> FieldTreeGroupOut:
    return FieldTreeGroupOut(
        id=cast(int, g.id),
        name=g.name,
        slug=g.slug,
        sort_order=g.sort_order,
        fields=[
            FieldTreeFieldOut(
                id=cast(int, f.id),
                field_key=f.field_key,
                display_name=f.display_name,
                field_type=f.field_type,
                sort_order=f.sort_order,
                is_filterable=f.is_filterable,
            )
            for f in fields_by_group.get(g.id, [])
        ],
        children=[
            _build_group_out(child, groups_by_parent, fields_by_group)
            for child in groups_by_parent.get(g.id, [])
        ],
    )


async def get_field_tree(session: AsyncSession, dataset_id: int) -> FieldTreeOut:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    ds = await analytics_repo.get_dataset(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)

    groups, fields = await analytics_repo.get_groups_and_fields(session, dataset_id)

    groups_by_parent: dict[int | None, list[FieldGroup]] = {}
    for g in groups:
        groups_by_parent.setdefault(g.parent_id, []).append(g)

    fields_by_group: dict[int | None, list[Field]] = {}
    for f in fields:
        fields_by_group.setdefault(f.group_id, []).append(f)

    return FieldTreeOut(
        groups=[
            _build_group_out(g, groups_by_parent, fields_by_group)
            for g in groups_by_parent.get(None, [])
        ],
        ungrouped_fields=[
            FieldTreeFieldOut(
                id=cast(int, f.id),
                field_key=f.field_key,
                display_name=f.display_name,
                field_type=f.field_type,
                sort_order=f.sort_order,
                is_filterable=f.is_filterable,
            )
            for f in fields_by_group.get(None, [])
        ],
    )


async def get_weight_fields(session: AsyncSession, dataset_id: int) -> list[FieldOut]:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    ds = await analytics_repo.get_dataset(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)
    fields = await analytics_repo.get_weight_fields(session, dataset_id)
    return [FieldOut.model_validate(f.model_dump()) for f in fields]
