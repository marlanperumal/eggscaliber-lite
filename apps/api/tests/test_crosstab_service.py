import pytest
from src.models.field import FieldType
from src.services.crosstab_service import (
    aggregate_stacked,
    apply_display,
    apply_filters,
)


def _fm(field_key, field_type=FieldType.categorical, levels=None):
    return {
        "field_key": field_key,
        "field_type": field_type,
        "levels": levels or [],
        "display_name": field_key,
    }


DATA = [
    {"brand_rating": "Good", "gender": "Female"},
    {"brand_rating": "Good", "gender": "Male"},
    {"brand_rating": "Good", "gender": "Female"},
    {"brand_rating": "Poor", "gender": "Male"},
    {"brand_rating": "Poor", "gender": "Female"},
]

MEASURE_COUNT = {"type": "count", "field_key": None, "aggregation": None, "display": "n"}


def test_aggregate_stacked_count_single_row_single_col():
    row_fields = [_fm("brand_rating", FieldType.ordinal, ["Good", "Poor"])]
    col_fields = [_fm("gender", FieldType.categorical, ["Female", "Male"])]
    rows = aggregate_stacked(DATA, row_fields, col_fields, MEASURE_COUNT)

    assert len(rows) == 2
    good_row = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good_row["values"]["Female"] == 2.0
    assert good_row["values"]["Male"] == 1.0
    assert good_row["values"]["Total"] == 3.0

    poor_row = next(r for r in rows if r["key"] == ["brand_rating", "Poor"])
    assert poor_row["values"]["Female"] == 1.0
    assert poor_row["values"]["Male"] == 1.0
    assert poor_row["values"]["Total"] == 2.0


def test_aggregate_stacked_no_col_field():
    row_fields = [_fm("brand_rating", FieldType.ordinal, ["Good", "Poor"])]
    rows = aggregate_stacked(DATA, row_fields, [], MEASURE_COUNT)
    assert len(rows) == 2
    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good["values"] == {"Total": 3.0}


def test_aggregate_stacked_multi_response_row():
    data = [
        {"tags": ["fun", "reliable"], "gender": "Female"},
        {"tags": ["fun"], "gender": "Male"},
        {"tags": ["reliable"], "gender": "Female"},
    ]
    row_fields = [_fm("tags", FieldType.multi_response, ["fun", "reliable"])]
    col_fields = [_fm("gender", FieldType.categorical, ["Female", "Male"])]
    rows = aggregate_stacked(data, row_fields, col_fields, MEASURE_COUNT)
    fun_row = next(r for r in rows if r["key"] == ["tags", "fun"])
    assert fun_row["values"]["Female"] == 1.0
    assert fun_row["values"]["Male"] == 1.0
    assert fun_row["values"]["Total"] == 2.0


def test_apply_display_pct_col():
    raw = [
        {"key": ["brand_rating", "Good"], "values": {"Female": 2.0, "Male": 1.0, "Total": 3.0}},
        {"key": ["brand_rating", "Poor"], "values": {"Female": 1.0, "Male": 1.0, "Total": 2.0}},
    ]
    result = apply_display(raw, "pct_col")
    good = next(r for r in result if r["key"] == ["brand_rating", "Good"])
    # Female col total = 3, Good/Female = 2 → 66.7%
    assert good["values"]["Female"] == pytest.approx(66.7, abs=0.1)
    # Total col total = 5, Good/Total = 3 → 60.0%
    assert good["values"]["Total"] == pytest.approx(60.0, abs=0.1)


def test_apply_display_pct_row():
    raw = [
        {"key": ["brand_rating", "Good"], "values": {"Female": 2.0, "Male": 1.0, "Total": 3.0}},
    ]
    result = apply_display(raw, "pct_row")
    good = result[0]
    assert good["values"]["Female"] == pytest.approx(66.7, abs=0.1)
    assert good["values"]["Male"] == pytest.approx(33.3, abs=0.1)
    assert good["values"]["Total"] == pytest.approx(100.0, abs=0.1)


def test_apply_filters_levels():
    data = [
        {"gender": "Female", "brand_rating": "Good"},
        {"gender": "Male", "brand_rating": "Good"},
        {"gender": "Female", "brand_rating": "Poor"},
    ]
    filters = [{"field_key": "gender", "levels": ["Female"], "value_range": None}]
    field_metas = {"gender": {"field_type": FieldType.categorical}}
    result = apply_filters(data, filters, field_metas)
    assert len(result) == 2
    assert all(r["gender"] == "Female" for r in result)


def test_apply_filters_range():
    data = [{"nps": 5}, {"nps": 8}, {"nps": 2}]
    filters = [{"field_key": "nps", "levels": None, "value_range": [4, 9]}]
    field_metas = {"nps": {"field_type": FieldType.numeric}}
    result = apply_filters(data, filters, field_metas)
    assert len(result) == 2


def test_aggregate_nested_two_row_fields_computes_four_part_key_and_cell_values():
    data = [
        {"region": "North", "channel": "TV", "gender": "Female"},
        {"region": "North", "channel": "TV", "gender": "Male"},
        {"region": "North", "channel": "Radio", "gender": "Female"},
        {"region": "South", "channel": "TV", "gender": "Female"},
    ]
    row_fields = [
        _fm("region", FieldType.categorical, ["North", "South"]),
        _fm("channel", FieldType.categorical, ["TV", "Radio"]),
    ]
    col_fields = [_fm("gender", FieldType.categorical, ["Female", "Male"])]
    from src.services.crosstab_service import aggregate_nested

    rows = aggregate_nested(data, row_fields, col_fields, MEASURE_COUNT)

    keys = [r["key"] for r in rows]
    assert ["region", "North", "channel", "TV"] in keys
    assert ["region", "North", "channel", "Radio"] in keys
    assert ["region", "South", "channel", "TV"] in keys

    north_tv = next(r for r in rows if r["key"] == ["region", "North", "channel", "TV"])
    assert north_tv["values"]["Female"] == 1.0
    assert north_tv["values"]["Male"] == 1.0
    assert north_tv["values"]["Total"] == 2.0

    north_radio = next(r for r in rows if r["key"] == ["region", "North", "channel", "Radio"])
    assert north_radio["values"]["Female"] == 1.0
    assert north_radio["values"]["Male"] == 0.0
    assert north_radio["values"]["Total"] == 1.0


def test_aggregate_stacked_weighted():
    data = [
        {"brand_rating": "Good", "gender": "Female", "pw": 1.5},
        {"brand_rating": "Good", "gender": "Male", "pw": 0.8},
        {"brand_rating": "Poor", "gender": "Female", "pw": 1.2},
    ]
    measure = {"type": "weighted", "field_key": "pw", "aggregation": None, "display": "n"}
    row_fields = [_fm("brand_rating", FieldType.ordinal, ["Good", "Poor"])]
    col_fields = [_fm("gender", FieldType.categorical, ["Female", "Male"])]
    rows = aggregate_stacked(data, row_fields, col_fields, measure)
    good = next(r for r in rows if r["key"] == ["brand_rating", "Good"])
    assert good["values"]["Female"] == pytest.approx(1.5)
    assert good["values"]["Male"] == pytest.approx(0.8)
    assert good["values"]["Total"] == pytest.approx(2.3)
