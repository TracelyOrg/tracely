"""Tests for alerts router endpoints (Story 5.1)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.models.alert_rule import AlertRule
from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User
from app.schemas.alert import AlertTemplateOut


@pytest.fixture
def mock_user():
    return User(
        id=uuid.uuid4(),
        email="admin@example.com",
        password_hash="$2b$12$hashed",
        full_name=None,
        is_active=True,
        email_verified=True,
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


# ─── GET /api/orgs/{org_slug}/projects/{slug}/alerts/templates ────────


def test_templates_endpoint_returns_envelope_format(
    client, mock_user, sample_org, sample_project, member
):
    """Templates endpoint returns correct envelope format (AC1, Task 4.4)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.get_templates_with_status = AsyncMock(return_value=[])

        response = client.get("/api/orgs/acme-corp/projects/my-api/alerts/templates")

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert "templates" in body["data"]


def test_templates_endpoint_returns_all_presets(
    client, mock_user, sample_org, sample_project, member
):
    """Templates endpoint returns all 6 preset templates (AC1, Task 4.2)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_templates = [
        AlertTemplateOut(
            key="high_error_rate",
            name="High Error Rate",
            category="availability",
            description="Fires when error rate exceeds threshold",
            default_threshold=5.0,
            default_duration=300,
            comparison="gt",
            metric="error_rate",
            is_active=False,
        ),
        AlertTemplateOut(
            key="service_down",
            name="Service Down",
            category="availability",
            description="Fires when no requests received",
            default_threshold=0,
            default_duration=180,
            comparison="eq",
            metric="request_count",
            is_active=False,
        ),
        AlertTemplateOut(
            key="slow_responses",
            name="Slow Responses",
            category="performance",
            description="Fires when p95 latency exceeds threshold",
            default_threshold=2000,
            default_duration=300,
            comparison="gt",
            metric="p95_latency",
            is_active=False,
        ),
        AlertTemplateOut(
            key="latency_spike",
            name="Latency Spike",
            category="performance",
            description="Fires when p95 increases 200%+ vs previous hour",
            default_threshold=200,
            default_duration=60,
            comparison="pct_increase",
            metric="p95_latency",
            is_active=False,
        ),
        AlertTemplateOut(
            key="traffic_drop",
            name="Traffic Drop",
            category="volume",
            description="Fires when request volume drops 50%+ vs previous hour",
            default_threshold=50,
            default_duration=300,
            comparison="pct_decrease",
            metric="request_count",
            is_active=False,
        ),
        AlertTemplateOut(
            key="traffic_surge",
            name="Traffic Surge",
            category="volume",
            description="Fires when request volume increases 300%+",
            default_threshold=300,
            default_duration=300,
            comparison="pct_increase",
            metric="request_count",
            is_active=False,
        ),
    ]

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.get_templates_with_status = AsyncMock(return_value=mock_templates)

        response = client.get("/api/orgs/acme-corp/projects/my-api/alerts/templates")

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    templates = body["data"]["templates"]
    assert len(templates) == 6

    # Verify availability presets
    availability = [t for t in templates if t["category"] == "availability"]
    assert len(availability) == 2
    assert any(t["key"] == "high_error_rate" for t in availability)
    assert any(t["key"] == "service_down" for t in availability)

    # Verify performance presets
    performance = [t for t in templates if t["category"] == "performance"]
    assert len(performance) == 2
    assert any(t["key"] == "slow_responses" for t in performance)
    assert any(t["key"] == "latency_spike" for t in performance)

    # Verify volume presets
    volume = [t for t in templates if t["category"] == "volume"]
    assert len(volume) == 2
    assert any(t["key"] == "traffic_drop" for t in volume)
    assert any(t["key"] == "traffic_surge" for t in volume)


def test_templates_include_activation_status(
    client, mock_user, sample_org, sample_project, member
):
    """Templates include user's activation status (AC1, Task 4.3)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_templates = [
        AlertTemplateOut(
            key="high_error_rate",
            name="High Error Rate",
            category="availability",
            description="Fires when error rate exceeds threshold",
            default_threshold=5.0,
            default_duration=300,
            comparison="gt",
            metric="error_rate",
            is_active=True,  # User has activated this
            custom_threshold=3.0,  # User customized threshold
        ),
        AlertTemplateOut(
            key="slow_responses",
            name="Slow Responses",
            category="performance",
            description="Fires when p95 latency exceeds threshold",
            default_threshold=2000,
            default_duration=300,
            comparison="gt",
            metric="p95_latency",
            is_active=False,  # Not activated
        ),
    ]

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.get_templates_with_status = AsyncMock(return_value=mock_templates)

        response = client.get("/api/orgs/acme-corp/projects/my-api/alerts/templates")

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    templates = body["data"]["templates"]

    active_template = next(t for t in templates if t["key"] == "high_error_rate")
    assert active_template["is_active"] is True
    assert active_template["custom_threshold"] == 3.0

    inactive_template = next(t for t in templates if t["key"] == "slow_responses")
    assert inactive_template["is_active"] is False
    assert inactive_template["custom_threshold"] is None


def test_templates_endpoint_unauthenticated(client):
    """Unauthenticated request returns 401."""
    response = client.get("/api/orgs/acme-corp/projects/my-api/alerts/templates")
    assert response.status_code == 401


def test_templates_endpoint_scoped_to_org(
    client, mock_user, sample_org, sample_project, member
):
    """Templates data is scoped to the correct org_id (Task 8.3)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.get_templates_with_status = AsyncMock(return_value=[])

        response = client.get("/api/orgs/acme-corp/projects/my-api/alerts/templates")

    _clear(app)

    # Verify alert service was called with correct org_id and project_id
    mock_alert_svc.get_templates_with_status.assert_called_once()
    call_args = mock_alert_svc.get_templates_with_status.call_args
    # First positional arg is db, second is org_id, third is project_id
    assert call_args[0][1] == sample_org.id
    assert call_args[0][2] == sample_project.id


# ─── POST /api/orgs/{org_slug}/projects/{slug}/alerts/rules (Story 5.2) ────────


def test_create_alert_rule(client, mock_user, sample_org, sample_project, member):
    """Create alert rule endpoint returns created rule (AC1, Task 1.1)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_rule = AlertRule(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        project_id=sample_project.id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=5.0,
        duration_seconds=300,
        comparison_operator="gt",
        is_active=True,
        is_custom=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.create_or_update_alert_rule = AsyncMock(return_value=mock_rule)

        response = client.post(
            "/api/orgs/acme-corp/projects/my-api/alerts/rules",
            json={"preset_key": "high_error_rate"},
        )

    _clear(app)

    assert response.status_code == 201
    body = response.json()
    assert "data" in body
    assert body["data"]["preset_key"] == "high_error_rate"
    assert body["data"]["is_active"] is True


def test_create_alert_rule_with_custom_threshold(
    client, mock_user, sample_org, sample_project, member
):
    """Create alert rule with custom threshold (AC2, Task 1.1)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_rule = AlertRule(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        project_id=sample_project.id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=10.0,  # Custom threshold
        duration_seconds=600,   # Custom duration
        comparison_operator="gt",
        is_active=True,
        is_custom=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.create_or_update_alert_rule = AsyncMock(return_value=mock_rule)

        response = client.post(
            "/api/orgs/acme-corp/projects/my-api/alerts/rules",
            json={
                "preset_key": "high_error_rate",
                "threshold_value": 10.0,
                "duration_seconds": 600,
            },
        )

    _clear(app)

    assert response.status_code == 201
    body = response.json()
    assert body["data"]["threshold_value"] == 10.0
    assert body["data"]["duration_seconds"] == 600
    assert body["data"]["is_custom"] is True


# ─── POST /api/orgs/{org_slug}/projects/{slug}/alerts/rules/toggle (Story 5.2) ────────


def test_toggle_alert_activates(client, mock_user, sample_org, sample_project, member):
    """Toggle endpoint activates an inactive alert (AC1, Task 2)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_rule = AlertRule(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        project_id=sample_project.id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=5.0,
        duration_seconds=300,
        comparison_operator="gt",
        is_active=True,  # Now active after toggle
        is_custom=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.toggle_alert_rule = AsyncMock(return_value=mock_rule)

        response = client.post(
            "/api/orgs/acme-corp/projects/my-api/alerts/rules/toggle",
            json={"preset_key": "high_error_rate"},
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["is_active"] is True


def test_toggle_alert_deactivates(client, mock_user, sample_org, sample_project, member):
    """Toggle endpoint deactivates an active alert (AC4, Task 2)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_rule = AlertRule(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        project_id=sample_project.id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=5.0,
        duration_seconds=300,
        comparison_operator="gt",
        is_active=False,  # Now inactive after toggle
        is_custom=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.toggle_alert_rule = AsyncMock(return_value=mock_rule)

        response = client.post(
            "/api/orgs/acme-corp/projects/my-api/alerts/rules/toggle",
            json={"preset_key": "high_error_rate"},
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["is_active"] is False


# ─── PUT /api/orgs/{org_slug}/projects/{slug}/alerts/rules/{rule_id} (Story 5.2) ────────


def test_update_alert_rule_threshold(
    client, mock_user, sample_org, sample_project, member
):
    """Update alert rule threshold (AC3, Task 1.2)."""
    from app.main import app

    rule_id = uuid.uuid4()
    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_rule = AlertRule(
        id=rule_id,
        org_id=sample_org.id,
        project_id=sample_project.id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=10.0,  # Updated threshold
        duration_seconds=300,
        comparison_operator="gt",
        is_active=True,
        is_custom=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.update_alert_rule = AsyncMock(return_value=mock_rule)

        response = client.put(
            f"/api/orgs/acme-corp/projects/my-api/alerts/rules/{rule_id}",
            json={"threshold_value": 10.0},
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["threshold_value"] == 10.0
    assert body["data"]["is_custom"] is True


# ─── POST /api/orgs/{org_slug}/projects/{slug}/alerts/rules/{rule_id}/reset (Story 5.2) ────────


def test_reset_alert_to_defaults(
    client, mock_user, sample_org, sample_project, member
):
    """Reset alert rule to preset defaults (AC3, Task 4)."""
    from app.main import app

    rule_id = uuid.uuid4()
    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_rule = AlertRule(
        id=rule_id,
        org_id=sample_org.id,
        project_id=sample_project.id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=5.0,  # Back to default
        duration_seconds=300,  # Back to default
        comparison_operator="gt",
        is_active=True,
        is_custom=False,  # No longer custom
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.reset_alert_rule_to_defaults = AsyncMock(return_value=mock_rule)

        response = client.post(
            f"/api/orgs/acme-corp/projects/my-api/alerts/rules/{rule_id}/reset"
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["threshold_value"] == 5.0
    assert body["data"]["is_custom"] is False


# ─── GET /api/orgs/{org_slug}/projects/{slug}/alerts/history (Story 5.5) ────────


def test_history_endpoint_returns_paginated_events(
    client, mock_user, sample_org, sample_project, member
):
    """History endpoint returns paginated alert events (AC1, Task 10.1)."""
    from app.main import app
    from app.schemas.alert import AlertEventOut

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_events = [
        AlertEventOut(
            id=uuid.uuid4(),
            rule_id=uuid.uuid4(),
            org_id=sample_org.id,
            project_id=sample_project.id,
            triggered_at=datetime.now(timezone.utc),
            resolved_at=None,
            metric_value=10.5,
            threshold_value=5.0,
            status="active",
            notification_sent=True,
            rule_snapshot=None,
            rule_name="High Error Rate",
            rule_category="availability",
            rule_preset_key="high_error_rate",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
    ]

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.get_alert_history = AsyncMock(return_value=(mock_events, 1))

        response = client.get(
            "/api/orgs/acme-corp/projects/my-api/alerts/history?offset=0&limit=20"
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "events" in body["data"]
    assert "total" in body["data"]
    assert body["data"]["total"] == 1
    assert body["data"]["offset"] == 0
    assert body["data"]["limit"] == 20


def test_history_endpoint_filters_by_status(
    client, mock_user, sample_org, sample_project, member
):
    """History endpoint filters by status (AC1, Task 10.2)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.get_alert_history = AsyncMock(return_value=([], 0))

        response = client.get(
            "/api/orgs/acme-corp/projects/my-api/alerts/history?status=active"
        )

    _clear(app)

    assert response.status_code == 200
    # Verify service was called with status filter
    mock_alert_svc.get_alert_history.assert_called_once()
    call_kwargs = mock_alert_svc.get_alert_history.call_args[1]
    assert call_kwargs.get("status") == "active"


def test_history_endpoint_filters_by_date_range(
    client, mock_user, sample_org, sample_project, member
):
    """History endpoint filters by date range (AC1, Task 10.2)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    start_date = "2025-01-01T00:00:00Z"
    end_date = "2025-01-31T23:59:59Z"

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.get_alert_history = AsyncMock(return_value=([], 0))

        response = client.get(
            f"/api/orgs/acme-corp/projects/my-api/alerts/history?start_date={start_date}&end_date={end_date}"
        )

    _clear(app)

    assert response.status_code == 200
    # Verify service was called with date filters
    mock_alert_svc.get_alert_history.assert_called_once()
    call_kwargs = mock_alert_svc.get_alert_history.call_args[1]
    assert call_kwargs.get("start_date") is not None
    assert call_kwargs.get("end_date") is not None


# ─── POST /api/orgs/{org_slug}/projects/{slug}/alerts/bulk-toggle (Story 5.5) ────────


def test_bulk_toggle_activates_multiple_alerts(
    client, mock_user, sample_org, sample_project, member
):
    """Bulk toggle endpoint activates multiple alerts (AC3, Task 10.3)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_rules = [
        AlertRule(
            id=uuid.uuid4(),
            org_id=sample_org.id,
            project_id=sample_project.id,
            preset_key="high_error_rate",
            name="High Error Rate",
            category="availability",
            description="Test",
            threshold_value=5.0,
            duration_seconds=300,
            comparison_operator="gt",
            is_active=True,
            is_custom=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
        AlertRule(
            id=uuid.uuid4(),
            org_id=sample_org.id,
            project_id=sample_project.id,
            preset_key="slow_responses",
            name="Slow Responses",
            category="performance",
            description="Test",
            threshold_value=2000,
            duration_seconds=300,
            comparison_operator="gt",
            is_active=True,
            is_custom=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
    ]

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.bulk_toggle_alerts = AsyncMock(return_value=mock_rules)

        response = client.post(
            "/api/orgs/acme-corp/projects/my-api/alerts/bulk-toggle",
            json={
                "preset_keys": ["high_error_rate", "slow_responses"],
                "is_active": True,
            },
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["data"]["count"] == 2
    assert len(body["data"]["rules"]) == 2


def test_bulk_toggle_deactivates_multiple_alerts(
    client, mock_user, sample_org, sample_project, member
):
    """Bulk toggle endpoint deactivates multiple alerts (AC3, Task 10.3)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    mock_rules = [
        AlertRule(
            id=uuid.uuid4(),
            org_id=sample_org.id,
            project_id=sample_project.id,
            preset_key="high_error_rate",
            name="High Error Rate",
            category="availability",
            description="Test",
            threshold_value=5.0,
            duration_seconds=300,
            comparison_operator="gt",
            is_active=False,
            is_custom=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ),
    ]

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.bulk_toggle_alerts = AsyncMock(return_value=mock_rules)

        response = client.post(
            "/api/orgs/acme-corp/projects/my-api/alerts/bulk-toggle",
            json={
                "preset_keys": ["high_error_rate"],
                "is_active": False,
            },
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["rules"][0]["is_active"] is False


# ─── DELETE /api/orgs/{org_slug}/projects/{slug}/alerts/rules/{preset_key} (Story 5.5) ────────


def test_delete_custom_alert_succeeds(
    client, mock_user, sample_org, sample_project, member
):
    """Delete custom alert endpoint succeeds for custom alerts (AC3, Task 10.4)."""
    from app.main import app

    _override_full(app, mock_user, sample_org, member, sample_project)

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.delete_custom_alert = AsyncMock(return_value=None)

        response = client.delete(
            "/api/orgs/acme-corp/projects/my-api/alerts/rules/custom_alert_key"
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["deleted"] == "custom_alert_key"


def test_delete_preset_alert_forbidden(
    client, mock_user, sample_org, sample_project, member
):
    """Delete preset alert endpoint returns 403 for non-custom alerts (AC3, Task 10.4)."""
    from app.main import app
    from app.utils.exceptions import ForbiddenError

    _override_full(app, mock_user, sample_org, member, sample_project)

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.delete_custom_alert = AsyncMock(
            side_effect=ForbiddenError("Only custom alerts can be deleted")
        )

        response = client.delete(
            "/api/orgs/acme-corp/projects/my-api/alerts/rules/high_error_rate"
        )

    _clear(app)

    assert response.status_code == 403


def test_delete_nonexistent_alert_not_found(
    client, mock_user, sample_org, sample_project, member
):
    """Delete nonexistent alert returns 404 (AC3, Task 10.4)."""
    from app.main import app
    from app.utils.exceptions import NotFoundError

    _override_full(app, mock_user, sample_org, member, sample_project)

    with (
        patch("app.routers.alerts.project_service") as mock_project_svc,
        patch("app.routers.alerts.alert_service") as mock_alert_svc,
    ):
        mock_project_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_alert_svc.delete_custom_alert = AsyncMock(
            side_effect=NotFoundError("Alert rule not found")
        )

        response = client.delete(
            "/api/orgs/acme-corp/projects/my-api/alerts/rules/nonexistent"
        )

    _clear(app)

    assert response.status_code == 404
