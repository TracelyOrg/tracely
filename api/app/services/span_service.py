from __future__ import annotations

import asyncio
import uuid
from datetime import datetime

from app.db.clickhouse import get_clickhouse_client
from app.schemas.span import SpanDetail, build_span_detail
from app.schemas.stream import SpanSummary, TraceSpan

# Columns to select for span history (matches SpanSummary fields)
_HISTORY_COLUMNS = [
    "trace_id",
    "span_id",
    "parent_span_id",
    "span_name",
    "span_type",
    "service_name",
    "kind",
    "start_time",
    "duration_ms",
    "status_code",
    "http_method",
    "http_route",
    "http_status_code",
    "environment",
]

_COLUMNS_SQL = ", ".join(_HISTORY_COLUMNS)


async def get_span_history(
    *,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    before: datetime | None = None,
    after: datetime | None = None,
    limit: int = 50,
    service: str | None = None,
    status_groups: list[str] | None = None,
    endpoint_search: str | None = None,
) -> list[SpanSummary]:
    """Query historical spans from ClickHouse with cursor-based pagination and filters.

    Returns spans ordered by start_time DESC (newest first), which the
    frontend reverses to prepend oldest-at-top.

    Args:
        org_id: Organization scope (multi-tenant isolation).
        project_id: Project filter.
        before: Cursor — only return spans with start_time < this value.
        after: Only return spans with start_time >= this value.
        limit: Max rows to return.
        service: Filter by service_name (exact match).
        status_groups: Filter by HTTP status code groups (e.g. ["4xx", "5xx"]).
        endpoint_search: Filter by http_route substring (case-insensitive).
    """
    client = get_clickhouse_client()

    where_clauses = [
        "org_id = %(org_id)s",
        "project_id = %(project_id)s",
        "span_type = 'span'",
    ]
    params: dict = {
        "org_id": str(org_id),
        "project_id": str(project_id),
    }

    if before is not None:
        where_clauses.append("start_time < %(before)s")
        params["before"] = before.isoformat()

    if after is not None:
        where_clauses.append("start_time >= %(after)s")
        params["after"] = after.isoformat()

    if service is not None:
        where_clauses.append("service_name = %(service)s")
        params["service"] = service

    if status_groups:
        # Build OR conditions for status code ranges
        range_conditions = []
        for group in status_groups:
            if group == "2xx":
                range_conditions.append("(http_status_code >= 200 AND http_status_code < 300)")
            elif group == "3xx":
                range_conditions.append("(http_status_code >= 300 AND http_status_code < 400)")
            elif group == "4xx":
                range_conditions.append("(http_status_code >= 400 AND http_status_code < 500)")
            elif group == "5xx":
                range_conditions.append("(http_status_code >= 500 AND http_status_code < 600)")
        if range_conditions:
            where_clauses.append(f"({' OR '.join(range_conditions)})")

    if endpoint_search:
        where_clauses.append("positionCaseInsensitive(http_route, %(endpoint_search)s) > 0")
        params["endpoint_search"] = endpoint_search

    where_sql = " AND ".join(where_clauses)

    query = (
        f"SELECT {_COLUMNS_SQL} FROM spans"
        f" WHERE {where_sql}"
        f" ORDER BY start_time DESC"
        f" LIMIT {limit}"
    )

    result = await asyncio.to_thread(
        client.query, query, parameters=params
    )

    if not result.result_rows:
        return []

    col_names = result.column_names
    rows = []
    for row in result.result_rows:
        row_dict = dict(zip(col_names, row))
        # Convert start_time to ISO string if it's a datetime
        st = row_dict.get("start_time")
        if isinstance(st, datetime):
            row_dict["start_time"] = st.isoformat()
        elif not isinstance(st, str):
            row_dict["start_time"] = str(st)
        rows.append(SpanSummary(**row_dict))

    return rows


# --- Span detail (Story 3.3) ---

# All columns for the full span detail view
_DETAIL_COLUMNS = [
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
]

_DETAIL_COLUMNS_SQL = ", ".join(_DETAIL_COLUMNS)


async def get_span_by_id(
    *,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    span_id: str,
) -> SpanDetail | None:
    """Fetch a single span with full detail from ClickHouse.

    Returns None if the span is not found or not accessible within the
    given org/project scope.
    """
    client = get_clickhouse_client()

    query = (
        f"SELECT {_DETAIL_COLUMNS_SQL} FROM spans"
        " WHERE org_id = %(org_id)s"
        " AND project_id = %(project_id)s"
        " AND span_id = %(span_id)s"
        " LIMIT 1"
    )

    result = await asyncio.to_thread(
        client.query,
        query,
        parameters={
            "org_id": str(org_id),
            "project_id": str(project_id),
            "span_id": span_id,
        },
    )

    if not result.result_rows:
        return None

    row_dict = dict(zip(result.column_names, result.result_rows[0]))
    return build_span_detail(row_dict)


# --- Trace spans (Story 3.4) ---


_TRACE_COLUMNS = _HISTORY_COLUMNS + ["attributes"]
_TRACE_COLUMNS_SQL = ", ".join(_TRACE_COLUMNS)


async def get_trace_spans(
    *,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    trace_id: str,
) -> list[TraceSpan]:
    """Fetch all completed spans belonging to a trace, ordered by start_time ASC.

    Used by the Trace Waterfall view to build the hierarchical span tree.
    Includes attributes (for span events / log events).
    Only returns span_type='span' (excludes pending_span).
    """
    client = get_clickhouse_client()

    query = (
        f"SELECT {_TRACE_COLUMNS_SQL} FROM spans"
        " WHERE org_id = %(org_id)s"
        " AND project_id = %(project_id)s"
        " AND trace_id = %(trace_id)s"
        " AND span_type = 'span'"
        " ORDER BY start_time ASC"
        " LIMIT 500"
    )

    result = await asyncio.to_thread(
        client.query,
        query,
        parameters={
            "org_id": str(org_id),
            "project_id": str(project_id),
            "trace_id": trace_id,
        },
    )

    if not result.result_rows:
        return []

    col_names = result.column_names
    rows = []
    for row in result.result_rows:
        row_dict = dict(zip(col_names, row))
        st = row_dict.get("start_time")
        if isinstance(st, datetime):
            row_dict["start_time"] = st.isoformat()
        elif not isinstance(st, str):
            row_dict["start_time"] = str(st)
        # Ensure attributes is a dict
        attrs = row_dict.get("attributes")
        if not isinstance(attrs, dict):
            row_dict["attributes"] = {}
        rows.append(TraceSpan(**row_dict))

    return rows
