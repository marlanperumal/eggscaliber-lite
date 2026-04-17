"""Reconciliation engine — pure functions, no DB access."""

from dataclasses import dataclass

from src.models.field import Field
from src.models.level import Level
from src.models.reconciliation import ReconciliationGroup, ReconciliationStatus

_EDIT_DIST_THRESHOLD = 3
_LEVEL_OVERLAP_THRESHOLD = 0.5


@dataclass
class ClassifyResult:
    group: ReconciliationGroup
    status: ReconciliationStatus
    confidence: float | None
    note: str


def edit_distance(a: str, b: str) -> int:
    """Levenshtein distance (case-sensitive)."""
    if a == b:
        return 0
    lb = len(b)
    prev = list(range(lb + 1))
    for i, ca in enumerate(a, 1):
        curr = [i] + [0] * lb
        for j, cb in enumerate(b, 1):
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (0 if ca == cb else 1))
        prev = curr
    return prev[lb]


def level_overlap(new_vals: set[str], ref_vals: set[str]) -> float:
    if not new_vals and not ref_vals:
        return 1.0
    if not new_vals or not ref_vals:
        return 0.0
    return len(new_vals & ref_vals) / len(new_vals | ref_vals)


def classify_row(
    new_field: Field,
    new_levels: list[Level],
    ref_field: Field | None,
    ref_levels: list[Level],
) -> ClassifyResult:
    if ref_field is None:
        return ClassifyResult(
            group=ReconciliationGroup.new_only,
            status=ReconciliationStatus.auto_accepted,
            confidence=None,
            note="No matching field in reference dataset",
        )

    new_vals = {lv.value for lv in new_levels}
    ref_vals = {lv.value for lv in ref_levels}
    key_dist = edit_distance(new_field.field_key, ref_field.field_key)
    overlap = level_overlap(new_vals, ref_vals)

    keys_match = new_field.field_key == ref_field.field_key
    levels_match = (not new_vals and not ref_vals) or overlap >= 0.9

    if keys_match and levels_match:
        return ClassifyResult(
            group=ReconciliationGroup.exact,
            status=ReconciliationStatus.auto_accepted,
            confidence=1.0,
            note="Exact key and level match",
        )

    if key_dist < _EDIT_DIST_THRESHOLD or overlap >= _LEVEL_OVERLAP_THRESHOLD:
        confidence = round(max((1 - key_dist / 10), overlap), 2)
        parts = []
        if key_dist > 0:
            parts.append(f"key differs by {key_dist} char(s)")
        if 0 < overlap < 0.9:
            parts.append(f"{int(overlap * 100)}% level overlap")
        return ClassifyResult(
            group=ReconciliationGroup.probable,
            status=ReconciliationStatus.pending,
            confidence=confidence,
            note=", ".join(parts) or "Probable match",
        )

    return ClassifyResult(
        group=ReconciliationGroup.new_only,
        status=ReconciliationStatus.auto_accepted,
        confidence=None,
        note="No close match found in reference dataset",
    )
