from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.package import Package
from src.models.response import Response
from src.workers.jsonb_response import JsonbResponseWorker


def _seed_worker_dataset(db):
    """Create a minimal dataset with 3 responses."""
    pkg = Package(name="P", slug="p-worker-test")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)
    col = Collection(
        name="C", slug="c-worker-test", package_id=pkg.id, collection_type=CollectionType.survey
    )
    db.add(col)
    db.flush()
    db.refresh(col)

    ds = Dataset(name="W1", slug="w1", collection_id=col.id, sort_order=1)
    db.add(ds)
    db.flush()
    db.refresh(ds)

    for payload in [
        {"gender": "Male", "age_group": "18-34"},
        {"gender": "Female", "age_group": "35-54"},
        {"gender": "Male", "age_group": "18-34"},
    ]:
        db.add(Response(dataset_id=ds.id, payload=payload))
    db.flush()
    return ds


def test_jsonb_worker_fetch_all_rows(db):
    ds = _seed_worker_dataset(db)
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(ds.id, field_keys=[], filters={}))
    assert len(rows) == 3


def test_jsonb_worker_fetch_with_field_keys(db):
    ds = _seed_worker_dataset(db)
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(ds.id, field_keys=["gender"], filters={}))
    assert all(set(r.keys()) == {"gender"} for r in rows)


def test_jsonb_worker_fetch_with_filter(db):
    ds = _seed_worker_dataset(db)
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(ds.id, field_keys=[], filters={"gender": "Male"}))
    assert len(rows) == 2
    assert all(r["gender"] == "Male" for r in rows)


def test_jsonb_worker_count(db):
    ds = _seed_worker_dataset(db)
    worker = JsonbResponseWorker(db)
    assert worker.count(ds.id, filters={}) == 3
    assert worker.count(ds.id, filters={"gender": "Female"}) == 1
