from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SpanDetail(BaseModel):
    """Full span detail for the Span Inspector panel.

    Includes all ClickHouse columns: request/response bodies, headers,
    attributes, timing, and error information.
    """

    trace_id: str
    span_id: str
    parent_span_id: str
    span_name: str
    span_type: str
    service_name: str
    framework: str
    environment: str
    kind: str
    start_time: str
    end_time: str
    duration_ms: float
    status_code: str
    status_message: str
    http_method: str
    http_route: str
    http_status_code: int
    request_body: str
    response_body: str
    request_headers: dict[str, str]
    response_headers: dict[str, str]
    attributes: dict[str, str]


def _parse_json_string(raw: str) -> dict[str, str]:
    """Safely parse a JSON string stored in ClickHouse into a dict.

    Returns an empty dict if the value is empty or malformed.
    """
    if not raw or not raw.strip():
        return {}
    import json

    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return {str(k): str(v) for k, v in parsed.items()}
        return {}
    except (json.JSONDecodeError, TypeError):
        return {}


def build_span_detail(row_dict: dict[str, Any]) -> SpanDetail:
    """Convert a raw ClickHouse row dict into a SpanDetail model.

    Handles datetime conversion and JSON string parsing for headers.
    """
    # Convert datetime fields to ISO strings
    for field in ("start_time", "end_time"):
        val = row_dict.get(field)
        if isinstance(val, datetime):
            row_dict[field] = val.isoformat()
        elif not isinstance(val, str):
            row_dict[field] = str(val) if val else ""

    # Parse JSON header strings into dicts
    row_dict["request_headers"] = _parse_json_string(
        row_dict.get("request_headers", "")
    )
    row_dict["response_headers"] = _parse_json_string(
        row_dict.get("response_headers", "")
    )

    # Ensure attributes is a dict (ClickHouse Map returns dict natively)
    attrs = row_dict.get("attributes")
    if not isinstance(attrs, dict):
        row_dict["attributes"] = {}

    return SpanDetail(**row_dict)
