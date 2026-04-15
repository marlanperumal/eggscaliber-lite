from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package
from src.services.collection_service import (
    InconsistencyType,
    check_field_consistency,
)


async def _make_collection(db):
    pkg = Package(name="P", slug="p-con-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="C", slug="c-con-test", package_id=pkg.id, collection_type=CollectionType.survey
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    return col


async def _add_dataset(db, col, name, slug, sort_order):
    ds = Dataset(name=name, slug=slug, collection_id=col.id, sort_order=sort_order)
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return ds


async def _add_field(db, ds, key, ftype):
    f = Field(field_key=key, display_name=key, field_type=ftype, dataset_id=ds.id)
    db.add(f)
    await db.flush()
    await db.refresh(f)
    return f


async def _add_levels(db, field, values):
    for i, v in enumerate(values):
        db.add(Level(value=v, display_label=v, sort_order=i, field_id=field.id))
    await db.flush()


async def test_single_dataset_collection_returns_empty(db):
    col = await _make_collection(db)
    await _add_dataset(db, col, "W1", "w1-single", 1)
    # Only one dataset — early-return guard should produce no inconsistencies
    result = await check_field_consistency(db, col.id)
    assert result == []


async def test_consistent_collection_returns_empty(db):
    col = await _make_collection(db)
    ds1 = await _add_dataset(db, col, "W1", "w1-con", 1)
    ds2 = await _add_dataset(db, col, "W2", "w2-con", 2)
    for ds in [ds1, ds2]:
        f = await _add_field(db, ds, "gender", FieldType.categorical)
        await _add_levels(db, f, ["male", "female"])

    result = await check_field_consistency(db, col.id)
    assert result == []


async def test_detects_type_mismatch(db):
    col = await _make_collection(db)
    ds1 = await _add_dataset(db, col, "W1", "w1-tm", 1)
    ds2 = await _add_dataset(db, col, "W2", "w2-tm", 2)
    await _add_field(db, ds1, "score", FieldType.numeric)
    await _add_field(db, ds2, "score", FieldType.ordinal)

    result = await check_field_consistency(db, col.id)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.type_mismatch in types
    assert all(r.field_key == "score" for r in result)


async def test_detects_missing_field(db):
    col = await _make_collection(db)
    ds1 = await _add_dataset(db, col, "W1", "w1-mf", 1)
    await _add_dataset(db, col, "W2", "w2-mf", 2)
    await _add_field(db, ds1, "brand_awareness", FieldType.categorical)
    # ds2 intentionally has no brand_awareness field

    result = await check_field_consistency(db, col.id)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.missing_field in types


async def test_detects_level_inconsistency(db):
    col = await _make_collection(db)
    ds1 = await _add_dataset(db, col, "W1", "w1-la", 1)
    ds2 = await _add_dataset(db, col, "W2", "w2-la", 2)
    f1 = await _add_field(db, ds1, "media", FieldType.multi_response)
    f2 = await _add_field(db, ds2, "media", FieldType.multi_response)
    await _add_levels(db, f1, ["tv", "radio"])
    await _add_levels(db, f2, ["tv", "radio", "podcast"])  # podcast added in wave 2

    result = await check_field_consistency(db, col.id)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.level_added in types


async def test_detects_level_removed(db):
    col = await _make_collection(db)
    ds1 = await _add_dataset(db, col, "W1", "w1-lr", 1)
    ds2 = await _add_dataset(db, col, "W2", "w2-lr", 2)
    f1 = await _add_field(db, ds1, "media", FieldType.multi_response)
    f2 = await _add_field(db, ds2, "media", FieldType.multi_response)
    await _add_levels(db, f1, ["tv", "radio", "podcast"])
    await _add_levels(db, f2, ["tv", "radio"])  # podcast dropped in wave 2

    result = await check_field_consistency(db, col.id)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.level_removed in types
    removed = [r for r in result if r.inconsistency_type == InconsistencyType.level_removed]
    assert any(r.field_key == "media" for r in removed)


async def test_detects_inconsistency_between_later_dataset_pair_in_three_dataset_collection(db):
    # Verifies that the consecutive-pair comparison catches an inconsistency between
    # datasets 2 and 3 when datasets 1 and 2 are consistent.
    col = await _make_collection(db)
    ds1 = await _add_dataset(db, col, "W1", "w1-3ds", 1)
    ds2 = await _add_dataset(db, col, "W2", "w2-3ds", 2)
    ds3 = await _add_dataset(db, col, "W3", "w3-3ds", 3)

    for ds in [ds1, ds2]:
        f = await _add_field(db, ds, "media", FieldType.multi_response)
        await _add_levels(db, f, ["tv", "radio"])

    # W3 drops "radio" — inconsistency exists only between W2 and W3, not W1 and W2.
    f3 = await _add_field(db, ds3, "media", FieldType.multi_response)
    await _add_levels(db, f3, ["tv"])

    result = await check_field_consistency(db, col.id)
    types = {r.inconsistency_type for r in result}
    assert InconsistencyType.level_removed in types
    removed = [r for r in result if r.inconsistency_type == InconsistencyType.level_removed]
    assert any(r.field_key == "media" for r in removed)


async def test_consistency_endpoint(client, db):
    col = await _make_collection(db)
    ds1 = await _add_dataset(db, col, "W1", "w1-ep", 1)
    ds2 = await _add_dataset(db, col, "W2", "w2-ep", 2)
    await _add_field(db, ds1, "score", FieldType.numeric)
    await _add_field(db, ds2, "score", FieldType.ordinal)  # type mismatch

    response = await client.get(f"/api/v1/collections/{col.id}/consistency")
    assert response.status_code == 200
    data = response.json()
    assert any(item["inconsistency_type"] == "type_mismatch" for item in data)
