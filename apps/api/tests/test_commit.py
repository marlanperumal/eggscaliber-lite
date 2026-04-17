import csv
import io

from src.models.collection import Collection, CollectionType
from src.models.package import Package


def _csv(headers, rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerows(rows)
    return buf.getvalue().encode()


async def _seed_collection(db):
    pkg = Package(name="P", slug="p-commit-test")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    col = Collection(
        name="C", slug="c-commit-test", package_id=pkg.id, collection_type=CollectionType.survey
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    return col


async def test_commit_creates_dataset_fields_and_responses(client, db):
    col = await _seed_collection(db)
    csv_bytes = _csv(["gender", "age"], [["male", "3"], ["female", "5"]])
    upload = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3", "collection_id": str(col.id)},
    )
    sess_id = upload.json()["id"]

    resp = await client.post(f"/api/v1/uploads/{sess_id}/commit")
    assert resp.status_code == 201
    data = resp.json()
    assert "dataset_id" in data
    dataset_id = data["dataset_id"]

    # Verify dataset exists via existing endpoint
    ds_resp = await client.get(f"/api/v1/datasets/{dataset_id}")
    assert ds_resp.status_code == 200
    ds = ds_resp.json()
    assert ds["name"] == "Wave 3"
    assert len(ds["fields"]) == 2


async def test_datasets_list_returns_committed(client, db):
    col = await _seed_collection(db)
    csv_bytes = _csv(["q1"], [["yes"], ["no"]])
    upload = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave List Test", "collection_id": str(col.id)},
    )
    await client.post(f"/api/v1/uploads/{upload.json()['id']}/commit")
    resp = await client.get("/api/v1/datasets")
    assert resp.status_code == 200
    names = [d["name"] for d in resp.json()["items"]]
    assert "Wave List Test" in names
