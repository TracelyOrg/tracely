from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, KeyValue
from opentelemetry.proto.trace.v1.trace_pb2 import Span as OtlpSpan

# OTLP span kind mapping → ClickHouse Enum8 string values
SPAN_KIND_MAP: dict[int, str] = {
    0: "INTERNAL",  # SPAN_KIND_UNSPECIFIED → treat as INTERNAL
    1: "INTERNAL",
    2: "SERVER",
    3: "CLIENT",
    4: "PRODUCER",
    5: "CONSUMER",
}

# OTLP status code mapping → ClickHouse Enum8 string values
STATUS_CODE_MAP: dict[int, str] = {
    0: "UNSET",
    1: "OK",
    2: "ERROR",
}


def _nanos_to_datetime(nanos: int) -> datetime:
    """Convert nanosecond timestamp to Python datetime (UTC)."""
    if nanos == 0:
        return datetime(1970, 1, 1, tzinfo=timezone.utc)
    seconds = nanos / 1_000_000_000
    return datetime.fromtimestamp(seconds, tz=timezone.utc)


def _nanos_to_duration_ms(start_nanos: int, end_nanos: int) -> float:
    """Calculate duration in milliseconds from nanosecond timestamps."""
    if end_nanos == 0 or start_nanos == 0:
        return 0.0
    return (end_nanos - start_nanos) / 1_000_000


def _bytes_to_hex(b: bytes) -> str:
    """Convert bytes to hex string (for trace_id and span_id)."""
    return b.hex()


def _anyvalue_to_str(val: AnyValue) -> str:
    """Convert OTLP AnyValue to string representation."""
    if val.HasField("string_value"):
        return val.string_value
    if val.HasField("int_value"):
        return str(val.int_value)
    if val.HasField("double_value"):
        return str(val.double_value)
    if val.HasField("bool_value"):
        return str(val.bool_value).lower()
    if val.HasField("bytes_value"):
        return val.bytes_value.hex()
    if val.HasField("array_value"):
        items = [_anyvalue_to_str(v) for v in val.array_value.values]
        return json.dumps(items)
    if val.HasField("kvlist_value"):
        kv_dict = {kv.key: _anyvalue_to_str(kv.value) for kv in val.kvlist_value.values}
        return json.dumps(kv_dict)
    return ""


def _extract_attributes(attrs: list[KeyValue]) -> dict[str, str]:
    """Extract key-value attributes from OTLP KeyValue list."""
    return {kv.key: _anyvalue_to_str(kv.value) for kv in attrs}


def _get_attr(attrs: dict[str, str], key: str, default: str = "") -> str:
    """Get attribute value by key."""
    return attrs.get(key, default)


def parse_otlp_request(raw_body: bytes) -> ExportTraceServiceRequest:
    """Parse raw protobuf bytes into ExportTraceServiceRequest.

    Raises ValueError if the protobuf is malformed.
    """
    request = ExportTraceServiceRequest()
    try:
        request.ParseFromString(raw_body)
    except Exception as e:
        raise ValueError(f"Malformed OTLP protobuf payload: {e}") from e
    return request


def extract_spans(
    request: ExportTraceServiceRequest,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload_size: int,
) -> list[dict[str, Any]]:
    """Extract span rows from parsed OTLP request for ClickHouse insertion.

    Maps OTLP span fields to the ClickHouse `spans` table schema.
    Calculates row_size_bytes as a share of total payload size.
    """
    spans: list[dict[str, Any]] = []
    total_spans = sum(
        len(scope_spans.spans)
        for resource_spans in request.resource_spans
        for scope_spans in resource_spans.scope_spans
    )
    per_span_bytes = payload_size // max(total_spans, 1)

    for resource_spans in request.resource_spans:
        # Extract resource-level attributes
        resource_attrs = _extract_attributes(resource_spans.resource.attributes)
        service_name = _get_attr(resource_attrs, "service.name", "unknown")
        framework = _get_attr(resource_attrs, "tracely.framework")
        environment = _get_attr(resource_attrs, "tracely.environment")

        for scope_spans in resource_spans.scope_spans:
            for otlp_span in scope_spans.spans:
                span_attrs = _extract_attributes(otlp_span.attributes)

                # Determine span_type from tracely.span_type attribute
                span_type_str = _get_attr(span_attrs, "tracely.span_type", "span")
                if span_type_str not in ("span", "pending_span", "log"):
                    span_type_str = "span"

                # Map OTLP kind
                kind_str = SPAN_KIND_MAP.get(otlp_span.kind, "INTERNAL")

                # Map status
                status_code_str = STATUS_CODE_MAP.get(
                    otlp_span.status.code, "UNSET"
                )

                # Extract HTTP-specific attributes
                http_method = _get_attr(span_attrs, "http.request.method") or _get_attr(
                    span_attrs, "http.method"
                )
                http_route = _get_attr(span_attrs, "http.route")
                http_status_str = _get_attr(span_attrs, "http.response.status_code") or _get_attr(
                    span_attrs, "http.status_code"
                )
                http_status_code = int(http_status_str) if http_status_str.isdigit() else 0

                # Extract request/response data
                request_body = _get_attr(span_attrs, "tracely.request.body")
                response_body = _get_attr(span_attrs, "tracely.response.body")
                request_headers = _get_attr(span_attrs, "tracely.request.headers")
                response_headers = _get_attr(span_attrs, "tracely.response.headers")

                # Remove tracely-specific attrs from the general attributes map
                general_attrs = {
                    k: v
                    for k, v in span_attrs.items()
                    if not k.startswith("tracely.")
                }

                # Extract span events (OTLP log events) and store as JSON
                if otlp_span.events:
                    events_list = []
                    for event in otlp_span.events:
                        event_attrs = _extract_attributes(event.attributes)
                        events_list.append({
                            "timestamp": _nanos_to_datetime(
                                event.time_unix_nano
                            ).isoformat(),
                            "name": event.name,
                            "level": _get_attr(event_attrs, "level", "info"),
                            "message": _get_attr(
                                event_attrs, "message", event.name
                            ),
                        })
                    general_attrs["span.events"] = json.dumps(events_list)

                span_row: dict[str, Any] = {
                    "org_id": str(org_id),
                    "project_id": str(project_id),
                    "trace_id": _bytes_to_hex(otlp_span.trace_id),
                    "span_id": _bytes_to_hex(otlp_span.span_id),
                    "parent_span_id": _bytes_to_hex(otlp_span.parent_span_id)
                    if otlp_span.parent_span_id
                    else "",
                    "span_name": otlp_span.name,
                    "span_type": span_type_str,
                    "service_name": service_name,
                    "framework": framework,
                    "environment": environment,
                    "kind": kind_str,
                    "start_time": _nanos_to_datetime(otlp_span.start_time_unix_nano),
                    "end_time": _nanos_to_datetime(otlp_span.end_time_unix_nano),
                    "duration_ms": _nanos_to_duration_ms(
                        otlp_span.start_time_unix_nano,
                        otlp_span.end_time_unix_nano,
                    ),
                    "status_code": status_code_str,
                    "status_message": otlp_span.status.message,
                    "http_method": http_method,
                    "http_route": http_route,
                    "http_status_code": http_status_code,
                    "request_body": request_body,
                    "response_body": response_body,
                    "request_headers": request_headers,
                    "response_headers": response_headers,
                    "attributes": general_attrs,
                    "row_size_bytes": per_span_bytes,
                }
                spans.append(span_row)

    return spans
