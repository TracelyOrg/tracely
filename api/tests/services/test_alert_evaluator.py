"""Tests for alert evaluation engine (Story 5.3)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.alert_rule import AlertRule
from app.services import alert_evaluator
from app.services.alert_evaluator import EvaluationResult


# ─── evaluate_high_error_rate tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_high_error_rate_triggers_when_exceeded():
    """High error rate triggers when rate exceeds threshold."""
    project_id = uuid.uuid4()

    with patch(
        "app.services.alert_evaluator.alert_counters.get_error_rate",
        new_callable=AsyncMock,
        return_value=10.0,  # 10% error rate
    ):
        result = await alert_evaluator.evaluate_high_error_rate(
            project_id, threshold=5.0, duration_seconds=300
        )

    assert result.is_triggered is True
    assert result.metric_value == 10.0
    assert result.threshold_value == 5.0


@pytest.mark.asyncio
async def test_evaluate_high_error_rate_does_not_trigger_when_below():
    """High error rate does not trigger when rate is below threshold."""
    project_id = uuid.uuid4()

    with patch(
        "app.services.alert_evaluator.alert_counters.get_error_rate",
        new_callable=AsyncMock,
        return_value=2.0,  # 2% error rate
    ):
        result = await alert_evaluator.evaluate_high_error_rate(
            project_id, threshold=5.0, duration_seconds=300
        )

    assert result.is_triggered is False
    assert result.metric_value == 2.0


@pytest.mark.asyncio
async def test_evaluate_high_error_rate_does_not_trigger_at_threshold():
    """High error rate does not trigger when rate equals threshold (gt comparison)."""
    project_id = uuid.uuid4()

    with patch(
        "app.services.alert_evaluator.alert_counters.get_error_rate",
        new_callable=AsyncMock,
        return_value=5.0,  # Exactly 5%
    ):
        result = await alert_evaluator.evaluate_high_error_rate(
            project_id, threshold=5.0, duration_seconds=300
        )

    assert result.is_triggered is False


# ─── evaluate_service_down tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_service_down_triggers_when_zero_requests():
    """Service down triggers when request count equals threshold (0)."""
    project_id = uuid.uuid4()

    with patch(
        "app.services.alert_evaluator.alert_counters.get_request_count",
        new_callable=AsyncMock,
        return_value=0,
    ):
        result = await alert_evaluator.evaluate_service_down(
            project_id, threshold=0, duration_seconds=180
        )

    assert result.is_triggered is True
    assert result.metric_value == 0.0


@pytest.mark.asyncio
async def test_evaluate_service_down_does_not_trigger_with_requests():
    """Service down does not trigger when there are requests."""
    project_id = uuid.uuid4()

    with patch(
        "app.services.alert_evaluator.alert_counters.get_request_count",
        new_callable=AsyncMock,
        return_value=100,
    ):
        result = await alert_evaluator.evaluate_service_down(
            project_id, threshold=0, duration_seconds=180
        )

    assert result.is_triggered is False
    assert result.metric_value == 100.0


# ─── evaluate_slow_responses tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_slow_responses_triggers_when_p95_exceeded():
    """Slow responses triggers when P95 latency exceeds threshold."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.result_rows = [[3000.0]]  # 3000ms P95

    mock_client = MagicMock()
    mock_client.query = MagicMock(return_value=mock_result)

    with patch(
        "app.services.alert_evaluator.get_clickhouse_client",
        return_value=mock_client,
    ):
        with patch("asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
            mock_to_thread.return_value = mock_result

            result = await alert_evaluator.evaluate_slow_responses(
                org_id, project_id, threshold=2000, duration_seconds=300
            )

    assert result.is_triggered is True
    assert result.metric_value == 3000.0
    assert result.threshold_value == 2000


@pytest.mark.asyncio
async def test_evaluate_slow_responses_does_not_trigger_when_below():
    """Slow responses does not trigger when P95 is below threshold."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.result_rows = [[1500.0]]  # 1500ms P95

    with patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_result):
        with patch("app.services.alert_evaluator.get_clickhouse_client"):
            result = await alert_evaluator.evaluate_slow_responses(
                org_id, project_id, threshold=2000, duration_seconds=300
            )

    assert result.is_triggered is False
    assert result.metric_value == 1500.0


# ─── evaluate_latency_spike tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_latency_spike_triggers_when_increase_exceeded():
    """Latency spike triggers when percentage increase exceeds threshold."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    # Current P95: 500ms, Previous P95: 100ms -> 400% increase
    mock_result = MagicMock()
    mock_result.result_rows = [[500.0, 100.0]]

    with patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_result):
        with patch("app.services.alert_evaluator.get_clickhouse_client"):
            result = await alert_evaluator.evaluate_latency_spike(
                org_id, project_id, threshold=200, duration_seconds=300
            )

    assert result.is_triggered is True
    assert result.metric_value == 400.0  # 400% increase


@pytest.mark.asyncio
async def test_evaluate_latency_spike_does_not_trigger_when_below():
    """Latency spike does not trigger when increase is below threshold."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    # Current P95: 150ms, Previous P95: 100ms -> 50% increase
    mock_result = MagicMock()
    mock_result.result_rows = [[150.0, 100.0]]

    with patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_result):
        with patch("app.services.alert_evaluator.get_clickhouse_client"):
            result = await alert_evaluator.evaluate_latency_spike(
                org_id, project_id, threshold=200, duration_seconds=300
            )

    assert result.is_triggered is False
    assert result.metric_value == 50.0


@pytest.mark.asyncio
async def test_evaluate_latency_spike_handles_zero_baseline():
    """Latency spike returns 0% when there's no previous baseline."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.result_rows = [[500.0, 0.0]]  # No previous data

    with patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_result):
        with patch("app.services.alert_evaluator.get_clickhouse_client"):
            result = await alert_evaluator.evaluate_latency_spike(
                org_id, project_id, threshold=200, duration_seconds=300
            )

    assert result.is_triggered is False
    assert result.metric_value == 0.0


# ─── evaluate_traffic_drop tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_traffic_drop_triggers_when_drop_exceeded():
    """Traffic drop triggers when volume decrease exceeds threshold."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    # Current: 40, Previous: 100 -> 60% drop
    mock_result = MagicMock()
    mock_result.result_rows = [[40, 100]]

    with patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_result):
        with patch("app.services.alert_evaluator.get_clickhouse_client"):
            result = await alert_evaluator.evaluate_traffic_drop(
                org_id, project_id, threshold=50, duration_seconds=300
            )

    assert result.is_triggered is True
    assert result.metric_value == 60.0  # 60% drop


@pytest.mark.asyncio
async def test_evaluate_traffic_drop_does_not_trigger_on_increase():
    """Traffic drop does not trigger when traffic increases."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    # Current: 200, Previous: 100 -> traffic increased
    mock_result = MagicMock()
    mock_result.result_rows = [[200, 100]]

    with patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_result):
        with patch("app.services.alert_evaluator.get_clickhouse_client"):
            result = await alert_evaluator.evaluate_traffic_drop(
                org_id, project_id, threshold=50, duration_seconds=300
            )

    assert result.is_triggered is False
    assert result.metric_value == 0.0


# ─── evaluate_traffic_surge tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_traffic_surge_triggers_when_increase_exceeded():
    """Traffic surge triggers when volume increase exceeds threshold."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    # Current: 500, Previous: 100 -> 400% increase
    mock_result = MagicMock()
    mock_result.result_rows = [[500, 100]]

    with patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_result):
        with patch("app.services.alert_evaluator.get_clickhouse_client"):
            result = await alert_evaluator.evaluate_traffic_surge(
                org_id, project_id, threshold=300, duration_seconds=300
            )

    assert result.is_triggered is True
    assert result.metric_value == 400.0  # 400% increase


@pytest.mark.asyncio
async def test_evaluate_traffic_surge_does_not_trigger_on_decrease():
    """Traffic surge does not trigger when traffic decreases."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    # Current: 50, Previous: 100 -> traffic decreased
    mock_result = MagicMock()
    mock_result.result_rows = [[50, 100]]

    with patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_result):
        with patch("app.services.alert_evaluator.get_clickhouse_client"):
            result = await alert_evaluator.evaluate_traffic_surge(
                org_id, project_id, threshold=300, duration_seconds=300
            )

    assert result.is_triggered is False
    assert result.metric_value == 0.0


# ─── evaluate_alert_rule tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_alert_rule_dispatches_to_correct_evaluator():
    """evaluate_alert_rule dispatches to correct evaluator based on preset_key."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()

    rule = AlertRule(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
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
    )

    with patch(
        "app.services.alert_evaluator.evaluate_high_error_rate",
        new_callable=AsyncMock,
    ) as mock_eval:
        mock_eval.return_value = EvaluationResult(
            is_triggered=True, metric_value=10.0, threshold_value=5.0
        )

        result = await alert_evaluator.evaluate_alert_rule(rule)

    mock_eval.assert_called_once_with(project_id, 5.0, 300)
    assert result.is_triggered is True


@pytest.mark.asyncio
async def test_evaluate_alert_rule_unknown_preset_returns_not_triggered():
    """evaluate_alert_rule returns not triggered for unknown preset."""
    rule = AlertRule(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        preset_key="unknown_preset",
        name="Unknown",
        category="availability",
        description="Test",
        threshold_value=5.0,
        duration_seconds=300,
        comparison_operator="gt",
        is_active=True,
        is_custom=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    result = await alert_evaluator.evaluate_alert_rule(rule)

    assert result.is_triggered is False
    assert result.metric_value == 0.0


# ─── fire_alert tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_fire_alert_creates_event_when_not_in_cooldown():
    """fire_alert creates new AlertEvent when not in cooldown."""
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    rule_id = uuid.uuid4()

    rule = AlertRule(
        id=rule_id,
        org_id=org_id,
        project_id=project_id,
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
    )

    result = EvaluationResult(is_triggered=True, metric_value=10.0, threshold_value=5.0)

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    with patch(
        "app.services.alert_evaluator.alert_counters.is_in_cooldown",
        new_callable=AsyncMock,
        return_value=False,
    ):
        with patch(
            "app.services.alert_evaluator.alert_counters.set_cooldown",
            new_callable=AsyncMock,
        ):
            event = await alert_evaluator.fire_alert(mock_db, rule, result)

    assert event is not None
    assert event.status == "triggered"
    assert event.metric_value == 10.0
    mock_db.add.assert_called_once()


@pytest.mark.asyncio
async def test_fire_alert_updates_existing_when_in_cooldown():
    """fire_alert updates existing event when in cooldown."""
    from app.models.alert_event import AlertEvent

    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    rule_id = uuid.uuid4()

    rule = AlertRule(
        id=rule_id,
        org_id=org_id,
        project_id=project_id,
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
    )

    result = EvaluationResult(is_triggered=True, metric_value=15.0, threshold_value=5.0)

    existing_event = AlertEvent(
        id=uuid.uuid4(),
        rule_id=rule_id,
        org_id=org_id,
        project_id=project_id,
        metric_value=10.0,
        threshold_value=5.0,
        status="triggered",
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_event

    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()

    with patch(
        "app.services.alert_evaluator.alert_counters.is_in_cooldown",
        new_callable=AsyncMock,
        return_value=True,
    ):
        event = await alert_evaluator.fire_alert(mock_db, rule, result)

    assert event is existing_event
    assert event.status == "active"
    assert event.metric_value == 15.0  # Updated


# ─── resolve_alert tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_alert_resolves_active_event():
    """resolve_alert resolves an active alert event."""
    from app.models.alert_event import AlertEvent

    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    rule_id = uuid.uuid4()

    rule = AlertRule(
        id=rule_id,
        org_id=org_id,
        project_id=project_id,
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
    )

    active_event = AlertEvent(
        id=uuid.uuid4(),
        rule_id=rule_id,
        org_id=org_id,
        project_id=project_id,
        metric_value=10.0,
        threshold_value=5.0,
        status="active",
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = active_event

    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()

    with patch(
        "app.services.alert_evaluator.alert_counters.clear_cooldown",
        new_callable=AsyncMock,
    ):
        event = await alert_evaluator.resolve_alert(mock_db, rule)

    assert event is active_event
    assert event.status == "resolved"
    assert event.resolved_at is not None


@pytest.mark.asyncio
async def test_resolve_alert_returns_none_when_no_active():
    """resolve_alert returns None when no active event exists."""
    rule = AlertRule(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
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
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result

    event = await alert_evaluator.resolve_alert(mock_db, rule)

    assert event is None


# ─── helper function tests ─────────────────────────────────


def test_is_critical_alert():
    """is_critical_alert correctly identifies critical alerts."""
    assert alert_evaluator.is_critical_alert("high_error_rate") is True
    assert alert_evaluator.is_critical_alert("service_down") is True
    assert alert_evaluator.is_critical_alert("slow_responses") is False
    assert alert_evaluator.is_critical_alert("traffic_surge") is False


def test_is_threshold_alert():
    """is_threshold_alert correctly identifies threshold alerts."""
    assert alert_evaluator.is_threshold_alert("slow_responses") is True
    assert alert_evaluator.is_threshold_alert("latency_spike") is True
    assert alert_evaluator.is_threshold_alert("traffic_drop") is True
    assert alert_evaluator.is_threshold_alert("traffic_surge") is True
    assert alert_evaluator.is_threshold_alert("high_error_rate") is False
