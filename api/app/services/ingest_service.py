from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from app.db.clickhouse import get_clickhouse_client
from app.schemas.stream import build_span_summary
from app.services import alert_counters
from app.services.stream_manager import connection_manager
from app.utils.otlp import extract_spans, parse_otlp_request

logger = logging.getLogger(__name__)

SPANS_COLUMNS = [
    "org_id",
    "project_id",
    "trace_id",
    "span_id",
    "parent_span_id",
    "span_name",
    "span_type",
    "service_name",
    "framework",
    "environment",
    "kind",
    "start_time",
    "end_time",
    "duration_ms",
    "status_code",
    "status_message",
    "http_method",
    "http_route",
    "http_status_code",
    "request_body",
    "response_body",
    "request_headers",
    "response_headers",
    "attributes",
    "row_size_bytes",
]


async def ingest_traces(
    raw_body: bytes,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
) -> int:
    """Parse OTLP protobuf payload and insert spans into ClickHouse.

    Returns the number of spans inserted.
    Raises ValueError for malformed payloads.
    """
    payload_size = len(raw_body)
    request = parse_otlp_request(raw_body)
    spans = extract_spans(request, org_id, project_id, payload_size)

    if not spans:
        return 0

    # Build column-oriented data for batch insert
    rows: list[list[Any]] = []
    for span in spans:
        row = [span[col] for col in SPANS_COLUMNS]
        rows.append(row)

    client = get_clickhouse_client()
    await asyncio.to_thread(
        client.insert,
        "spans",
        rows,
        column_names=SPANS_COLUMNS,
    )

    # Update alert counters for critical alert evaluation (non-blocking)
    # Count errors and requests for inline critical alert evaluation
    error_count = sum(1 for span in spans if span.get("status_code") == "ERROR")
    request_count = len(spans)

    # Fire-and-forget counter updates
    asyncio.create_task(_update_alert_counters(project_id, error_count, request_count))

    # Broadcast span summaries to connected SSE clients (fire-and-forget)
    if connection_manager.connection_count(project_id) > 0:
        for span in spans:
            summary = build_span_summary(span)
            event = {
                "event": "span",
                "data": summary.model_dump_json(),
            }
            connection_manager.broadcast(project_id, event)

    logger.info(
        "Ingested %d spans for project %s (org %s), payload %d bytes",
        len(spans),
        project_id,
        org_id,
        payload_size,
    )
    return len(spans)


async def _update_alert_counters(
    project_id: uuid.UUID,
    error_count: int,
    request_count: int,
) -> None:
    """Update Redis alert counters for critical alert evaluation.

    This runs as a fire-and-forget task to avoid slowing down ingestion.
    """
    try:
        # Increment counters for each span
        for _ in range(request_count):
            await alert_counters.increment_request_count(project_id)

        for _ in range(error_count):
            await alert_counters.increment_error_count(project_id)

    except Exception as e:
        logger.warning("Failed to update alert counters: %s", e)
