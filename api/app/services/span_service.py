from __future__ import annotations

import asyncio
import uuid
from datetime import datetime

from app.db.clickhouse import get_clickhouse_client
from app.schemas.span import SpanDetail, build_span_detail
from app.schemas.stream import SpanSummary

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
]

_COLUMNS_SQL = ", ".join(_HISTORY_COLUMNS)


async def get_span_history(
    *,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    before: datetime | None = None,
    limit: int = 50,
) -> list[SpanSummary]:
    """Query historical spans from ClickHouse with cursor-based pagination.

    Returns spans ordered by start_time DESC (newest first), which the
    frontend reverses to prepend oldest-at-top.

    Args:
        org_id: Organization scope (multi-tenant isolation).
        project_id: Project filter.
        before: Cursor — only return spans with start_time < this value.
        limit: Max rows to return.
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
