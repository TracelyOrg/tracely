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
