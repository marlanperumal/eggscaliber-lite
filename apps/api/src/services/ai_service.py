import json

# ── Stream encoding ────────────────────────────────────────────────────────────


def encode_text_chunk(text: str) -> str:
    return f"0:{json.dumps(text)}\n"


def encode_annotation_part(data: dict) -> str:
    return f"a:{json.dumps([data])}\n"


def encode_finish(finish_reason: str = "stop") -> str:
    return f"d:{json.dumps({'finishReason': finish_reason})}\n"


def encode_error(message: str) -> str:
    return f"3:{json.dumps(message)}\n"
