import csv
import io


def _csv(headers, rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    for r in rows:
        csv.writer(buf).writerow(r)
    return buf.getvalue().encode()


async def _session(client):
    csv_bytes = _csv(["gender", "age"], [["male", "3"]])
    r = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "W3"},
    )
    return r.json()


async def test_get_field_tree_returns_groups_and_fields(client, db):
    sess = await _session(client)
    resp = await client.get(f"/api/v1/uploads/{sess['id']}/field-tree")
    assert resp.status_code == 200
    data = resp.json()
    assert "groups" in data
    assert "unassigned_fields" in data
    assert len(data["unassigned_fields"]) == 2


async def test_create_fieldgroup(client, db):
    sess = await _session(client)
    resp = await client.post(
        f"/api/v1/uploads/{sess['id']}/fieldgroups", json={"name": "Demographics"}
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Demographics"


async def test_move_field_to_group(client, db):
    sess = await _session(client)
    grp = await client.post(f"/api/v1/uploads/{sess['id']}/fieldgroups", json={"name": "Demo"})
    grp_id = grp.json()["id"]
    field_id = sess["fields"][0]["id"]
    resp = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}/move",
        json={"upload_fieldgroup_id": grp_id},
    )
    assert resp.status_code == 200
    assert resp.json()["upload_fieldgroup_id"] == grp_id


async def test_update_field_display_name(client, db):
    sess = await _session(client)
    field_id = sess["fields"][0]["id"]
    resp = await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}",
        json={"display_name": "Sex"},
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Sex"


async def test_delete_fieldgroup_moves_fields_to_unassigned(client, db):
    sess = await _session(client)
    grp = await client.post(f"/api/v1/uploads/{sess['id']}/fieldgroups", json={"name": "Demo"})
    grp_id = grp.json()["id"]
    field_id = sess["fields"][0]["id"]
    await client.patch(
        f"/api/v1/uploads/{sess['id']}/fields/{field_id}/move",
        json={"upload_fieldgroup_id": grp_id},
    )
    resp = await client.delete(f"/api/v1/uploads/{sess['id']}/fieldgroups/{grp_id}")
    assert resp.status_code == 200
    # Field should now be unassigned
    tree = await client.get(f"/api/v1/uploads/{sess['id']}/field-tree")
    unassigned_ids = [f["id"] for f in tree.json()["unassigned_fields"]]
    assert field_id in unassigned_ids
