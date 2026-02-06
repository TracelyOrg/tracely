"""Tests for alert service (Story 5.1)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.alert_rule import AlertRule
from app.services import alert_service
from app.services.alert_presets import get_all_presets, ALERT_PRESETS


# ─── get_templates_with_status tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_get_templates_returns_all_presets():
    """Service returns all 6 preset templates (Task 8.1)."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []  # No user rules
    mock_db.execute.return_value = mock_result

    templates = await alert_service.get_templates_with_status(mock_db, org_id, project_id)

    assert len(templates) == 6
    assert all(t.is_active is False for t in templates)

    # Verify all expected presets are present
    keys = {t.key for t in templates}
    assert keys == {
        "high_error_rate",
        "service_down",
        "slow_responses",
        "latency_spike",
        "traffic_drop",
        "traffic_surge",
    }


@pytest.mark.asyncio
async def test_get_templates_merges_active_rules():
    """Service merges user's active rules with presets (Task 8.2)."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    # Create an active alert rule for one preset
    active_rule = AlertRule(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=3.0,  # Custom threshold
        duration_seconds=300,
        comparison_operator="gt",
        is_active=True,
        is_custom=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [active_rule]
    mock_db.execute.return_value = mock_result

    templates = await alert_service.get_templates_with_status(mock_db, org_id, project_id)

    # Find the activated template
    activated = next(t for t in templates if t.key == "high_error_rate")
    assert activated.is_active is True
    assert activated.custom_threshold == 3.0

    # Other templates should be inactive
    others = [t for t in templates if t.key != "high_error_rate"]
    assert all(t.is_active is False for t in others)


@pytest.mark.asyncio
async def test_get_templates_preserves_default_when_not_custom():
    """Service shows default threshold when user hasn't customized (Task 8.2)."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    # Create an active rule with default values (not custom)
    active_rule = AlertRule(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        preset_key="slow_responses",
        name="Slow Responses",
        category="performance",
        description="Fires when p95 latency exceeds threshold",
        threshold_value=2000,  # Default value
        duration_seconds=300,
        comparison_operator="gt",
        is_active=True,
        is_custom=False,  # Not customized
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [active_rule]
    mock_db.execute.return_value = mock_result

    templates = await alert_service.get_templates_with_status(mock_db, org_id, project_id)

    activated = next(t for t in templates if t.key == "slow_responses")
    assert activated.is_active is True
    assert activated.custom_threshold is None  # Not showing custom since is_custom=False


@pytest.mark.asyncio
async def test_get_templates_queries_correct_org_project():
    """Service queries with correct org_id and project_id (Task 8.3)."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result

    await alert_service.get_templates_with_status(mock_db, org_id, project_id)

    # Verify execute was called
    mock_db.execute.assert_called_once()

    # The call includes a SELECT statement with WHERE clauses for org_id and project_id
    call_args = mock_db.execute.call_args
    stmt = call_args[0][0]

    # Verify the statement is selecting from AlertRule with the correct filters
    # This is a structural test - in integration tests we'd verify actual filtering
    assert str(stmt).count("WHERE") >= 1


# ─── Preset definitions tests ────────────────────────────────────────


def test_all_presets_have_required_fields():
    """All preset definitions have required fields (Task 3.x)."""
    presets = get_all_presets()

    for preset in presets:
        assert preset.key is not None and len(preset.key) > 0
        assert preset.name is not None and len(preset.name) > 0
        assert preset.category in ("availability", "performance", "volume")
        assert preset.description is not None
        assert preset.default_threshold is not None
        assert preset.default_duration > 0
        assert preset.comparison in ("gt", "lt", "eq", "gte", "lte", "pct_increase", "pct_decrease")
        assert preset.metric in ("error_rate", "request_count", "p95_latency")


def test_availability_presets():
    """Availability presets are correctly defined (Task 3.2)."""
    availability = [p for p in get_all_presets() if p.category == "availability"]
    assert len(availability) == 2

    high_error = next(p for p in availability if p.key == "high_error_rate")
    assert high_error.default_threshold == 5.0
    assert high_error.default_duration == 300
    assert high_error.metric == "error_rate"

    service_down = next(p for p in availability if p.key == "service_down")
    assert service_down.default_threshold == 0
    assert service_down.default_duration == 180
    assert service_down.metric == "request_count"


def test_performance_presets():
    """Performance presets are correctly defined (Task 3.3)."""
    performance = [p for p in get_all_presets() if p.category == "performance"]
    assert len(performance) == 2

    slow_responses = next(p for p in performance if p.key == "slow_responses")
    assert slow_responses.default_threshold == 2000
    assert slow_responses.default_duration == 300
    assert slow_responses.metric == "p95_latency"

    latency_spike = next(p for p in performance if p.key == "latency_spike")
    assert latency_spike.default_threshold == 200
    assert latency_spike.comparison == "pct_increase"


def test_volume_presets():
    """Volume presets are correctly defined (Task 3.4)."""
    volume = [p for p in get_all_presets() if p.category == "volume"]
    assert len(volume) == 2

    traffic_drop = next(p for p in volume if p.key == "traffic_drop")
    assert traffic_drop.default_threshold == 50
    assert traffic_drop.comparison == "pct_decrease"

    traffic_surge = next(p for p in volume if p.key == "traffic_surge")
    assert traffic_surge.default_threshold == 300
    assert traffic_surge.comparison == "pct_increase"


# ─── Story 5.2: toggle_alert_rule tests ────────────────────────────────


@pytest.mark.asyncio
async def test_toggle_creates_new_rule_when_not_exists():
    """Toggle creates a new active rule when preset not yet activated (AC1)."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None  # No existing rule
    mock_db.execute.return_value = mock_result

    # Mock the add, commit, refresh calls
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    # Capture the rule that gets added
    added_rule = None

    def capture_add(rule):
        nonlocal added_rule
        added_rule = rule
        rule.id = uuid.uuid4()

    mock_db.add.side_effect = capture_add
    mock_db.refresh = AsyncMock()

    result = await alert_service.toggle_alert_rule(
        mock_db, org_id, project_id, "high_error_rate"
    )

    # Verify a new rule was created
    mock_db.add.assert_called_once()
    assert added_rule is not None
    assert added_rule.is_active is True
    assert added_rule.preset_key == "high_error_rate"
    assert added_rule.threshold_value == 5.0  # Default value
    assert added_rule.is_custom is False


@pytest.mark.asyncio
async def test_toggle_toggles_existing_rule():
    """Toggle flips is_active on existing rule (AC1, AC4)."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    existing_rule = AlertRule(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=5.0,
        duration_seconds=300,
        comparison_operator="gt",
        is_active=True,  # Currently active
        is_custom=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_rule
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await alert_service.toggle_alert_rule(
        mock_db, org_id, project_id, "high_error_rate"
    )

    # Verify the rule was toggled
    assert existing_rule.is_active is False  # Now inactive


@pytest.mark.asyncio
async def test_toggle_invalid_preset_raises_not_found():
    """Toggle raises NotFoundError for invalid preset key."""
    from app.utils.exceptions import NotFoundError

    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    mock_db = AsyncMock()

    with pytest.raises(NotFoundError) as exc_info:
        await alert_service.toggle_alert_rule(
            mock_db, org_id, project_id, "invalid_preset"
        )

    assert "not found" in str(exc_info.value).lower()


# ─── Story 5.2: update_alert_rule tests ────────────────────────────────


@pytest.mark.asyncio
async def test_update_alert_rule_changes_threshold():
    """Update changes threshold value (AC3)."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    rule_id = uuid.uuid4()

    existing_rule = AlertRule(
        id=rule_id,
        org_id=org_id,
        project_id=project_id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=5.0,  # Original
        duration_seconds=300,
        comparison_operator="gt",
        is_active=True,
        is_custom=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_rule
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    await alert_service.update_alert_rule(
        mock_db, org_id, project_id, rule_id,
        threshold_value=10.0
    )

    assert existing_rule.threshold_value == 10.0
    assert existing_rule.is_custom is True  # Now custom


@pytest.mark.asyncio
async def test_update_alert_rule_not_found():
    """Update raises NotFoundError for non-existent rule."""
    from app.utils.exceptions import NotFoundError

    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    rule_id = uuid.uuid4()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    with pytest.raises(NotFoundError):
        await alert_service.update_alert_rule(
            mock_db, org_id, project_id, rule_id,
            threshold_value=10.0
        )


# ─── Story 5.2: reset_alert_rule_to_defaults tests ────────────────────────────────


@pytest.mark.asyncio
async def test_reset_restores_default_values():
    """Reset restores threshold/duration to preset defaults (AC3)."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    rule_id = uuid.uuid4()

    existing_rule = AlertRule(
        id=rule_id,
        org_id=org_id,
        project_id=project_id,
        preset_key="high_error_rate",
        name="High Error Rate",
        category="availability",
        description="Fires when error rate exceeds threshold",
        threshold_value=10.0,  # Custom
        duration_seconds=600,  # Custom
        comparison_operator="gt",
        is_active=True,
        is_custom=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_rule
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    await alert_service.reset_alert_rule_to_defaults(
        mock_db, org_id, project_id, rule_id
    )

    # high_error_rate defaults: threshold=5.0, duration=300
    assert existing_rule.threshold_value == 5.0
    assert existing_rule.duration_seconds == 300
    assert existing_rule.is_custom is False
