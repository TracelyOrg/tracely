from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User
from app.schemas.dashboard import HealthResponse, HealthStatus, ServiceHealth


@pytest.fixture
def mock_user():
    return User(
        id=uuid.uuid4(),
        email="admin@example.com",
        password_hash="$2b$12$hashed",
        full_name=None,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def sample_org():
    return Organization(
        id=uuid.uuid4(),
        name="Acme Corp",
        slug="acme-corp",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def sample_project(sample_org):
    return Project(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        name="My API",
        slug="my-api",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def member(sample_org, mock_user):
    return OrgMember(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        user_id=mock_user.id,
        role="member",
        created_at=datetime.now(timezone.utc),
    )


def _override_full(app, user, org, member, project):
    """Override auth and provide mock db."""
    from app.dependencies import get_current_org, get_current_user

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_org] = lambda: org.id

    mock_db = AsyncMock()

    from app.db.postgres import get_db

    app.dependency_overrides[get_db] = lambda: mock_db
    return mock_db


def _clear(app):
    app.dependency_overrides.clear()


# ─── GET /api/orgs/{org_slug}/projects/{slug}/health ─────────────────


def test_health_endpoint_returns_envelope_format(
    client, mock_user, sample_org, sample_project, member
):
    """Health endpoint returns correct envelope format."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    with (
        patch("app.routers.dashboard.project_service") as mock_project_svc,
        patch("app.routers.dashboard.dashboard_service") as mock_dashboard_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_dashboard_svc.get_project_health = AsyncMock(
            return_value=HealthResponse(services=[])
        )

        response = client.get("/api/orgs/acme-corp/projects/my-api/health")

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert "services" in body["data"]


def test_health_endpoint_returns_service_list(
    client, mock_user, sample_org, sample_project, member
):
    """Health endpoint returns list of services with correct fields."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_services = [
        ServiceHealth(
            name="api-gateway",
            status=HealthStatus.healthy,
            request_rate=120.5,
            error_rate=0.5,
            p95_latency=45.2,
        ),
        ServiceHealth(
            name="user-service",
            status=HealthStatus.degraded,
            request_rate=80.0,
            error_rate=2.5,
            p95_latency=850.0,
        ),
    ]

    with (
        patch("app.routers.dashboard.project_service") as mock_project_svc,
        patch("app.routers.dashboard.dashboard_service") as mock_dashboard_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_dashboard_svc.get_project_health = AsyncMock(
            return_value=HealthResponse(services=mock_services)
        )

        response = client.get("/api/orgs/acme-corp/projects/my-api/health")

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    services = body["data"]["services"]
    assert len(services) == 2
    assert services[0]["name"] == "api-gateway"
    assert services[0]["status"] == "healthy"
    assert services[0]["request_rate"] == 120.5
    assert services[0]["error_rate"] == 0.5
    assert services[0]["p95_latency"] == 45.2


def test_health_endpoint_unauthenticated(client):
    """Unauthenticated request returns 401."""
    response = client.get("/api/orgs/acme-corp/projects/my-api/health")
    assert response.status_code == 401


# ─── Health status calculation tests ─────────────────────────────────


def test_health_status_healthy():
    """Status is healthy when error rate < 1% AND p95 < 500ms."""
    from app.services.dashboard_service import _calculate_health_status

    # Both metrics well within healthy range
    assert _calculate_health_status(0.5, 200.0) == HealthStatus.healthy
    assert _calculate_health_status(0.0, 499.9) == HealthStatus.healthy
    assert _calculate_health_status(0.99, 100.0) == HealthStatus.healthy


def test_health_status_degraded():
    """Status is degraded when one metric is in yellow range."""
    from app.services.dashboard_service import _calculate_health_status

    # Error rate in yellow (1-5%), p95 healthy
    assert _calculate_health_status(2.0, 200.0) == HealthStatus.degraded
    # Error rate healthy, p95 in yellow (500-2000ms)
    assert _calculate_health_status(0.5, 1000.0) == HealthStatus.degraded
    # Both in degraded range but not error
    assert _calculate_health_status(3.0, 1500.0) == HealthStatus.degraded


def test_health_status_error():
    """Status is error when both metrics exceed yellow thresholds."""
    from app.services.dashboard_service import _calculate_health_status

    # Both in red range
    assert _calculate_health_status(6.0, 2500.0) == HealthStatus.error
    assert _calculate_health_status(10.0, 3000.0) == HealthStatus.error
    # Edge case: exactly at threshold
    assert _calculate_health_status(5.0, 2000.0) == HealthStatus.error


# ─── Redis caching tests ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_service_uses_cache():
    """Health service returns cached data when available."""
    from app.services import dashboard_service

    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    cached_response = HealthResponse(
        services=[
            ServiceHealth(
                name="cached-service",
                status=HealthStatus.healthy,
                request_rate=100.0,
                error_rate=0.1,
                p95_latency=50.0,
            )
        ]
    )

    with patch("app.services.dashboard_service.cache_get") as mock_cache_get:
        mock_cache_get.return_value = cached_response.model_dump_json()

        result = await dashboard_service.get_project_health(org_id, project_id)

    assert len(result.services) == 1
    assert result.services[0].name == "cached-service"
    mock_cache_get.assert_called_once()


@pytest.mark.asyncio
async def test_health_service_caches_result():
    """Health service caches ClickHouse query result."""
    from app.services import dashboard_service

    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    # Mock ClickHouse result
    mock_ch_result = MagicMock()
    mock_ch_result.result_rows = [
        ("api-service", 100, 1, 150.0),  # name, requests, errors, p95
    ]

    with (
        patch("app.services.dashboard_service.cache_get") as mock_cache_get,
        patch("app.services.dashboard_service.cache_set") as mock_cache_set,
        patch("app.services.dashboard_service.get_clickhouse_client") as mock_ch,
    ):
        mock_cache_get.return_value = None  # Cache miss
        mock_ch.return_value.query = MagicMock(return_value=mock_ch_result)

        result = await dashboard_service.get_project_health(org_id, project_id)

    assert len(result.services) == 1
    assert result.services[0].name == "api-service"
    mock_cache_set.assert_called_once()
    # Verify TTL is 20 seconds
    call_args = mock_cache_set.call_args
    assert call_args[0][2] == 20  # TTL argument


# ─── Multi-tenant isolation tests ────────────────────────────────────


def test_health_endpoint_scoped_to_org(
    client, mock_user, sample_org, sample_project, member
):
    """Health data is scoped to the correct org_id."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    with (
        patch("app.routers.dashboard.project_service") as mock_project_svc,
        patch("app.routers.dashboard.dashboard_service") as mock_dashboard_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_dashboard_svc.get_project_health = AsyncMock(
            return_value=HealthResponse(services=[])
        )

        response = client.get("/api/orgs/acme-corp/projects/my-api/health")

    _clear(app)

    # Verify dashboard service was called with correct org_id
    mock_dashboard_svc.get_project_health.assert_called_once_with(
        sample_org.id, sample_project.id
    )


@pytest.mark.asyncio
async def test_clickhouse_query_includes_org_id_filter():
    """ClickHouse query must filter by org_id for multi-tenant isolation."""
    from app.services import dashboard_service

    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    with (
        patch("app.services.dashboard_service.cache_get") as mock_cache_get,
        patch("app.services.dashboard_service.cache_set"),
        patch("app.services.dashboard_service.get_clickhouse_client") as mock_ch,
        patch("asyncio.to_thread") as mock_to_thread,
    ):
        mock_cache_get.return_value = None
        mock_result = MagicMock()
        mock_result.result_rows = []
        mock_to_thread.return_value = mock_result

        await dashboard_service.get_project_health(org_id, project_id)

    # Verify to_thread was called with query containing org_id parameter
    call_args = mock_to_thread.call_args
    query_params = call_args.kwargs.get("parameters", call_args[1].get("parameters", {}))
    assert str(org_id) in str(query_params.get("org_id", ""))
