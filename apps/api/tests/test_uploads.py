import csv
import io

from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.package import Package
from src.models.upload import UploadSessionStatus


def _make_csv(headers: list[str], rows: list[list[str]]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue().encode()


async def test_upload_csv_creates_session_and_fields(client, db):
    csv_bytes = _make_csv(
        ["respondent_id", "gender", "age", "brand_1", "brand_2"],
        [["1", "male", "3", "1", "0"], ["2", "female", "5", "0", "1"]],
    )
    response = await client.post(
        "/api/v1/uploads",
        files={"file": ("wave3.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["dataset_name"] == "Wave 3"
    assert data["status"] == UploadSessionStatus.detecting
    assert len(data["fields"]) == 5
    keys = {f["field_key"] for f in data["fields"]}
    assert "respondent_id" in keys
    assert "gender" in keys
    # multi_response siblings detected
    multi = [f for f in data["fields"] if f["field_key"] in ("brand_1", "brand_2")]
    assert all(f["detected_type"] == "multi_response" for f in multi)


async def test_upload_non_csv_returns_422(client):
    response = await client.post(
        "/api/v1/uploads",
        files={"file": ("data.xlsx", b"fake", "application/vnd.ms-excel")},
        data={"dataset_name": "Wave 3"},
    )
    assert response.status_code == 422


async def test_upload_missing_dataset_name_returns_422(client):
    csv_bytes = _make_csv(["id"], [["1"]])
    response = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
    )
    assert response.status_code == 422


async def _create_session(client, headers=None, rows=None):
    headers = headers or ["respondent_id", "gender"]
    rows = rows or [["1", "male"], ["2", "female"]]
    csv_bytes = _make_csv(headers, rows)
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3"},
    )
    assert resp.status_code == 201
    return resp.json()


async def test_get_upload_session_returns_fields(client, db):
    sess = await _create_session(client)
    resp = await client.get(f"/api/v1/uploads/{sess['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == sess["id"]
    assert len(data["fields"]) == 2


async def test_get_upload_session_not_found(client):
    resp = await client.get("/api/v1/uploads/99999")
    assert resp.status_code == 404


async def test_patch_field_override_type(client, db):
    sess = await _create_session(client, headers=["rating"], rows=[[str(i)] for i in range(1, 6)])
    field_id = sess["fields"][0]["id"]
    resp = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}",
        json={"override_type": "categorical"},
    )
    assert resp.status_code == 200
    assert resp.json()["override_type"] == "categorical"


async def test_patch_field_invalid_type_returns_422(client, db):
    sess = await _create_session(client)
    field_id = sess["fields"][0]["id"]
    resp = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}",
        json={"override_type": "not_a_type"},
    )
    assert resp.status_code == 422


async def test_upload_field_includes_confidence_and_value_sample(client, db):
    csv_bytes = _make_csv(
        ["respondent_id", "gender", "score"],
        [["1", "male", "3"], ["2", "female", "5"], ["3", "male", "3"]],
    )
    response = await client.post(
        "/api/v1/uploads",
        files={"file": ("w.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave X"},
    )
    assert response.status_code == 201
    fields = {f["field_key"]: f for f in response.json()["fields"]}
    assert fields["respondent_id"]["confidence"] == "high"
    assert fields["gender"]["confidence"] == "high"
    assert "male" in fields["gender"]["value_sample"]
    assert len(fields["gender"]["value_sample"]) <= 5


async def test_get_upload_session_includes_confidence(client, db):
    csv_bytes = _make_csv(["id", "cat"], [["1", "a"], ["2", "b"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Test"},
    )
    sid = resp.json()["id"]
    get_resp = await client.get(f"/api/v1/uploads/{sid}")
    assert get_resp.status_code == 200
    fields = {f["field_key"]: f for f in get_resp.json()["fields"]}
    assert "confidence" in fields["cat"]
    assert "value_sample" in fields["cat"]


async def _seed_collection_with_datasets(db):
    pkg = Package(name="Pkg SR", slug="pkg-sr-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="Col SR",
        slug="col-sr-test",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    ds1 = Dataset(name="W1", slug="w1-sr-test", collection_id=col.id, sort_order=0)
    ds2 = Dataset(name="W2", slug="w2-sr-test", collection_id=col.id, sort_order=1)
    db.add(ds1)
    db.add(ds2)
    await db.flush()
    await db.refresh(ds2)
    return col, ds2


async def test_suggested_reference_returns_most_recent_dataset(client, db):
    col, ds2 = await _seed_collection_with_datasets(db)
    csv_bytes = _make_csv(["id"], [["1"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3", "collection_id": str(col.id)},
    )
    sid = resp.json()["id"]
    ref_resp = await client.get(f"/api/v1/uploads/{sid}/suggested-reference")
    assert ref_resp.status_code == 200
    assert ref_resp.json()["dataset_id"] == ds2.id
    assert ref_resp.json()["dataset_name"] == "W2"


async def test_suggested_reference_no_collection_returns_null(client, db):
    csv_bytes = _make_csv(["id"], [["1"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Standalone"},
    )
    sid = resp.json()["id"]
    ref_resp = await client.get(f"/api/v1/uploads/{sid}/suggested-reference")
    assert ref_resp.status_code == 200
    assert ref_resp.json()["dataset_id"] is None


async def test_reconcile_counts(client, db):
    from tests.test_reconciliation_api import _seed_ref_dataset, _upload

    col, ref_ds = await _seed_ref_dataset(db)
    sess = await _upload(client, col.id)
    await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile",
        json={"reference_dataset_id": ref_ds.id},
    )
    counts_resp = await client.get(f"/api/v1/uploads/{sess['id']}/reconcile/counts")
    assert counts_resp.status_code == 200
    data = counts_resp.json()
    assert {"exact", "probable", "new_only", "old_only"}.issubset(data.keys())
    assert "status_counts" in data
    assert isinstance(data["status_counts"], dict)


async def test_get_upload_session_includes_file_name(client, db):
    csv_bytes = _make_csv(["id"], [["1"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("survey.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Test"},
    )
    sid = resp.json()["id"]
    get_resp = await client.get(f"/api/v1/uploads/{sid}")
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert "file_name" in body
    assert body["file_name"] == "survey.csv"


async def test_get_upload_session_includes_collection_metadata(client, db):
    pkg = Package(name="Meta Pkg", slug="meta-pkg-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="Meta Collection",
        slug="meta-col-test",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    csv_bytes = _make_csv(["id"], [["1"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("survey2.csv", csv_bytes, "text/csv")},
        data={
            "dataset_name": "Test Meta",
            "collection_id": str(col.id),
            "collected_at": "2024-03-15",
        },
    )
    sid = resp.json()["id"]
    get_resp = await client.get(f"/api/v1/uploads/{sid}")
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert body["collection_name"] == "Meta Collection"
    assert body["package_name"] == "Meta Pkg"
    assert body["collected_at"] == "2024-03-15"


async def test_patch_field_sort_order(client, db):
    csv_bytes = _make_csv(["a", "b"], [["1", "2"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "T"},
    )
    sess = resp.json()
    field_id = sess["fields"][0]["id"]
    patch = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}",
        json={"sort_order": 99},
    )
    assert patch.status_code == 200
    assert patch.json()["sort_order"] == 99


async def test_delete_field(client, db):
    csv_bytes = _make_csv(["x", "y"], [["1", "2"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "T"},
    )
    sess = resp.json()
    field_id = sess["fields"][0]["id"]
    del_resp = await client.delete(f"/api/v1/uploads/{sess['id']}/fields/{field_id}")
    assert del_resp.status_code == 204
    get_resp = await client.get(f"/api/v1/uploads/{sess['id']}")
    remaining_ids = [f["id"] for f in get_resp.json()["fields"]]
    assert field_id not in remaining_ids


async def test_field_tree_includes_levels(client, db):
    csv_bytes = _make_csv(["cat"], [["a"], ["b"], ["a"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "T"},
    )
    sid = resp.json()["id"]
    tree = await client.get(f"/api/v1/uploads/{sid}/field-tree")
    assert tree.status_code == 200
    all_fields = tree.json()["fields"] + tree.json()["unassigned_fields"]
    cat_field = next(f for f in all_fields if f["field_key"] == "cat")
    assert "levels" in cat_field


async def test_upsert_and_delete_level(client, db):
    csv_bytes = _make_csv(["x"], [["1"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "T"},
    )
    sid = resp.json()["id"]
    field_id = resp.json()["fields"][0]["id"]

    put_resp = await client.put(
        f"/api/v1/uploads/{sid}/fields/{field_id}/levels",
        json={"raw_value": "1", "display_label": "One", "sort_order": 0},
    )
    assert put_resp.status_code == 200
    level_id = put_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/uploads/{sid}/fields/{field_id}/levels/{level_id}")
    assert del_resp.status_code == 204


async def test_resolve_row_with_upload_field_id(client, db):
    from src.models.collection import Collection, CollectionType
    from src.models.dataset import Dataset
    from src.models.field import Field, FieldType
    from src.models.package import Package

    pkg = Package(name="P upload_field", slug="p-upload-field-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="C",
        slug="c-upload-field-test",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    ds = Dataset(name="Wave Ref", slug="wave-ref-upload-field-test", collection_id=col.id)
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    f1 = Field(
        field_key="gender",
        display_name="Gender",
        field_type=FieldType.categorical,
        dataset_id=ds.id,
    )
    f2 = Field(
        field_key="region",
        display_name="Region",
        field_type=FieldType.categorical,
        dataset_id=ds.id,
    )
    db.add(f1)
    db.add(f2)
    await db.flush()

    csv_bytes = _make_csv(["gender"], [["male"], ["female"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave New", "collection_id": str(col.id)},
    )
    assert resp.status_code == 201
    sess = resp.json()

    await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile",
        json={"reference_dataset_id": ds.id},
    )

    rows_resp = await client.get(
        f"/api/v1/uploads/{sess['id']}/reconcile?group=old_only&page_size=1"
    )
    assert rows_resp.status_code == 200
    items = rows_resp.json()["items"]
    assert len(items) >= 1, "Expected at least one old_only row (region not in upload)"
    row_id = items[0]["id"]

    sess_resp = await client.get(f"/api/v1/uploads/{sess['id']}")
    upload_field_id = sess_resp.json()["fields"][0]["id"]

    patch = await client.patch(
        f"/api/v1/uploads/{sess['id']}/reconcile/{row_id}",
        json={"upload_field_id": upload_field_id, "status": "confirmed"},
    )
    assert patch.status_code == 200
    assert patch.json()["upload_field_id"] == upload_field_id


async def test_reconcile_counts_includes_status_counts(client, db):
    from tests.test_reconciliation_api import _seed_ref_dataset, _upload

    col, ref_ds = await _seed_ref_dataset(db)
    sess = await _upload(client, col.id)
    await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile",
        json={"reference_dataset_id": ref_ds.id},
    )
    resp = await client.get(f"/api/v1/uploads/{sess['id']}/reconcile/counts")
    assert resp.status_code == 200
    body = resp.json()
    assert "status_counts" in body
    assert isinstance(body["status_counts"], dict)
    assert len(body["status_counts"]) >= 1
