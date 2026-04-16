from typing import Any

from src.models.analytics import DatasetData, FieldMeta
from src.services.crosstab_service import _compute_measure, _value_matches


def run_trend(
    datasets_data: list[DatasetData],
    field_keys: list[str],
    breakdown_key: str | None,
    field_metas_by_key: dict[str, FieldMeta],
    measure: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Returns ResultRow-shaped dicts with key = [dataset_name, field_key, level].
    If breakdown_key is set, col keys are breakdown levels; else just "Total".
    """
    result = []
    for entry in datasets_data:
        ds_name = entry["dataset_name"]
        data = entry["data"]
        for fk in field_keys:
            fm = field_metas_by_key.get(fk)
            if fm is None:
                continue
            for level in fm["levels"]:
                row_data = [r for r in data if _value_matches(r, fk, fm["field_type"], level)]
                values: dict[str, float] = {}
                if breakdown_key:
                    bm = field_metas_by_key.get(breakdown_key)
                    if bm:
                        for bl in bm["levels"]:
                            bd = [
                                r
                                for r in row_data
                                if _value_matches(r, breakdown_key, bm["field_type"], bl)
                            ]
                            values[bl] = _compute_measure(bd, measure)
                values["Total"] = _compute_measure(row_data, measure)
                result.append({"key": [ds_name, fk, level], "values": values})
    return result
