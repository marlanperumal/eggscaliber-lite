import pytest
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.reconciliation import ReconciliationGroup
from src.services.reconciliation_service import (
    classify_row,
    edit_distance,
    level_overlap,
)


def _field(key, levels=None):
    f = Field(field_key=key, display_name=key, field_type=FieldType.categorical, dataset_id=1, id=1)
    lvls = [
        Level(value=v, display_label=v, sort_order=i, field_id=1, id=i)
        for i, v in enumerate(levels or [])
    ]
    return f, lvls


def test_edit_distance_identical():
    assert edit_distance("gender", "gender") == 0


def test_edit_distance_one_char_change():
    assert edit_distance("gender", "Gender") == 1


def test_edit_distance_renamed():
    assert edit_distance("sex", "gender") > 2


def test_level_overlap_identical_sets():
    assert level_overlap({"male", "female"}, {"male", "female"}) == 1.0


def test_level_overlap_partial():
    assert level_overlap({"a", "b", "c"}, {"a", "b"}) == pytest.approx(2 / 3, abs=0.01)


def test_level_overlap_no_overlap():
    assert level_overlap({"a", "b"}, {"c", "d"}) == 0.0


def test_classify_exact_same_key_same_levels():
    f_new, lvls_new = _field("gender", ["male", "female"])
    f_ref, lvls_ref = _field("gender", ["male", "female"])
    result = classify_row(f_new, lvls_new, f_ref, lvls_ref)
    assert result.group == ReconciliationGroup.exact


def test_classify_probable_key_close():
    f_new, lvls_new = _field("q_gender", ["male", "female"])
    f_ref, lvls_ref = _field("gender", ["male", "female"])
    result = classify_row(f_new, lvls_new, f_ref, lvls_ref)
    assert result.group == ReconciliationGroup.probable


def test_classify_new_only_when_no_ref():
    f_new, lvls_new = _field("new_field", [])
    result = classify_row(f_new, lvls_new, None, [])
    assert result.group == ReconciliationGroup.new_only
