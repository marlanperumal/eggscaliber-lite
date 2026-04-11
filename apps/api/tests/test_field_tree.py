from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset, WorkerType
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.package import Package
from src.repositories import analytics_repo


def _seed_dataset(db):
    pkg = Package(name="P", slug="p")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)
    col = Collection(name="C", slug="c", package_id=pkg.id, collection_type=CollectionType.survey)
    db.add(col)
    db.flush()
    db.refresh(col)
    ds = Dataset(
        name="D",
        slug="d",
        collection_id=col.id,
        worker_type=WorkerType.jsonb_response,
        sort_order=0,
    )
    db.add(ds)
    db.flush()
    db.refresh(ds)
    return ds


def test_get_field_tree_empty_dataset(db):
    ds = _seed_dataset(db)
    tree = analytics_repo.get_field_tree(db, ds.id)
    assert tree["groups"] == []
    assert tree["ungrouped_fields"] == []


def test_get_field_tree_returns_groups_and_fields(db):
    ds = _seed_dataset(db)
    grp = FieldGroup(name="Brand", slug="brand", sort_order=0, dataset_id=ds.id)
    db.add(grp)
    db.flush()
    db.refresh(grp)
    f1 = Field(
        field_key="brand_rating",
        display_name="Brand Rating",
        field_type=FieldType.ordinal,
        dataset_id=ds.id,
        group_id=grp.id,
    )
    f2 = Field(
        field_key="gender",
        display_name="Gender",
        field_type=FieldType.categorical,
        dataset_id=ds.id,
    )
    db.add_all([f1, f2])
    db.flush()

    tree = analytics_repo.get_field_tree(db, ds.id)
    assert len(tree["groups"]) == 1
    assert tree["groups"][0]["name"] == "Brand"
    assert len(tree["groups"][0]["fields"]) == 1
    assert tree["groups"][0]["fields"][0]["field_key"] == "brand_rating"
    assert len(tree["ungrouped_fields"]) == 1
    assert tree["ungrouped_fields"][0]["field_key"] == "gender"


def test_get_field_tree_nested_groups(db):
    ds = _seed_dataset(db)
    parent = FieldGroup(name="Parent", slug="parent", sort_order=0, dataset_id=ds.id)
    db.add(parent)
    db.flush()
    db.refresh(parent)
    child = FieldGroup(
        name="Child", slug="child", sort_order=0, dataset_id=ds.id, parent_id=parent.id
    )
    db.add(child)
    db.flush()
    db.refresh(child)
    db.add(
        Field(
            field_key="f1",
            display_name="F1",
            field_type=FieldType.categorical,
            dataset_id=ds.id,
            group_id=child.id,
        )
    )
    db.flush()

    tree = analytics_repo.get_field_tree(db, ds.id)
    assert len(tree["groups"]) == 1
    assert tree["groups"][0]["name"] == "Parent"
    assert len(tree["groups"][0]["children"]) == 1
    assert tree["groups"][0]["children"][0]["name"] == "Child"
    assert len(tree["groups"][0]["children"][0]["fields"]) == 1


def test_get_field_tree_excludes_identifier_and_weight(db):
    ds = _seed_dataset(db)
    db.add(
        Field(
            field_key="rid",
            display_name="ID",
            field_type=FieldType.identifier,
            dataset_id=ds.id,
        )
    )
    db.add(
        Field(
            field_key="wt",
            display_name="Weight",
            field_type=FieldType.weight,
            dataset_id=ds.id,
        )
    )
    db.flush()
    tree = analytics_repo.get_field_tree(db, ds.id)
    all_keys = [f["field_key"] for f in tree["ungrouped_fields"]]
    assert "rid" not in all_keys
    assert "wt" not in all_keys


def test_get_weight_fields(db):
    ds = _seed_dataset(db)
    db.add(
        Field(
            field_key="pw",
            display_name="Panel Weight",
            field_type=FieldType.weight,
            dataset_id=ds.id,
        )
    )
    db.add(
        Field(
            field_key="brand_rating",
            display_name="Brand Rating",
            field_type=FieldType.ordinal,
            dataset_id=ds.id,
        )
    )
    db.flush()
    weights = analytics_repo.get_weight_fields(db, ds.id)
    assert len(weights) == 1
    assert weights[0].field_key == "pw"


def test_get_field_metas(db):
    from src.models.level import Level

    ds = _seed_dataset(db)
    f = Field(
        field_key="brand_rating",
        display_name="Brand Rating",
        field_type=FieldType.ordinal,
        dataset_id=ds.id,
    )
    db.add(f)
    db.flush()
    db.refresh(f)
    db.add(Level(value="good", display_label="Good", sort_order=0, field_id=f.id))
    db.add(Level(value="poor", display_label="Poor", sort_order=1, field_id=f.id))
    db.flush()

    metas = analytics_repo.get_field_metas(db, ds.id, ["brand_rating"])
    assert "brand_rating" in metas
    assert metas["brand_rating"]["field_type"] == FieldType.ordinal
    assert metas["brand_rating"]["levels"] == ["good", "poor"]


# ─── Route tests ─────────────────────────────────────────────────────────────


def test_get_field_tree_endpoint_not_found(client):
    resp = client.get("/api/v1/datasets/99999/field-tree")
    assert resp.status_code == 404


def test_get_field_tree_endpoint_returns_tree(client, db):
    ds = _seed_dataset(db)
    grp = FieldGroup(name="Brand", slug="brand", sort_order=0, dataset_id=ds.id)
    db.add(grp)
    db.flush()
    db.refresh(grp)
    db.add(
        Field(
            field_key="brand_rating",
            display_name="Brand Rating",
            field_type=FieldType.ordinal,
            dataset_id=ds.id,
            group_id=grp.id,
        )
    )
    db.flush()

    resp = client.get(f"/api/v1/datasets/{ds.id}/field-tree")
    assert resp.status_code == 200
    data = resp.json()
    assert "groups" in data
    assert "ungrouped_fields" in data
    assert data["groups"][0]["name"] == "Brand"


def test_get_weight_fields_endpoint(client, db):
    ds = _seed_dataset(db)
    db.add(
        Field(
            field_key="pw",
            display_name="Panel Weight",
            field_type=FieldType.weight,
            dataset_id=ds.id,
        )
    )
    db.flush()

    resp = client.get(f"/api/v1/datasets/{ds.id}/weight-fields")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["field_key"] == "pw"


def test_get_weight_fields_endpoint_not_found(client):
    resp = client.get("/api/v1/datasets/99999/weight-fields")
    assert resp.status_code == 404
