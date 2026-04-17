from src.models.field import FieldType
from src.services.detection_service import (
    detect_fields,
    slugify_key,
)


def _make_rows(header, rows):
    return [dict(zip(header, r, strict=True)) for r in rows]


def test_slugify_key_lowercases_and_replaces_spaces():
    assert slugify_key("Brand Awareness") == "brand_awareness"


def test_slugify_key_strips_special_chars():
    assert slugify_key("Q1. Age?") == "q1_age"


def test_detects_identifier_by_name():
    rows = _make_rows(["respondent_id"], [["1"], ["2"], ["3"]])
    fields = detect_fields(["respondent_id"], rows)
    assert fields[0].detected_type == FieldType.identifier


def test_detects_weight_by_name():
    rows = _make_rows(["weight"], [["1.2"], ["0.8"], ["1.0"]])
    fields = detect_fields(["weight"], rows)
    assert fields[0].detected_type == FieldType.weight


def test_detects_multi_response_by_sibling_pattern():
    headers = ["media_1", "media_2", "media_3"]
    rows = _make_rows(headers, [["1", "0", "1"], ["0", "1", "0"]])
    fields = detect_fields(headers, rows)
    for f in fields:
        assert f.detected_type == FieldType.multi_response


def test_detects_ordinal_numeric_few_distinct_values():
    rows = _make_rows(["rating"], [[str(i % 5 + 1)] for i in range(50)])
    fields = detect_fields(["rating"], rows)
    assert fields[0].detected_type == FieldType.ordinal


def test_detects_categorical_string_low_cardinality():
    rows = _make_rows(["region"], [["North"], ["South"], ["East"], ["West"]] * 10)
    fields = detect_fields(["region"], rows)
    assert fields[0].detected_type == FieldType.categorical


def test_detects_numeric_high_cardinality_numbers():
    import random

    rows = _make_rows(["income"], [[str(random.randint(20000, 100000))] for _ in range(100)])
    fields = detect_fields(["income"], rows)
    assert fields[0].detected_type == FieldType.numeric


def test_detect_fields_returns_sorted_by_original_order():
    headers = ["gender", "age", "weight"]
    rows = _make_rows(headers, [["male", "30", "1.0"], ["female", "25", "0.9"]])
    fields = detect_fields(headers, rows)
    assert [f.field_key for f in fields] == ["gender", "age", "weight"]


def test_distinct_values_captured_for_categorical():
    rows = _make_rows(["colour"], [["red"], ["blue"], ["green"], ["red"]])
    fields = detect_fields(["colour"], rows)
    assert set(fields[0].distinct_values) == {"red", "blue", "green"}
