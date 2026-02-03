from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from app.schemas.stream import SpanSummary, build_span_summary


def _make_span_row(**overrides) -> dict:
    """Build a span row dict as returned by extract_spans()."""
    defaults = {
        "org_id": str(uuid.uuid4()),
        "project_id": str(uuid.uuid4()),
        "trace_id": "0af7651916cd43dd8448eb211c80319c",
        "span_id": "b7ad6b7169203331",
        "parent_span_id": "",
        "span_name": "GET /health",
        "span_type": "span",
        "service_name": "my-service",
        "framework": "fastapi",
        "environment": "production",
        "kind": "SERVER",
        "start_time": datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        "end_time": datetime(2025, 1, 1, 12, 0, 0, 50000, tzinfo=timezone.utc),
        "duration_ms": 50.0,
        "status_code": "OK",
        "status_message": "",
        "http_method": "GET",
        "http_route": "/health",
        "http_status_code": 200,
        "request_body": "",
        "response_body": "",
        "request_headers": "",
        "response_headers": "",
        "attributes": {},
        "row_size_bytes": 512,
    }
    defaults.update(overrides)
    return defaults


# ── SpanSummary schema ───────────────────────────────────────────────


def test_span_summary_from_span_row():
    """SpanSummary can be built from a span row dict."""
    row = _make_span_row()
    summary = build_span_summary(row)

    assert isinstance(summary, SpanSummary)
    assert summary.trace_id == "0af7651916cd43dd8448eb211c80319c"
    assert summary.span_id == "b7ad6b7169203331"
    assert summary.span_name == "GET /health"
    assert summary.span_type == "span"
    assert summary.service_name == "my-service"
    assert summary.http_method == "GET"
    assert summary.http_route == "/health"
    assert summary.http_status_code == 200
    assert summary.status_code == "OK"
    assert summary.duration_ms == 50.0
    assert summary.kind == "SERVER"


def test_span_summary_pending_span():
    """SpanSummary works for pending_span type."""
    row = _make_span_row(span_type="pending_span", duration_ms=0.0, end_time=datetime(1970, 1, 1, tzinfo=timezone.utc))
    summary = build_span_summary(row)

    assert summary.span_type == "pending_span"
    assert summary.duration_ms == 0.0


def test_span_summary_serializes_to_json():
    """SpanSummary serializes to JSON (for SSE data field)."""
    row = _make_span_row()
    summary = build_span_summary(row)
    json_str = summary.model_dump_json()

    assert '"trace_id"' in json_str
    assert '"span_id"' in json_str
    assert '"span_name"' in json_str


def test_span_summary_start_time_is_iso_string():
    """SpanSummary start_time is serialized as ISO string."""
    row = _make_span_row()
    summary = build_span_summary(row)

    assert isinstance(summary.start_time, str)
    # Should be parseable as ISO datetime
    datetime.fromisoformat(summary.start_time)


def test_span_summary_excludes_heavy_fields():
    """SpanSummary does NOT include request_body, response_body, headers, attributes."""
    row = _make_span_row(
        request_body='{"user":"test"}',
        response_body='{"ok":true}',
        request_headers='{"Authorization":"Bearer x"}',
        response_headers='{"Content-Type":"application/json"}',
        attributes={"custom.key": "value"},
    )
    summary = build_span_summary(row)
    data = summary.model_dump()

    assert "request_body" not in data
    assert "response_body" not in data
    assert "request_headers" not in data
    assert "response_headers" not in data
    assert "attributes" not in data


def test_span_summary_includes_parent_span_id():
    """SpanSummary includes parent_span_id for trace hierarchy display."""
    row = _make_span_row(parent_span_id="aabbccdd11223344")
    summary = build_span_summary(row)

    assert summary.parent_span_id == "aabbccdd11223344"
