from sqlalchemy.orm import Session

from src.models.dataset import Dataset, WorkerType
from src.workers.base import DataWorker
from src.workers.jsonb_response import JsonbResponseWorker


class WorkerFactory:
    @staticmethod
    def for_dataset(dataset: Dataset, session: Session) -> DataWorker:
        match dataset.worker_type:
            case WorkerType.jsonb_response:
                return JsonbResponseWorker(session)
            case _:
                # Future: ExternalTableWorker(session, dataset.worker_config)
                return JsonbResponseWorker(session)
