import csv
import io

from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level
from src.models.package import Package


def _csv(headers, rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerows(rows)
    return buf.getvalue().encode()


async def _seed_ref_dataset(db):
    pkg = Package(name="P", slug="p-recon-api-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="C", slug="c-recon-api-test", package_id=pkg.id, collection_type=CollectionType.survey
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    ds = Dataset(name="Wave 2", slug="wave-2-recon-test", collection_id=col.id)
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    f = Field(
        field_key="gender",
        display_name="Gender",
        field_type=FieldType.categorical,
        dataset_id=ds.id,
    )
    db.add(f)
    await db.flush()
    await db.refresh(f)
    db.add(Level(value="male", display_label="Male", sort_order=0, field_id=f.id))
    db.add(Level(value="female", display_label="Female", sort_order=1, field_id=f.id))
    await db.flush()
    return col, ds


async def _upload(client, col_id):
    csv_bytes = _csv(["gender", "age"], [["male", "3"], ["female", "5"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3", "collection_id": str(col_id)},
    )
    assert resp.status_code == 201
    return resp.json()


async def test_trigger_reconciliation_creates_rows(client, db):
    col, ref_ds = await _seed_ref_dataset(db)
    sess = await _upload(client, col.id)
    resp = await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile",
        json={"reference_dataset_id": ref_ds.id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2  # gender (exact/probable) + age (new_only)


async def test_list_reconciliation_rows_paginated(client, db):
    col, ref_ds = await _seed_ref_dataset(db)
    sess = await _upload(client, col.id)
    await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile", json={"reference_dataset_id": ref_ds.id}
    )
    resp = await client.get(f"/api/v1/uploads/{sess['id']}/reconcile?page_size=1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert "next_cursor" in data


async def test_bulk_resolve_rows(client, db):
    col, ref_ds = await _seed_ref_dataset(db)
    sess = await _upload(client, col.id)
    await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile", json={"reference_dataset_id": ref_ds.id}
    )
    ids_resp = await client.get(f"/api/v1/uploads/{sess['id']}/reconcile/ids")
    ids = ids_resp.json()["ids"]
    resp = await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile/bulk",
        json={"ids": ids, "action": "excluded"},
    )
    assert resp.status_code == 200
    assert resp.json()["resolved"] == len(ids)


async def test_reconcile_list_includes_field_keys(client, db):
    col, ref_ds = await _seed_ref_dataset(db)
    sess = await _upload(client, col.id)
    await client.post(
        f"/api/v1/uploads/{sess['id']}/reconcile", json={"reference_dataset_id": ref_ds.id}
    )
    resp = await client.get(f"/api/v1/uploads/{sess['id']}/reconcile")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) > 0
    for item in items:
        if item["upload_field_id"] is not None:
            assert item.get("field_key") is not None
        if item["ref_field_id"] is not None:
            assert item.get("ref_field_key") is not None


async def test_trigger_reconcile_with_ref_only_field_creates_old_only_row(client, db):
    col, ref_ds = await _seed_ref_dataset(db)
    csv_bytes = _csv(["age"], [["25"], ["30"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3", "collection_id": str(col.id)},
    )
    assert resp.status_code == 201
    sid = resp.json()["id"]

    await client.post(
        f"/api/v1/uploads/{sid}/reconcile",
        json={"reference_dataset_id": ref_ds.id},
    )
    rows_resp = await client.get(f"/api/v1/uploads/{sid}/reconcile?group=old_only")
    assert rows_resp.status_code == 200
    items = rows_resp.json()["items"]
    assert len(items) == 1
    assert items[0]["ref_field_key"] == "gender"
    assert items[0]["upload_field_id"] is None


async def test_trigger_reconcile_with_near_match_field_key_links_to_ref(client, db):
    col, ref_ds = await _seed_ref_dataset(db)
    csv_bytes = _csv(["gende"], [["male"], ["female"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3", "collection_id": str(col.id)},
    )
    assert resp.status_code == 201
    sid = resp.json()["id"]

    await client.post(
        f"/api/v1/uploads/{sid}/reconcile",
        json={"reference_dataset_id": ref_ds.id},
    )
    rows_resp = await client.get(f"/api/v1/uploads/{sid}/reconcile")
    assert rows_resp.status_code == 200
    items = rows_resp.json()["items"]

    gende_rows = [r for r in items if r.get("field_key") == "gende"]
    assert len(gende_rows) == 1
    assert gende_rows[0]["ref_field_key"] == "gender"
    assert gende_rows[0]["group"] == "probable"
