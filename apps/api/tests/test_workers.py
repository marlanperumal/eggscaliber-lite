import pytest
from src.models.response import Response
from src.workers.factory import WorkerFactory
from src.workers.jsonb_response import JsonbResponseWorker


@pytest.fixture
async def worker_dataset(bare_dataset, db):
    """bare_dataset + 3 responses for worker tests."""
    for payload in [
        {"gender": "Male", "age_group": "18-34"},
        {"gender": "Female", "age_group": "35-54"},
        {"gender": "Male", "age_group": "18-34"},
    ]:
        db.add(Response(dataset_id=bare_dataset.id, payload=payload))
    await db.flush()
    return bare_dataset


async def test_jsonb_worker_fetch_all_rows(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = await worker.fetch(worker_dataset.id, field_keys=[], filters={})
    assert len(rows) == 3


async def test_jsonb_worker_fetch_with_field_keys(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = await worker.fetch(worker_dataset.id, field_keys=["gender"], filters={})
    assert all(set(r.keys()) == {"gender"} for r in rows)


async def test_jsonb_worker_fetch_with_filter(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = await worker.fetch(worker_dataset.id, field_keys=[], filters={"gender": "Male"})
    assert len(rows) == 2
    assert all(r["gender"] == "Male" for r in rows)


async def test_jsonb_worker_fetch_with_multiple_filters(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    rows = await worker.fetch(
        worker_dataset.id, field_keys=[], filters={"gender": "Male", "age_group": "18-34"}
    )
    assert len(rows) == 2
    assert all(r["gender"] == "Male" for r in rows)
    assert all(r["age_group"] == "18-34" for r in rows)


async def test_jsonb_worker_count(worker_dataset, db):
    worker = JsonbResponseWorker(db)
    assert await worker.count(worker_dataset.id, filters={}) == 3
    assert await worker.count(worker_dataset.id, filters={"gender": "Female"}) == 1


async def test_factory_returns_jsonb_worker_for_default(worker_dataset, db):
    worker = WorkerFactory.for_dataset(worker_dataset, db)
    assert isinstance(worker, JsonbResponseWorker)
