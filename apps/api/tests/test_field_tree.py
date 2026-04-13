from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.level import Level
from src.repositories import analytics_repo
from src.services import analytics_service


async def test_get_field_tree_empty_dataset(db, bare_dataset):
    tree = await analytics_service.get_field_tree(db, bare_dataset.id)
    assert tree.groups == []
    assert tree.ungrouped_fields == []


async def test_get_field_tree_returns_groups_and_fields(db, bare_dataset):
    grp = FieldGroup(name="Brand", slug="brand", sort_order=0, dataset_id=bare_dataset.id)
    db.add(grp)
    await db.flush()
    await db.refresh(grp)
    f1 = Field(
        field_key="brand_rating",
        display_name="Brand Rating",
        field_type=FieldType.ordinal,
        dataset_id=bare_dataset.id,
        group_id=grp.id,
    )
    f2 = Field(
        field_key="gender",
        display_name="Gender",
        field_type=FieldType.categorical,
        dataset_id=bare_dataset.id,
    )
    db.add_all([f1, f2])
    await db.flush()

    tree = await analytics_service.get_field_tree(db, bare_dataset.id)
    assert len(tree.groups) == 1
    assert tree.groups[0].name == "Brand"
    assert len(tree.groups[0].fields) == 1
    assert tree.groups[0].fields[0].field_key == "brand_rating"
    assert len(tree.ungrouped_fields) == 1
    assert tree.ungrouped_fields[0].field_key == "gender"


async def test_get_field_tree_nested_groups(db, bare_dataset):
    parent = FieldGroup(name="Parent", slug="parent", sort_order=0, dataset_id=bare_dataset.id)
    db.add(parent)
    await db.flush()
    await db.refresh(parent)
    child = FieldGroup(
        name="Child", slug="child", sort_order=0, dataset_id=bare_dataset.id, parent_id=parent.id
    )
    db.add(child)
    await db.flush()
    await db.refresh(child)
    db.add(
        Field(
            field_key="f1",
            display_name="F1",
            field_type=FieldType.categorical,
            dataset_id=bare_dataset.id,
            group_id=child.id,
        )
    )
    await db.flush()

    tree = await analytics_service.get_field_tree(db, bare_dataset.id)
    assert len(tree.groups) == 1
    assert tree.groups[0].name == "Parent"
    assert len(tree.groups[0].children) == 1
    assert tree.groups[0].children[0].name == "Child"
    assert len(tree.groups[0].children[0].fields) == 1


async def test_get_field_tree_excludes_identifier_and_weight(db, bare_dataset):
    db.add(
        Field(
            field_key="rid",
            display_name="ID",
            field_type=FieldType.identifier,
            dataset_id=bare_dataset.id,
        )
    )
    db.add(
        Field(
            field_key="wt",
            display_name="Weight",
            field_type=FieldType.weight,
            dataset_id=bare_dataset.id,
        )
    )
    await db.flush()
    tree = await analytics_service.get_field_tree(db, bare_dataset.id)
    all_keys = [f.field_key for f in tree.ungrouped_fields]
    assert "rid" not in all_keys
    assert "wt" not in all_keys


async def test_get_weight_fields(db, bare_dataset):
    db.add(
        Field(
            field_key="pw",
            display_name="Panel Weight",
            field_type=FieldType.weight,
            dataset_id=bare_dataset.id,
        )
    )
    db.add(
        Field(
            field_key="brand_rating",
            display_name="Brand Rating",
            field_type=FieldType.ordinal,
            dataset_id=bare_dataset.id,
        )
    )
    await db.flush()
    weights = await analytics_repo.get_weight_fields(db, bare_dataset.id)
    assert len(weights) == 1
    assert weights[0].field_key == "pw"


async def test_get_field_metas(db, bare_dataset):
    f = Field(
        field_key="brand_rating",
        display_name="Brand Rating",
        field_type=FieldType.ordinal,
        dataset_id=bare_dataset.id,
    )
    db.add(f)
    await db.flush()
    await db.refresh(f)
    db.add(Level(value="good", display_label="Good", sort_order=0, field_id=f.id))
    db.add(Level(value="poor", display_label="Poor", sort_order=1, field_id=f.id))
    await db.flush()

    metas = await analytics_repo.get_field_metas(db, bare_dataset.id, ["brand_rating"])
    assert "brand_rating" in metas
    assert metas["brand_rating"]["field_type"] == FieldType.ordinal
    assert metas["brand_rating"]["levels"] == ["good", "poor"]


# ─── Route tests ─────────────────────────────────────────────────────────────


async def test_get_field_tree_endpoint_not_found(client):
    resp = await client.get("/api/v1/datasets/99999/field-tree")
    assert resp.status_code == 404


async def test_get_field_tree_endpoint_returns_tree(client, db, bare_dataset):
    grp = FieldGroup(name="Brand", slug="brand", sort_order=0, dataset_id=bare_dataset.id)
    db.add(grp)
    await db.flush()
    await db.refresh(grp)
    db.add(
        Field(
            field_key="brand_rating",
            display_name="Brand Rating",
            field_type=FieldType.ordinal,
            dataset_id=bare_dataset.id,
            group_id=grp.id,
        )
    )
    await db.flush()

    resp = await client.get(f"/api/v1/datasets/{bare_dataset.id}/field-tree")
    assert resp.status_code == 200
    data = resp.json()
    assert "groups" in data
    assert "ungrouped_fields" in data
    assert data["groups"][0]["name"] == "Brand"


async def test_get_weight_fields_endpoint(client, db, bare_dataset):
    db.add(
        Field(
            field_key="pw",
            display_name="Panel Weight",
            field_type=FieldType.weight,
            dataset_id=bare_dataset.id,
        )
    )
    await db.flush()

    resp = await client.get(f"/api/v1/datasets/{bare_dataset.id}/weight-fields")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["field_key"] == "pw"


async def test_get_weight_fields_endpoint_not_found(client):
    resp = await client.get("/api/v1/datasets/99999/weight-fields")
    assert resp.status_code == 404
