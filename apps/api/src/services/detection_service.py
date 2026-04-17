"""CSV field type detection heuristics.

All functions are pure (no DB access) — call with header list + sample rows.
"""

import re
from dataclasses import dataclass, field

from src.models.field import FieldType

_IDENTIFIER_PATTERNS = re.compile(
    r"^(respondent[_\s]?id|resp[_\s]?id|id|uuid|record[_\s]?id)$", re.IGNORECASE
)
_WEIGHT_PATTERNS = re.compile(r"^(weight|wgt|w|wt)$", re.IGNORECASE)
_MULTI_SIBLING = re.compile(r"^(.+)_(\d+)$")
_OTHER_SUFFIX = re.compile(r"^(.+)_other$", re.IGNORECASE)

# Thresholds
_ORDINAL_MAX_DISTINCT = 10
_CATEGORICAL_MAX_DISTINCT = 50
_SAMPLE_ROWS = 200


def slugify_key(raw: str) -> str:
    """Lowercase, replace non-alphanumeric runs with underscore, strip edges."""
    s = raw.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


@dataclass
class DetectedField:
    field_key: str
    original_header: str
    detected_type: FieldType
    distinct_values: list[str] = field(default_factory=list)
    confidence: str = "high"  # "high" | "review"


def detect_fields(headers: list[str], rows: list[dict[str, str]]) -> list[DetectedField]:
    """Return one DetectedField per header, in original order."""
    sample = rows[:_SAMPLE_ROWS]
    slugged = [slugify_key(h) for h in headers]
    header_set = set(slugged)

    # Find multi_response sibling groups: {base_key: [col1, col2, ...]}
    sibling_groups: dict[str, list[str]] = {}
    for key in slugged:
        m = _MULTI_SIBLING.match(key)
        if m:
            base = m.group(1)
            sibling_groups.setdefault(base, []).append(key)
    # Only count as multi_response if >= 2 siblings
    multi_keys: set[str] = set()
    for _base, members in sibling_groups.items():
        if len(members) >= 2:
            multi_keys.update(members)

    results: list[DetectedField] = []
    for original, key in zip(headers, slugged, strict=True):
        det_type, distinct, confidence = _classify(key, original, sample, multi_keys, header_set)
        results.append(
            DetectedField(
                field_key=key,
                original_header=original,
                detected_type=det_type,
                distinct_values=distinct,
                confidence=confidence,
            )
        )
    return results


def _classify(
    key: str,
    original: str,
    sample: list[dict[str, str]],
    multi_keys: set[str],
    all_keys: set[str],
) -> tuple[FieldType, list[str], str]:
    # Name-pattern checks first (highest priority)
    if _IDENTIFIER_PATTERNS.match(key) or _IDENTIFIER_PATTERNS.match(original):
        return FieldType.identifier, [], "high"
    if _WEIGHT_PATTERNS.match(key) or _WEIGHT_PATTERNS.match(original):
        return FieldType.weight, [], "high"
    # _other companions — not independently typed; mark as categorical for now
    if _OTHER_SUFFIX.match(key):
        return FieldType.categorical, [], "review"
    if key in multi_keys:
        return FieldType.multi_response, [], "high"

    # Collect non-empty values using original header (rows keyed by original header)
    vals = [r[original].strip() for r in sample if r.get(original, "").strip()]
    distinct = list(dict.fromkeys(vals))  # preserve insertion order, dedupe

    if not vals:
        return FieldType.categorical, distinct, "review"

    all_numeric = all(_is_numeric(v) for v in vals)
    n_distinct = len(set(vals))

    if all_numeric and n_distinct <= _ORDINAL_MAX_DISTINCT:
        return FieldType.ordinal, distinct, "high"
    if all_numeric:
        return FieldType.numeric, distinct, "high"
    if n_distinct <= _CATEGORICAL_MAX_DISTINCT:
        return FieldType.categorical, distinct, "high"
    # High-cardinality string — treat as categorical but flag for review
    return FieldType.categorical, distinct[:50], "review"


def _is_numeric(v: str) -> bool:
    try:
        float(v)
        return True
    except ValueError:
        return False
