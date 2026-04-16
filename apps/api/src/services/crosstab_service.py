from typing import Any

from src.models.analytics import FieldMeta, RowColMeta
from src.models.field import FieldType


def _value_matches(row: dict[str, Any], field_key: str, field_type: FieldType, level: str) -> bool:
    val = row.get(field_key)
    if field_type == FieldType.multi_response:
        return isinstance(val, list) and level in val
    return str(val) == str(level)


def _compute_measure(rows: list[dict[str, Any]], measure: dict[str, Any]) -> float:
    if measure["type"] == "count":
        return float(len(rows))
    if measure["type"] == "weighted":
        wk = measure["field_key"]
        return sum(float(r.get(wk, 0) or 0) for r in rows)
    if measure["type"] == "value_field":
        vk = measure["field_key"]
        vals = [float(r[vk]) for r in rows if r.get(vk) is not None]
        if not vals:
            return 0.0
        return sum(vals) if measure["aggregation"] == "sum" else sum(vals) / len(vals)
    return 0.0


def aggregate_stacked(
    data: list[dict[str, Any]],
    row_fields: list[RowColMeta],
    col_fields: list[RowColMeta],
    measure: dict[str, Any],
) -> list[dict[str, Any]]:
    result = []
    for rf in row_fields:
        for level in rf["levels"]:
            row_data = [
                r for r in data if _value_matches(r, rf["field_key"], rf["field_type"], level)
            ]
            values: dict[str, float] = {}
            for cf in col_fields:
                for col_level in cf["levels"]:
                    col_key = (
                        col_level if len(col_fields) == 1 else f"{cf['field_key']}|{col_level}"
                    )
                    col_data = [
                        r
                        for r in row_data
                        if _value_matches(r, cf["field_key"], cf["field_type"], col_level)
                    ]
                    values[col_key] = _compute_measure(col_data, measure)
            values["Total"] = _compute_measure(row_data, measure)
            result.append({"key": [rf["field_key"], level], "values": values})
    return result


def aggregate_nested(
    data: list[dict[str, Any]],
    row_fields: list[RowColMeta],
    col_fields: list[RowColMeta],
    measure: dict[str, Any],
) -> list[dict[str, Any]]:
    """Two-level nested rows: key = [outer_key, outer_level, inner_key, inner_level]."""
    if len(row_fields) < 2:
        return aggregate_stacked(data, row_fields, col_fields, measure)
    outer, inner = row_fields[0], row_fields[1]
    result = []
    for outer_level in outer["levels"]:
        outer_data = [
            r
            for r in data
            if _value_matches(r, outer["field_key"], outer["field_type"], outer_level)
        ]
        for inner_level in inner["levels"]:
            inner_data = [
                r
                for r in outer_data
                if _value_matches(r, inner["field_key"], inner["field_type"], inner_level)
            ]
            values: dict[str, float] = {}
            for cf in col_fields:
                for col_level in cf["levels"]:
                    col_key = (
                        col_level if len(col_fields) == 1 else f"{cf['field_key']}|{col_level}"
                    )
                    col_data = [
                        r
                        for r in inner_data
                        if _value_matches(r, cf["field_key"], cf["field_type"], col_level)
                    ]
                    values[col_key] = _compute_measure(col_data, measure)
            values["Total"] = _compute_measure(inner_data, measure)
            result.append(
                {
                    "key": [
                        outer["field_key"],
                        outer_level,
                        inner["field_key"],
                        inner_level,
                    ],
                    "values": values,
                }
            )
    return result


def apply_filters(
    data: list[dict[str, Any]],
    filters: list[dict[str, Any]],
    field_metas: dict[str, FieldMeta],
) -> list[dict[str, Any]]:
    for f in filters:
        fk = f["field_key"]
        fm = field_metas.get(fk)
        ft = fm["field_type"] if fm is not None else FieldType.categorical
        levels = f.get("levels")
        value_range = f.get("value_range")

        if levels and ft == FieldType.multi_response:
            data = [r for r in data if any(lv in (r.get(fk) or []) for lv in levels)]
        elif levels:
            data = [r for r in data if str(r.get(fk, "")) in levels]
        elif value_range:
            lo, hi = value_range
            data = [r for r in data if r.get(fk) is not None and lo <= float(r[fk]) <= hi]
    return data


def apply_display(rows: list[dict[str, Any]], display: str) -> list[dict[str, Any]]:
    if display == "n":
        return rows
    col_keys: set[str] = set()
    for row in rows:
        col_keys.update(row["values"].keys())

    if display == "pct_col":
        col_totals = {k: sum(r["values"].get(k, 0) for r in rows) for k in col_keys}
        for row in rows:
            for k in col_keys:
                total = col_totals[k]
                row["values"][k] = round(row["values"][k] / total * 100, 1) if total else 0.0

    elif display == "pct_row":
        for row in rows:
            row_total = row["values"].get("Total", sum(row["values"].values()))
            for k in row["values"]:
                row["values"][k] = (
                    round(row["values"][k] / row_total * 100, 1) if row_total else 0.0
                )

    return rows
