from src.models.field import FieldType
from src.services.trend_service import run_trend

MEASURE_COUNT = {"type": "count", "field_key": None, "aggregation": None, "display": "n"}


def _fm(field_key, levels):
    return {
        "field_key": field_key,
        "field_type": FieldType.categorical,
        "levels": levels,
        "display_name": field_key,
    }


def test_run_trend_field_key_absent_from_metas_is_silently_skipped():
    datasets_data = [
        {
            "dataset_name": "Wave 1",
            "data": [
                {"brand_awareness": "Aware"},
                {"brand_awareness": "Not Aware"},
            ],
        }
    ]
    # "missing_field" has no metadata entry — should be silently excluded
    field_metas = {"brand_awareness": _fm("brand_awareness", ["Aware", "Not Aware"])}

    rows = run_trend(
        datasets_data=datasets_data,
        field_keys=["brand_awareness", "missing_field"],
        breakdown_key=None,
        field_metas_by_key=field_metas,
        measure=MEASURE_COUNT,
    )

    # Only brand_awareness rows returned — missing_field produces nothing, no error
    returned_field_keys = {r["key"][1] for r in rows}
    assert "brand_awareness" in returned_field_keys
    assert "missing_field" not in returned_field_keys
    assert len(rows) == 2  # Aware + Not Aware for Wave 1
