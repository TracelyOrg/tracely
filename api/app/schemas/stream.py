from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SpanSummary(BaseModel):
    """Lightweight span summary for SSE broadcast to dashboard clients.

    Excludes heavy fields (request/response bodies, headers, attributes)
    to keep SSE payloads small and fast.
    """

    trace_id: str
    span_id: str
    parent_span_id: str
    span_name: str
    span_type: str
    service_name: str
    kind: str
    start_time: str
    duration_ms: float
    status_code: str
    http_method: str
    http_route: str
    http_status_code: int


def build_span_summary(span_row: dict[str, Any]) -> SpanSummary:
    """Convert an ingested span row dict to a SpanSummary for SSE broadcast."""
    start_time = span_row["start_time"]
    if isinstance(start_time, datetime):
        start_time = start_time.isoformat()

    return SpanSummary(
        trace_id=span_row["trace_id"],
        span_id=span_row["span_id"],
        parent_span_id=span_row.get("parent_span_id", ""),
        span_name=span_row["span_name"],
        span_type=span_row["span_type"],
        service_name=span_row["service_name"],
        kind=span_row["kind"],
        start_time=start_time,
        duration_ms=span_row["duration_ms"],
        status_code=span_row["status_code"],
        http_method=span_row.get("http_method", ""),
        http_route=span_row.get("http_route", ""),
        http_status_code=span_row.get("http_status_code", 0),
    )
