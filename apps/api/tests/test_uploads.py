import csv
import io

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
