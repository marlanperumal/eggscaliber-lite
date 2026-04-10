from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import Any


class DataWorker(ABC):
    @abstractmethod
    def fetch(
        self,
        dataset_id: int,
        field_keys: list[str],
        filters: dict[str, Any],
    ) -> Iterator[dict[str, Any]]:
        """Yield normalized rows as {field_key: value}.

        Args:
            dataset_id: the Dataset to query
            field_keys: if non-empty, only include these keys in each row
            filters: {field_key: exact_value} — rows not matching all filters
                     are excluded
        """
        ...

    @abstractmethod
    def count(self, dataset_id: int, filters: dict[str, Any]) -> int:
        """Return count of matching rows — the base value denominator."""
        ...
