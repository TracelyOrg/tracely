from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db.postgres import get_db
from app.dependencies import get_current_org
from app.main import app
from app.models.project import Project
from app.schemas.stream import SpanSummary


# ── Helpers ───────────────────────────────────────────────────────────

ORG_ID = uuid.uuid4()
PROJECT_ID = uuid.uuid4()
TRACE_ID = "0af7651916cd43dd8448eb211c80319c"


def _make_result(value):
    """Helper to create a mock SQLAlchemy scalar result."""
    return MagicMock(scalar_one_or_none=MagicMock(return_value=value))


def _mock_project() -> Project:
    p = MagicMock(spec=Project)
    p.id = PROJECT_ID
    p.org_id = ORG_ID
    p.slug = "my-project"
    p.is_active = True
    return p


def _make_span_summary(span_id: str, parent: str = "", duration: float = 10.0) -> SpanSummary:
    return SpanSummary(
        trace_id=TRACE_ID,
        span_id=span_id,
        parent_span_id=parent,
        span_name="GET /api/test",
        span_type="span",
        service_name="test-api",
        kind="SERVER",
        start_time="2026-02-03T12:00:00+00:00",
        duration_ms=duration,
        status_code="OK",
        http_method="GET",
        http_route="/api/test",
        http_status_code=200,
    )


def _override_auth_and_db(project: MagicMock | None = None):
    """Override auth + db dependencies. Returns the mock db for assertions."""
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=_make_result(project or _mock_project())
    )
    app.dependency_overrides[get_current_org] = lambda: ORG_ID
    app.dependency_overrides[get_db] = lambda: mock_db
    return mock_db


def _clear():
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    _clear()


# ── GET /spans/trace/{trace_id} — Authentication ─────────────────────


def test_trace_spans_no_auth_returns_401(client):
    """Missing auth cookie returns 401."""
    response = client.get(
        f"/api/orgs/test-org/projects/my-project/spans/trace/{TRACE_ID}"
    )
    assert response.status_code == 401


# ── GET /spans/trace/{trace_id} — Project not found ──────────────────


def test_trace_spans_project_not_found_returns_404(client):
    """Non-existent project returns 404."""
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_make_result(None))
    app.dependency_overrides[get_current_org] = lambda: ORG_ID
    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.get(
        f"/api/orgs/test-org/projects/bad-project/spans/trace/{TRACE_ID}"
    )
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"


# ── GET /spans/trace/{trace_id} — Success (empty) ────────────────────


def test_trace_spans_empty_trace_returns_empty_list(client):
    """Trace with no spans returns empty data array."""
    _override_auth_and_db()

    with patch(
        "app.services.span_service.get_trace_spans",
        new_callable=AsyncMock,
        return_value=[],
    ):
        response = client.get(
            f"/api/orgs/test-org/projects/my-project/spans/trace/{TRACE_ID}"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == []
    assert body["meta"]["count"] == 0


# ── GET /spans/trace/{trace_id} — Success (with spans) ───────────────


def test_trace_spans_returns_all_trace_spans(client):
    """Returns all spans for a given trace_id in success envelope."""
    _override_auth_and_db()

    root = _make_span_summary("aaa", "", 100.0)
    child = _make_span_summary("bbb", "aaa", 50.0)

    with patch(
        "app.services.span_service.get_trace_spans",
        new_callable=AsyncMock,
        return_value=[root, child],
    ):
        response = client.get(
            f"/api/orgs/test-org/projects/my-project/spans/trace/{TRACE_ID}"
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]) == 2
    assert body["meta"]["count"] == 2
    assert body["data"][0]["span_id"] == "aaa"
    assert body["data"][1]["span_id"] == "bbb"
    assert body["data"][1]["parent_span_id"] == "aaa"


# ── GET /spans/trace/{trace_id} — Service called with correct args ───


def test_trace_spans_service_receives_correct_args(client):
    """Service called with org_id, project_id, and trace_id."""
    _override_auth_and_db()

    with patch(
        "app.services.span_service.get_trace_spans",
        new_callable=AsyncMock,
        return_value=[],
    ) as mock_svc:
        client.get(
            f"/api/orgs/test-org/projects/my-project/spans/trace/{TRACE_ID}"
        )

    mock_svc.assert_called_once_with(
        org_id=ORG_ID,
        project_id=PROJECT_ID,
        trace_id=TRACE_ID,
    )


# ── GET /spans/trace/{trace_id} — Response envelope format ───────────


def test_trace_spans_response_envelope_format(client):
    """Response follows { data: [...], meta: { count } } envelope."""
    _override_auth_and_db()

    with patch(
        "app.services.span_service.get_trace_spans",
        new_callable=AsyncMock,
        return_value=[_make_span_summary("aaa")],
    ):
        response = client.get(
            f"/api/orgs/test-org/projects/my-project/spans/trace/{TRACE_ID}"
        )

    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert isinstance(body["data"], list)
    assert "count" in body["meta"]

    span = body["data"][0]
    assert "trace_id" in span
    assert "span_id" in span
    assert "parent_span_id" in span
    assert "duration_ms" in span
    assert "start_time" in span
