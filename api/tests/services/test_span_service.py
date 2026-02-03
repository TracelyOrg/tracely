from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.services.span_service import get_span_by_id, get_span_history


@pytest.fixture
def org_id():
    return uuid.uuid4()


@pytest.fixture
def project_id():
    return uuid.uuid4()


def _make_ch_row(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    span_id: str = "span-1",
    start_time: str = "2026-02-03T10:00:00.000000000",
    http_status_code: int = 200,
) -> dict:
    """Return a dict representing a ClickHouse span row."""
    return {
        "org_id": str(org_id),
        "project_id": str(project_id),
        "trace_id": "trace-1",
        "span_id": span_id,
        "parent_span_id": "",
        "span_name": "GET /api/users",
        "span_type": "span",
        "service_name": "api",
        "kind": "SERVER",
        "start_time": start_time,
        "duration_ms": 42.0,
        "status_code": "OK",
        "http_method": "GET",
        "http_route": "/api/users",
        "http_status_code": http_status_code,
    }


@pytest.mark.asyncio
async def test_get_span_history_returns_spans(org_id, project_id):
    """get_span_history returns SpanSummary list from ClickHouse."""
    rows = [
        _make_ch_row(org_id, project_id, span_id="span-1"),
        _make_ch_row(org_id, project_id, span_id="span-2"),
    ]

    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.column_names = list(rows[0].keys())
    mock_result.result_rows = [list(r.values()) for r in rows]
    mock_client.query.return_value = mock_result

    with patch("app.services.span_service.get_clickhouse_client", return_value=mock_client):
        result = await get_span_history(
            org_id=org_id,
            project_id=project_id,
            limit=50,
        )

    assert len(result) == 2
    assert result[0].span_id == "span-1"
    assert result[1].span_id == "span-2"


@pytest.mark.asyncio
async def test_get_span_history_with_before_cursor(org_id, project_id):
    """get_span_history passes 'before' cursor to ClickHouse query."""
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.column_names = list(_make_ch_row(org_id, project_id).keys())
    mock_result.result_rows = []
    mock_client.query.return_value = mock_result

    before = datetime(2026, 2, 3, 9, 0, 0, tzinfo=timezone.utc)

    with patch("app.services.span_service.get_clickhouse_client", return_value=mock_client):
        await get_span_history(
            org_id=org_id,
            project_id=project_id,
            before=before,
            limit=50,
        )

    # Verify the query was called with parameters including the before cursor
    call_args = mock_client.query.call_args
    query_str = call_args[0][0]
    assert "start_time <" in query_str


@pytest.mark.asyncio
async def test_get_span_history_empty_result(org_id, project_id):
    """get_span_history returns empty list when no spans found."""
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.column_names = []
    mock_result.result_rows = []
    mock_client.query.return_value = mock_result

    with patch("app.services.span_service.get_clickhouse_client", return_value=mock_client):
        result = await get_span_history(
            org_id=org_id,
            project_id=project_id,
            limit=50,
        )

    assert result == []


@pytest.mark.asyncio
async def test_get_span_history_respects_limit(org_id, project_id):
    """get_span_history passes the limit to the ClickHouse query."""
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.column_names = []
    mock_result.result_rows = []
    mock_client.query.return_value = mock_result

    with patch("app.services.span_service.get_clickhouse_client", return_value=mock_client):
        await get_span_history(
            org_id=org_id,
            project_id=project_id,
            limit=25,
        )

    call_args = mock_client.query.call_args
    query_str = call_args[0][0]
    assert "LIMIT 25" in query_str


@pytest.mark.asyncio
async def test_get_span_history_scopes_by_org_and_project(org_id, project_id):
    """get_span_history always scopes query by org_id AND project_id (multi-tenant)."""
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.column_names = []
    mock_result.result_rows = []
    mock_client.query.return_value = mock_result

    with patch("app.services.span_service.get_clickhouse_client", return_value=mock_client):
        await get_span_history(
            org_id=org_id,
            project_id=project_id,
            limit=50,
        )

    call_args = mock_client.query.call_args
    query_str = call_args[0][0]
    params = call_args[1].get("parameters", call_args[0][1] if len(call_args[0]) > 1 else {})
    assert "org_id" in query_str
    assert "project_id" in query_str


# --- get_span_by_id tests (Story 3.3) ---


def _make_detail_row(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    span_id: str = "span-1",
    status_code: str = "OK",
    http_status_code: int = 200,
    request_headers: str = '{"Content-Type": "application/json"}',
    response_headers: str = '{"X-Request-Id": "abc123"}',
) -> dict:
    """Return a dict representing a full ClickHouse span row for detail queries."""
    return {
        "trace_id": "trace-1",
        "span_id": span_id,
        "parent_span_id": "",
        "span_name": "GET /api/users",
        "span_type": "span",
        "service_name": "api",
        "framework": "fastapi",
        "environment": "production",
        "kind": "SERVER",
        "start_time": "2026-02-03T10:00:00.000000000",
        "end_time": "2026-02-03T10:00:00.042000000",
        "duration_ms": 42.0,
        "status_code": status_code,
        "status_message": "",
        "http_method": "GET",
        "http_route": "/api/users",
        "http_status_code": http_status_code,
        "request_body": '{"query": "test"}',
        "response_body": '{"users": []}',
        "request_headers": request_headers,
        "response_headers": response_headers,
        "attributes": {"custom.key": "value"},
    }


@pytest.mark.asyncio
async def test_get_span_by_id_returns_span_detail(org_id, project_id):
    """get_span_by_id returns a SpanDetail when span exists."""
    row = _make_detail_row(org_id, project_id)

    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.column_names = list(row.keys())
    mock_result.result_rows = [list(row.values())]
    mock_client.query.return_value = mock_result

    with patch("app.services.span_service.get_clickhouse_client", return_value=mock_client):
        result = await get_span_by_id(
            org_id=org_id,
            project_id=project_id,
            span_id="span-1",
        )

    assert result is not None
    assert result.span_id == "span-1"
    assert result.framework == "fastapi"
    assert result.request_body == '{"query": "test"}'
    assert result.request_headers == {"Content-Type": "application/json"}
    assert result.response_headers == {"X-Request-Id": "abc123"}
    assert result.attributes == {"custom.key": "value"}


@pytest.mark.asyncio
async def test_get_span_by_id_returns_none_when_not_found(org_id, project_id):
    """get_span_by_id returns None when span doesn't exist."""
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.result_rows = []
    mock_client.query.return_value = mock_result

    with patch("app.services.span_service.get_clickhouse_client", return_value=mock_client):
        result = await get_span_by_id(
            org_id=org_id,
            project_id=project_id,
            span_id="nonexistent",
        )

    assert result is None


@pytest.mark.asyncio
async def test_get_span_by_id_scopes_by_org_and_project(org_id, project_id):
    """get_span_by_id query includes org_id and project_id for multi-tenant isolation."""
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.result_rows = []
    mock_client.query.return_value = mock_result

    with patch("app.services.span_service.get_clickhouse_client", return_value=mock_client):
        await get_span_by_id(
            org_id=org_id,
            project_id=project_id,
            span_id="span-1",
        )

    query_str = mock_client.query.call_args[0][0]
    assert "org_id" in query_str
    assert "project_id" in query_str
    assert "span_id" in query_str


@pytest.mark.asyncio
async def test_get_span_by_id_parses_malformed_headers(org_id, project_id):
    """get_span_by_id gracefully handles malformed JSON in headers."""
    row = _make_detail_row(
        org_id, project_id,
        request_headers="not valid json",
        response_headers="",
    )

    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.column_names = list(row.keys())
    mock_result.result_rows = [list(row.values())]
    mock_client.query.return_value = mock_result

    with patch("app.services.span_service.get_clickhouse_client", return_value=mock_client):
        result = await get_span_by_id(
            org_id=org_id,
            project_id=project_id,
            span_id="span-1",
        )

    assert result is not None
    assert result.request_headers == {}
    assert result.response_headers == {}
