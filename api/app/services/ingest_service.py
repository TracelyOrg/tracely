from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from app.db.clickhouse import get_clickhouse_client
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

    logger.info(
        "Ingested %d spans for project %s (org %s), payload %d bytes",
        len(spans),
        project_id,
        org_id,
        payload_size,
    )
    return len(spans)
