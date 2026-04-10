from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.services.collection_service import (
    InconsistencyType,
    check_field_consistency,
)


def _make_collection(db):
    pkg = Package(name="P", slug="p-con-test")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)
    col = Collection(
        name="C", slug="c-con-test", package_id=pkg.id, collection_type=CollectionType.survey
    )
    db.add(col)
    db.flush()
    db.refresh(col)
    return col


def _add_dataset(db, col, name, slug, sort_order):
    ds = Dataset(name=name, slug=slug, collection_id=col.id, sort_order=sort_order)
    db.add(ds)
    db.flush()
    db.refresh(ds)
    return ds


def _add_field(db, ds, key, ftype):
    f = Field(field_key=key, display_name=key, field_type=ftype, dataset_id=ds.id)
    db.add(f)
    db.flush()
    db.refresh(f)
    return f


def _add_levels(db, field, values):
    for i, v in enumerate(values):
        db.add(Level(value=v, display_label=v, sort_order=i, field_id=field.id))
    db.flush()


def test_consistent_collection_returns_empty(db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-con", 1)
    ds2 = _add_dataset(db, col, "W2", "w2-con", 2)
    for ds in [ds1, ds2]:
        f = _add_field(db, ds, "gender", FieldType.categorical)
        _add_levels(db, f, ["male", "female"])

    result = check_field_consistency(col.id, db)
    assert result == []


def test_detects_type_mismatch(db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-tm", 1)
    ds2 = _add_dataset(db, col, "W2", "w2-tm", 2)
    _add_field(db, ds1, "score", FieldType.numeric)
    _add_field(db, ds2, "score", FieldType.ordinal)

    result = check_field_consistency(col.id, db)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.type_mismatch in types
    assert all(r.field_key == "score" for r in result)


def test_detects_missing_field(db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-mf", 1)
    _add_dataset(db, col, "W2", "w2-mf", 2)
    _add_field(db, ds1, "brand_awareness", FieldType.categorical)
    # ds2 intentionally has no brand_awareness field

    result = check_field_consistency(col.id, db)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.missing_field in types


def test_detects_level_inconsistency(db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-la", 1)
    ds2 = _add_dataset(db, col, "W2", "w2-la", 2)
    f1 = _add_field(db, ds1, "media", FieldType.multi_response)
    f2 = _add_field(db, ds2, "media", FieldType.multi_response)
    _add_levels(db, f1, ["tv", "radio"])
    _add_levels(db, f2, ["tv", "radio", "podcast"])  # podcast added in wave 2

    result = check_field_consistency(col.id, db)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.level_added in types


def test_consistency_endpoint(client, db):
    col = _make_collection(db)
    ds1 = _add_dataset(db, col, "W1", "w1-ep", 1)
    ds2 = _add_dataset(db, col, "W2", "w2-ep", 2)
    _add_field(db, ds1, "score", FieldType.numeric)
    _add_field(db, ds2, "score", FieldType.ordinal)  # type mismatch

    response = client.get(f"/api/v1/collections/{col.id}/consistency")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert any(item["inconsistency_type"] == "type_mismatch" for item in data)
