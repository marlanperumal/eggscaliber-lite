from abc import ABC, abstractmethod
from typing import Any


class DataWorker(ABC):
    @abstractmethod
    async def fetch(
        self,
        dataset_id: int,
        field_keys: list[str],
        filters: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Return normalized rows as {field_key: value}.

        Args:
            dataset_id: the Dataset to query
            field_keys: if non-empty, only include these keys in each row
            filters: {field_key: exact_value} — rows not matching all filters
                     are excluded
        """
        ...

    @abstractmethod
    async def count(self, dataset_id: int, filters: dict[str, Any]) -> int:
        """Return count of matching rows — the base value denominator."""
        ...
