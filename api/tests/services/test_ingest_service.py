from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, KeyValue
from opentelemetry.proto.resource.v1.resource_pb2 import Resource
from opentelemetry.proto.trace.v1.trace_pb2 import (
    ResourceSpans,
    ScopeSpans,
    Span,
    Status,
)

from app.services.ingest_service import SPANS_COLUMNS, ingest_traces


def _make_kv(key: str, value: str) -> KeyValue:
    return KeyValue(key=key, value=AnyValue(string_value=value))


def _build_valid_payload(
    service_name: str = "my-service",
    span_name: str = "GET /health",
) -> bytes:
    """Build a valid OTLP protobuf payload with one span."""
    resource_attrs = [
        _make_kv("service.name", service_name),
        _make_kv("tracely.framework", "fastapi"),
        _make_kv("tracely.environment", "test"),
    ]
    span_attrs = [
        _make_kv("tracely.span_type", "span"),
        _make_kv("http.request.method", "GET"),
        _make_kv("http.route", "/health"),
        _make_kv("http.response.status_code", "200"),
    ]
    span = Span(
        trace_id=bytes.fromhex("0af7651916cd43dd8448eb211c80319c"),
        span_id=bytes.fromhex("b7ad6b7169203331"),
        name=span_name,
        kind=2,  # SERVER
        start_time_unix_nano=1_700_000_000_000_000_000,
        end_time_unix_nano=1_700_000_000_050_000_000,
        attributes=span_attrs,
        status=Status(code=1),  # OK
    )
    req = ExportTraceServiceRequest(
        resource_spans=[
            ResourceSpans(
                resource=Resource(attributes=resource_attrs),
                scope_spans=[ScopeSpans(spans=[span])],
            )
        ]
    )
    return req.SerializeToString()


# ── ingest_traces ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ingest_traces_inserts_into_clickhouse():
    """Valid payload → spans inserted into ClickHouse."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    payload = _build_valid_payload()

    mock_client = MagicMock()
    mock_client.insert = MagicMock()

    with patch("app.services.ingest_service.get_clickhouse_client", return_value=mock_client):
        count = await ingest_traces(payload, org_id, project_id)

    assert count == 1
    mock_client.insert.assert_called_once()
    call_args = mock_client.insert.call_args
    assert call_args[0][0] == "spans"  # table name
    assert call_args[1]["column_names"] == SPANS_COLUMNS

    # Verify the inserted row data
    rows = call_args[0][1]
    assert len(rows) == 1
    row = rows[0]
    # org_id is first column
    assert row[0] == str(org_id)
    # project_id is second column
    assert row[1] == str(project_id)


@pytest.mark.asyncio
async def test_ingest_traces_returns_span_count():
    """Multiple spans → returns correct count."""
    span1 = Span(
        trace_id=bytes.fromhex("0af7651916cd43dd8448eb211c80319c"),
        span_id=bytes.fromhex("b7ad6b7169203331"),
        name="span-1",
        kind=2,
        start_time_unix_nano=1_700_000_000_000_000_000,
        end_time_unix_nano=1_700_000_000_050_000_000,
        status=Status(code=1),
    )
    span2 = Span(
        trace_id=bytes.fromhex("0af7651916cd43dd8448eb211c80319c"),
        span_id=bytes.fromhex("1234567890abcdef"),
        name="span-2",
        kind=1,
        start_time_unix_nano=1_700_000_000_000_000_000,
        end_time_unix_nano=1_700_000_000_010_000_000,
        status=Status(code=0),
    )
    req = ExportTraceServiceRequest(
        resource_spans=[
            ResourceSpans(
                resource=Resource(
                    attributes=[_make_kv("service.name", "svc")]
                ),
                scope_spans=[ScopeSpans(spans=[span1, span2])],
            )
        ]
    )
    payload = req.SerializeToString()
    mock_client = MagicMock()

    with patch("app.services.ingest_service.get_clickhouse_client", return_value=mock_client):
        count = await ingest_traces(payload, uuid.uuid4(), uuid.uuid4())

    assert count == 2


@pytest.mark.asyncio
async def test_ingest_traces_empty_payload():
    """Empty OTLP request → 0 spans, no insert call."""
    req = ExportTraceServiceRequest()
    payload = req.SerializeToString()

    mock_client = MagicMock()
    with patch("app.services.ingest_service.get_clickhouse_client", return_value=mock_client):
        count = await ingest_traces(payload, uuid.uuid4(), uuid.uuid4())

    assert count == 0
    mock_client.insert.assert_not_called()


@pytest.mark.asyncio
async def test_ingest_traces_malformed_payload_raises():
    """Malformed protobuf → ValueError."""
    with pytest.raises(ValueError, match="Malformed OTLP protobuf payload"):
        await ingest_traces(b"\xff\xfe\xfd\xfc\xfb\xfa", uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_ingest_traces_row_size_bytes():
    """row_size_bytes reflects payload size."""
    payload = _build_valid_payload()

    mock_client = MagicMock()
    with patch("app.services.ingest_service.get_clickhouse_client", return_value=mock_client):
        await ingest_traces(payload, uuid.uuid4(), uuid.uuid4())

    rows = mock_client.insert.call_args[0][1]
    # row_size_bytes is the last column
    row_size_idx = SPANS_COLUMNS.index("row_size_bytes")
    assert rows[0][row_size_idx] == len(payload)


@pytest.mark.asyncio
async def test_ingest_traces_column_ordering():
    """Inserted rows follow SPANS_COLUMNS order."""
    payload = _build_valid_payload()
    mock_client = MagicMock()

    with patch("app.services.ingest_service.get_clickhouse_client", return_value=mock_client):
        await ingest_traces(payload, uuid.uuid4(), uuid.uuid4())

    call_args = mock_client.insert.call_args
    assert call_args[1]["column_names"] == SPANS_COLUMNS
    row = call_args[0][1][0]
    assert len(row) == len(SPANS_COLUMNS)
