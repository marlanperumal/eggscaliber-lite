import pytest
from src.models.response import Response
from src.workers.factory import WorkerFactory
from src.workers.jsonb_response import JsonbResponseWorker


@pytest.fixture
def worker_dataset(bare_dataset, db):
    """bare_dataset + 3 responses for worker tests."""
    for payload in [
        {"gender": "Male", "age_group": "18-34"},
        {"gender": "Female", "age_group": "35-54"},
        {"gender": "Male", "age_group": "18-34"},
    ]:
        db.add(Response(dataset_id=bare_dataset.id, payload=payload))
    db.flush()
    return bare_dataset


def test_jsonb_worker_fetch_all_rows(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(worker_dataset.id, field_keys=[], filters={}))
    assert len(rows) == 3


def test_jsonb_worker_fetch_with_field_keys(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(worker_dataset.id, field_keys=["gender"], filters={}))
    assert all(set(r.keys()) == {"gender"} for r in rows)


def test_jsonb_worker_fetch_with_filter(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = list(worker.fetch(worker_dataset.id, field_keys=[], filters={"gender": "Male"}))
    assert len(rows) == 2
    assert all(r["gender"] == "Male" for r in rows)


def test_jsonb_worker_count(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    assert worker.count(worker_dataset.id, filters={}) == 3
    assert worker.count(worker_dataset.id, filters={"gender": "Female"}) == 1


def test_factory_returns_jsonb_worker_for_default(worker_dataset, db):
    worker = WorkerFactory.for_dataset(worker_dataset, db)
    assert isinstance(worker, JsonbResponseWorker)
