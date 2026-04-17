from src.models.collection import Collection, CollectionType
from src.models.field import FieldType
from src.models.package import Package
from src.models.upload import (
    UploadField,
    UploadLevel,
    UploadSession,
    UploadSessionStatus,
)
from src.repositories import upload_repo


async def _seed_session(db):
    pkg = Package(name="P", slug="p-upload-repo-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="C",
        slug="c-upload-repo-test",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    sess = UploadSession(
        file_path="/tmp/test.csv",
        collection_id=col.id,
        dataset_name="Wave 3",
        status=UploadSessionStatus.detecting,
    )
    db.add(sess)
    await db.flush()
    await db.refresh(sess)
    return sess


async def test_get_session_by_id_returns_session(db):
    sess = await _seed_session(db)
    result = await upload_repo.get_session_by_id(db, sess.id)
    assert result is not None
    assert result.id == sess.id


async def test_get_session_by_id_missing_returns_none(db):
    result = await upload_repo.get_session_by_id(db, 99999)
    assert result is None


async def test_get_fields_for_session_returns_all(db):
    sess = await _seed_session(db)
    db.add(
        UploadField(
            upload_session_id=sess.id, field_key="gender", detected_type=FieldType.categorical
        )
    )
    db.add(UploadField(upload_session_id=sess.id, field_key="age", detected_type=FieldType.numeric))
    await db.flush()
    result = await upload_repo.get_fields_for_session(db, sess.id)
    assert len(result) == 2
    keys = {f.field_key for f in result}
    assert keys == {"gender", "age"}


async def test_get_levels_for_field_returns_ordered(db):
    sess = await _seed_session(db)
    f = UploadField(
        upload_session_id=sess.id, field_key="gender", detected_type=FieldType.categorical
    )
    db.add(f)
    await db.flush()
    await db.refresh(f)
    db.add(UploadLevel(upload_field_id=f.id, raw_value="male", sort_order=0))
    db.add(UploadLevel(upload_field_id=f.id, raw_value="female", sort_order=1))
    await db.flush()
    result = await upload_repo.get_levels_for_field(db, f.id)
    assert [lv.raw_value for lv in result] == ["male", "female"]
