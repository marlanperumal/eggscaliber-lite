from sqlalchemy.orm import Session

from src.errors import CollectionNotFoundError, DatasetNotFoundError
from src.models.analytics import (
    CrosstabMeta,
    CrosstabRequest,
    CrosstabResponse,
    MetaField,
    ResultRow,
    TrendMeta,
    TrendRequest,
    TrendResponse,
)
from src.repositories import analytics_repo, collection_repo
from src.services import crosstab_service, trend_service
from src.workers.factory import WorkerFactory


def run_crosstab(session: Session, request: CrosstabRequest) -> CrosstabResponse:
    dataset = analytics_repo.get_dataset(session, request.dataset_id)
    if dataset is None:
        raise DatasetNotFoundError(request.dataset_id)

    row_keys = [f.field_key for f in request.rows]
    col_keys = [f.field_key for f in request.columns]
    filter_keys = [f.field_key for f in request.filters]
    extra_keys = []
    if request.measure.type in ("weighted", "value_field") and request.measure.field_key:
        extra_keys.append(request.measure.field_key)
    all_keys = list(set(row_keys + col_keys + filter_keys + extra_keys))

    field_metas = analytics_repo.get_field_metas(session, request.dataset_id, all_keys)

    worker = WorkerFactory.for_dataset(dataset, session)
    data = list(worker.fetch(request.dataset_id, all_keys, {}))

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
    )
    return CrosstabResponse(meta=meta, rows=[ResultRow(**r) for r in result_rows])


def run_trend(session: Session, request: TrendRequest) -> TrendResponse:
    col = collection_repo.get_by_id(session, request.collection_id)
    if col is None:
        raise CollectionNotFoundError(request.collection_id)

    datasets = collection_repo.get_datasets_for_collection(session, request.collection_id)
    field_keys = [f.field_key for f in request.fields]
    breakdown_key = request.breakdown.field_key if request.breakdown else None
    filter_keys = [f.field_key for f in request.filters]
    all_keys = list(set(field_keys + ([breakdown_key] if breakdown_key else []) + filter_keys))

    field_metas: dict = {}
    for ds in datasets:
        for k, v in analytics_repo.get_field_metas(session, ds.id, all_keys).items():
            if k not in field_metas:
                field_metas[k] = v

    measure_dict = request.measure.model_dump()
    datasets_data = []
    for ds in datasets:
        worker = WorkerFactory.for_dataset(ds, session)
        data = list(worker.fetch(ds.id, all_keys, {}))
        data = crosstab_service.apply_filters(
            data, [f.model_dump() for f in request.filters], field_metas
        )
        datasets_data.append({"dataset_name": ds.name, "data": data})

    raw_rows = trend_service.run_trend(
        datasets_data, field_keys, breakdown_key, field_metas, measure_dict
    )
    result_rows = crosstab_service.apply_display(raw_rows, request.measure.display)

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
    )
    return TrendResponse(meta=meta, rows=[ResultRow(**r) for r in result_rows])
