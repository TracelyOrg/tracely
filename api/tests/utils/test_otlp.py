from __future__ import annotations

import uuid

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

from app.utils.otlp import extract_spans, parse_otlp_request


def _make_kv(key: str, value: str) -> KeyValue:
    return KeyValue(key=key, value=AnyValue(string_value=value))


def _make_int_kv(key: str, value: int) -> KeyValue:
    return KeyValue(key=key, value=AnyValue(int_value=value))


def _build_otlp_request(
    service_name: str = "test-service",
    framework: str = "fastapi",
    environment: str = "production",
    span_name: str = "GET /api/users",
    span_type: str = "span",
    kind: int = 2,  # SERVER
    status_code: int = 1,  # OK
    http_method: str = "GET",
    http_route: str = "/api/users",
    http_status_code: int = 200,
    start_nanos: int = 1_700_000_000_000_000_000,
    end_nanos: int = 1_700_000_000_050_000_000,
) -> ExportTraceServiceRequest:
    """Build a minimal valid OTLP ExportTraceServiceRequest."""
    resource_attrs = [
        _make_kv("service.name", service_name),
        _make_kv("tracely.framework", framework),
        _make_kv("tracely.environment", environment),
    ]
    span_attrs = [
        _make_kv("tracely.span_type", span_type),
        _make_kv("http.request.method", http_method),
        _make_kv("http.route", http_route),
        _make_kv("http.response.status_code", str(http_status_code)),
        _make_kv("tracely.request.body", '{"foo":"bar"}'),
        _make_kv("tracely.response.body", '{"result":"ok"}'),
        _make_kv("tracely.request.headers", '{"content-type":"application/json"}'),
        _make_kv("tracely.response.headers", '{"x-req-id":"abc"}'),
        _make_kv("custom.tag", "my-value"),
    ]
    span = Span(
        trace_id=bytes.fromhex("0af7651916cd43dd8448eb211c80319c"),
        span_id=bytes.fromhex("b7ad6b7169203331"),
        parent_span_id=b"",
        name=span_name,
        kind=kind,
        start_time_unix_nano=start_nanos,
        end_time_unix_nano=end_nanos,
        attributes=span_attrs,
        status=Status(code=status_code),
    )
    return ExportTraceServiceRequest(
        resource_spans=[
            ResourceSpans(
                resource=Resource(attributes=resource_attrs),
                scope_spans=[ScopeSpans(spans=[span])],
            )
        ]
    )


# ── parse_otlp_request ──────────────────────────────────────────────


def test_parse_valid_protobuf():
    req = _build_otlp_request()
    raw = req.SerializeToString()

    parsed = parse_otlp_request(raw)

    assert len(parsed.resource_spans) == 1
    assert len(parsed.resource_spans[0].scope_spans[0].spans) == 1


def test_parse_empty_protobuf():
    parsed = parse_otlp_request(b"")
    assert len(parsed.resource_spans) == 0


def test_parse_malformed_protobuf():
    with pytest.raises(ValueError, match="Malformed OTLP protobuf payload"):
        # Invalid protobuf: a non-empty byte string that isn't valid protobuf
        # Note: protobuf is lenient with random bytes; use truly invalid data
        parse_otlp_request(b"\xff\xfe\xfd\xfc\xfb\xfa")


# ── extract_spans ────────────────────────────────────────────────────


def test_extract_spans_basic_mapping():
    req = _build_otlp_request()
    raw = req.SerializeToString()
    parsed = parse_otlp_request(raw)
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    spans = extract_spans(parsed, org_id, project_id, len(raw))

    assert len(spans) == 1
    s = spans[0]

    assert s["org_id"] == str(org_id)
    assert s["project_id"] == str(project_id)
    assert s["trace_id"] == "0af7651916cd43dd8448eb211c80319c"
    assert s["span_id"] == "b7ad6b7169203331"
    assert s["parent_span_id"] == ""
    assert s["span_name"] == "GET /api/users"
    assert s["span_type"] == "span"
    assert s["service_name"] == "test-service"
    assert s["framework"] == "fastapi"
    assert s["environment"] == "production"
    assert s["kind"] == "SERVER"
    assert s["status_code"] == "OK"
    assert s["http_method"] == "GET"
    assert s["http_route"] == "/api/users"
    assert s["http_status_code"] == 200
    assert s["request_body"] == '{"foo":"bar"}'
    assert s["response_body"] == '{"result":"ok"}'
    assert s["request_headers"] == '{"content-type":"application/json"}'
    assert s["response_headers"] == '{"x-req-id":"abc"}'
    assert s["row_size_bytes"] > 0


def test_extract_spans_duration_calculation():
    start = 1_700_000_000_000_000_000
    end = 1_700_000_000_050_000_000  # 50ms later
    req = _build_otlp_request(start_nanos=start, end_nanos=end)
    parsed = parse_otlp_request(req.SerializeToString())

    spans = extract_spans(parsed, uuid.uuid4(), uuid.uuid4(), 100)

    assert abs(spans[0]["duration_ms"] - 50.0) < 0.01


def test_extract_spans_pending_span_type():
    req = _build_otlp_request(span_type="pending_span", end_nanos=0)
    parsed = parse_otlp_request(req.SerializeToString())

    spans = extract_spans(parsed, uuid.uuid4(), uuid.uuid4(), 100)

    assert spans[0]["span_type"] == "pending_span"
    assert spans[0]["duration_ms"] == 0.0


def test_extract_spans_error_status():
    req = _build_otlp_request(status_code=2, http_status_code=500)
    parsed = parse_otlp_request(req.SerializeToString())

    spans = extract_spans(parsed, uuid.uuid4(), uuid.uuid4(), 100)

    assert spans[0]["status_code"] == "ERROR"
    assert spans[0]["http_status_code"] == 500


def test_extract_spans_kind_mapping():
    for otlp_kind, expected in [(0, "INTERNAL"), (1, "INTERNAL"), (2, "SERVER"), (3, "CLIENT"), (4, "PRODUCER"), (5, "CONSUMER")]:
        req = _build_otlp_request(kind=otlp_kind)
        parsed = parse_otlp_request(req.SerializeToString())
        spans = extract_spans(parsed, uuid.uuid4(), uuid.uuid4(), 100)
        assert spans[0]["kind"] == expected, f"kind={otlp_kind} should map to {expected}"


def test_extract_spans_general_attributes_exclude_tracely():
    """tracely.* attributes should be extracted into specific fields, not general attributes."""
    req = _build_otlp_request()
    parsed = parse_otlp_request(req.SerializeToString())

    spans = extract_spans(parsed, uuid.uuid4(), uuid.uuid4(), 100)

    attrs = spans[0]["attributes"]
    # custom.tag should be in general attributes
    assert "custom.tag" in attrs
    assert attrs["custom.tag"] == "my-value"
    # tracely.* should NOT be in general attributes
    assert not any(k.startswith("tracely.") for k in attrs)


def test_extract_spans_row_size_bytes_distribution():
    """row_size_bytes should be divided among spans in the payload."""
    req = _build_otlp_request()
    # Add a second span
    second_span = Span(
        trace_id=bytes.fromhex("0af7651916cd43dd8448eb211c80319c"),
        span_id=bytes.fromhex("1234567890abcdef"),
        name="child-span",
        kind=1,
        start_time_unix_nano=1_700_000_000_000_000_000,
        end_time_unix_nano=1_700_000_000_010_000_000,
        status=Status(code=0),
    )
    req.resource_spans[0].scope_spans[0].spans.append(second_span)
    raw = req.SerializeToString()
    parsed = parse_otlp_request(raw)

    spans = extract_spans(parsed, uuid.uuid4(), uuid.uuid4(), 1000)

    assert len(spans) == 2
    assert spans[0]["row_size_bytes"] == 500
    assert spans[1]["row_size_bytes"] == 500


def test_extract_spans_empty_request():
    """Empty request returns no spans."""
    req = ExportTraceServiceRequest()
    spans = extract_spans(req, uuid.uuid4(), uuid.uuid4(), 0)
    assert spans == []
