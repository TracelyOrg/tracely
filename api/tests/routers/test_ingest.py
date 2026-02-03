from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

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

from app.dependencies import get_api_key_project
from app.main import app


def _make_kv(key: str, value: str) -> KeyValue:
    return KeyValue(key=key, value=AnyValue(string_value=value))


def _build_valid_payload() -> bytes:
    """Build a valid OTLP protobuf payload."""
    span = Span(
        trace_id=bytes.fromhex("0af7651916cd43dd8448eb211c80319c"),
        span_id=bytes.fromhex("b7ad6b7169203331"),
        name="GET /api/users",
        kind=2,
        start_time_unix_nano=1_700_000_000_000_000_000,
        end_time_unix_nano=1_700_000_000_050_000_000,
        attributes=[
            _make_kv("tracely.span_type", "span"),
            _make_kv("http.request.method", "GET"),
            _make_kv("http.route", "/api/users"),
            _make_kv("http.response.status_code", "200"),
        ],
        status=Status(code=1),
    )
    req = ExportTraceServiceRequest(
        resource_spans=[
            ResourceSpans(
                resource=Resource(
                    attributes=[_make_kv("service.name", "test-api")]
                ),
                scope_spans=[ScopeSpans(spans=[span])],
            )
        ]
    )
    return req.SerializeToString()


@pytest.fixture
def auth_project():
    return uuid.uuid4(), uuid.uuid4()  # project_id, org_id


def _override_auth(project_id: uuid.UUID, org_id: uuid.UUID) -> None:
    app.dependency_overrides[get_api_key_project] = lambda: (project_id, org_id)


def _clear_overrides() -> None:
    app.dependency_overrides.clear()


# ── AC#1: API key auth + 200 empty body ─────────────────────────────


def test_ingest_no_auth_returns_401(client):
    """AC#4: Missing API key → 401."""
    response = client.post("/v1/traces", content=_build_valid_payload())
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"


def test_ingest_invalid_key_returns_401(client):
    """AC#4: Invalid API key format → 401."""
    response = client.post(
        "/v1/traces",
        content=_build_valid_payload(),
        headers={"Authorization": "Bearer invalid_key"},
    )
    assert response.status_code == 401


def test_ingest_valid_payload_returns_200(client, auth_project):
    """AC#1: Valid key + valid payload → 200 empty body."""
    project_id, org_id = auth_project
    _override_auth(project_id, org_id)

    with patch("app.routers.ingest.ingest_traces", new_callable=AsyncMock) as mock_ingest:
        mock_ingest.return_value = 1
        response = client.post("/v1/traces", content=_build_valid_payload())

    _clear_overrides()

    assert response.status_code == 200
    assert response.content == b""


def test_ingest_calls_service_with_correct_args(client, auth_project):
    """AC#1: Request scoped to correct project and organization."""
    project_id, org_id = auth_project
    _override_auth(project_id, org_id)

    with patch("app.routers.ingest.ingest_traces", new_callable=AsyncMock) as mock_ingest:
        mock_ingest.return_value = 1
        payload = _build_valid_payload()
        client.post("/v1/traces", content=payload)

    _clear_overrides()

    mock_ingest.assert_called_once()
    call_args = mock_ingest.call_args
    assert call_args[0][1] == org_id
    assert call_args[0][2] == project_id


# ── AC#4: Malformed payload → 400 ────────────────────────────────────


def test_ingest_empty_body_returns_400(client, auth_project):
    """AC#4: Empty request body → 400."""
    project_id, org_id = auth_project
    _override_auth(project_id, org_id)

    response = client.post("/v1/traces", content=b"")

    _clear_overrides()

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "BAD_REQUEST"
    assert "Empty" in body["error"]["message"]


def test_ingest_malformed_payload_returns_400(client, auth_project):
    """AC#4: Malformed protobuf → 400 with error envelope."""
    project_id, org_id = auth_project
    _override_auth(project_id, org_id)

    with patch(
        "app.routers.ingest.ingest_traces",
        new_callable=AsyncMock,
        side_effect=ValueError("Malformed OTLP protobuf payload"),
    ):
        response = client.post("/v1/traces", content=b"\xff\xfe\xfd")

    _clear_overrides()

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "BAD_REQUEST"
    assert "Malformed" in body["error"]["message"]


# ── Error envelope format ────────────────────────────────────────────


def test_ingest_error_envelope_format(client):
    """Error responses use standard envelope format."""
    response = client.post("/v1/traces", content=_build_valid_payload())
    assert response.status_code == 401
    body = response.json()
    assert "error" in body
    assert "code" in body["error"]
    assert "message" in body["error"]


# ── AC#2: Spans are stored (verified via service mock) ───────────────


def test_ingest_service_receives_raw_body(client, auth_project):
    """AC#2: Raw protobuf body is passed to ingest_traces."""
    project_id, org_id = auth_project
    _override_auth(project_id, org_id)

    payload = _build_valid_payload()
    with patch("app.routers.ingest.ingest_traces", new_callable=AsyncMock) as mock_ingest:
        mock_ingest.return_value = 1
        client.post("/v1/traces", content=payload)

    _clear_overrides()

    raw_body = mock_ingest.call_args[0][0]
    assert raw_body == payload


# ── No data stored on validation failure ─────────────────────────────


def test_ingest_no_storage_on_auth_failure(client):
    """AC#4: Invalid key → ingest_traces never called."""
    with patch("app.routers.ingest.ingest_traces", new_callable=AsyncMock) as mock_ingest:
        client.post(
            "/v1/traces",
            content=_build_valid_payload(),
        )
    mock_ingest.assert_not_called()


def test_ingest_no_storage_on_bad_payload(client, auth_project):
    """AC#4: Bad payload → no data stored."""
    project_id, org_id = auth_project
    _override_auth(project_id, org_id)

    with patch(
        "app.routers.ingest.ingest_traces",
        new_callable=AsyncMock,
        side_effect=ValueError("bad"),
    ) as mock_ingest:
        client.post("/v1/traces", content=b"\xff")

    _clear_overrides()

    # The service was called (to attempt parsing) but it raised
    mock_ingest.assert_called_once()
