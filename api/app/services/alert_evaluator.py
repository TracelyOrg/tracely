"""Alert condition evaluation service.

Implements the hybrid alert evaluation approach (AR7):
- Critical alerts (high_error_rate, service_down): evaluated inline during ingestion
- Threshold alerts (slow_responses, latency_spike, traffic_drop, traffic_surge):
  evaluated on 60s schedule via ClickHouse queries

This module provides evaluation functions for each alert type.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.clickhouse import get_clickhouse_client
from app.models.alert_event import AlertEvent
from app.models.alert_rule import AlertRule
from app.services import alert_counters
from app.services.alert_presets import ALERT_PRESETS

logger = logging.getLogger(__name__)

# Alert categories
CRITICAL_ALERTS = {"high_error_rate", "service_down"}
THRESHOLD_ALERTS = {"slow_responses", "latency_spike", "traffic_drop", "traffic_surge"}

# Default cooldown period (5 minutes)
DEFAULT_COOLDOWN_SECONDS = 300


@dataclass
class EvaluationResult:
    """Result of evaluating an alert condition."""

    is_triggered: bool
    metric_value: float
    threshold_value: float


async def evaluate_high_error_rate(
    project_id: uuid.UUID,
    threshold: float,
    duration_seconds: int,
) -> EvaluationResult:
    """Evaluate high error rate condition using Redis counters.

    Args:
        project_id: Project ID
        threshold: Error rate threshold (percentage)
        duration_seconds: Duration window in seconds

    Returns:
        EvaluationResult with trigger status and values
    """
    window_minutes = max(1, duration_seconds // 60)
    error_rate = await alert_counters.get_error_rate(project_id, window_minutes)

    return EvaluationResult(
        is_triggered=error_rate > threshold,
        metric_value=error_rate,
        threshold_value=threshold,
    )


async def evaluate_service_down(
    project_id: uuid.UUID,
    threshold: float,  # Should be 0 for service_down
    duration_seconds: int,
) -> EvaluationResult:
    """Evaluate service down condition (zero requests).

    Args:
        project_id: Project ID
        threshold: Request count threshold (should be 0)
        duration_seconds: Duration window in seconds

    Returns:
        EvaluationResult with trigger status and values
    """
    window_minutes = max(1, duration_seconds // 60)
    request_count = await alert_counters.get_request_count(project_id, window_minutes)

    # Service is down if request count equals threshold (0)
    return EvaluationResult(
        is_triggered=request_count == threshold,
        metric_value=float(request_count),
        threshold_value=threshold,
    )


async def evaluate_slow_responses(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    threshold: float,  # P95 latency in ms
    duration_seconds: int,
) -> EvaluationResult:
    """Evaluate slow responses condition using ClickHouse metrics_1m.

    Args:
        org_id: Organization ID
        project_id: Project ID
        threshold: P95 latency threshold in milliseconds
        duration_seconds: Duration window in seconds

    Returns:
        EvaluationResult with trigger status and values
    """
    window_minutes = max(1, duration_seconds // 60)

    query = """
    SELECT quantileMerge(0.95)(p95_duration) as p95
    FROM metrics_1m
    WHERE org_id = %(org_id)s
      AND project_id = %(project_id)s
      AND time_bucket >= now() - INTERVAL %(window)s MINUTE
    """

    try:
        client = get_clickhouse_client()
        result = await asyncio.to_thread(
            client.query,
            query,
            parameters={
                "org_id": str(org_id),
                "project_id": str(project_id),
                "window": window_minutes,
            },
        )
        rows = result.result_rows
        p95 = rows[0][0] if rows and rows[0][0] is not None else 0.0
    except Exception as e:
        logger.warning("Failed to query p95 latency: %s", e)
        p95 = 0.0

    return EvaluationResult(
        is_triggered=p95 > threshold,
        metric_value=p95,
        threshold_value=threshold,
    )


async def evaluate_latency_spike(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    threshold: float,  # Percentage increase (e.g., 200 for 200%)
    duration_seconds: int,
) -> EvaluationResult:
    """Evaluate latency spike condition (P95 increase vs previous hour).

    Args:
        org_id: Organization ID
        project_id: Project ID
        threshold: Percentage increase threshold
        duration_seconds: Duration window in seconds (used for current measurement)

    Returns:
        EvaluationResult with trigger status and values
    """
    window_minutes = max(1, duration_seconds // 60)

    query = """
    SELECT
        (SELECT quantileMerge(0.95)(p95_duration)
         FROM metrics_1m
         WHERE org_id = %(org_id)s AND project_id = %(project_id)s
           AND time_bucket >= now() - INTERVAL %(window)s MINUTE) as current_p95,
        (SELECT quantileMerge(0.95)(p95_duration)
         FROM metrics_1m
         WHERE org_id = %(org_id)s AND project_id = %(project_id)s
           AND time_bucket BETWEEN now() - INTERVAL 2 HOUR AND now() - INTERVAL 1 HOUR) as previous_p95
    """

    try:
        client = get_clickhouse_client()
        result = await asyncio.to_thread(
            client.query,
            query,
            parameters={
                "org_id": str(org_id),
                "project_id": str(project_id),
                "window": window_minutes,
            },
        )
        rows = result.result_rows
        if rows:
            current_p95 = rows[0][0] if rows[0][0] is not None else 0.0
            previous_p95 = rows[0][1] if rows[0][1] is not None else 0.0
        else:
            current_p95 = 0.0
            previous_p95 = 0.0
    except Exception as e:
        logger.warning("Failed to query latency spike: %s", e)
        current_p95 = 0.0
        previous_p95 = 0.0

    # Calculate percentage increase
    if previous_p95 > 0:
        pct_increase = ((current_p95 - previous_p95) / previous_p95) * 100
    else:
        pct_increase = 0.0

    return EvaluationResult(
        is_triggered=pct_increase >= threshold,
        metric_value=pct_increase,
        threshold_value=threshold,
    )


async def evaluate_traffic_drop(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    threshold: float,  # Percentage decrease (e.g., 50 for 50%)
    duration_seconds: int,
) -> EvaluationResult:
    """Evaluate traffic drop condition (volume decrease vs previous hour).

    Args:
        org_id: Organization ID
        project_id: Project ID
        threshold: Percentage decrease threshold
        duration_seconds: Duration window in seconds

    Returns:
        EvaluationResult with trigger status and values
    """
    return await _evaluate_volume_change(
        org_id, project_id, threshold, duration_seconds, is_drop=True
    )


async def evaluate_traffic_surge(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    threshold: float,  # Percentage increase (e.g., 300 for 300%)
    duration_seconds: int,
) -> EvaluationResult:
    """Evaluate traffic surge condition (volume increase vs previous hour).

    Args:
        org_id: Organization ID
        project_id: Project ID
        threshold: Percentage increase threshold
        duration_seconds: Duration window in seconds

    Returns:
        EvaluationResult with trigger status and values
    """
    return await _evaluate_volume_change(
        org_id, project_id, threshold, duration_seconds, is_drop=False
    )


async def _evaluate_volume_change(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    threshold: float,
    duration_seconds: int,
    is_drop: bool,
) -> EvaluationResult:
    """Internal helper for traffic drop/surge evaluation."""
    window_minutes = max(1, duration_seconds // 60)

    query = """
    SELECT
        (SELECT countMerge(request_count)
         FROM metrics_1m
         WHERE org_id = %(org_id)s AND project_id = %(project_id)s
           AND time_bucket >= now() - INTERVAL %(window)s MINUTE) as current_count,
        (SELECT countMerge(request_count)
         FROM metrics_1m
         WHERE org_id = %(org_id)s AND project_id = %(project_id)s
           AND time_bucket BETWEEN now() - INTERVAL 2 HOUR AND now() - INTERVAL 1 HOUR) as previous_count
    """

    try:
        client = get_clickhouse_client()
        result = await asyncio.to_thread(
            client.query,
            query,
            parameters={
                "org_id": str(org_id),
                "project_id": str(project_id),
                "window": window_minutes,
            },
        )
        rows = result.result_rows
        if rows:
            current_count = rows[0][0] if rows[0][0] is not None else 0
            previous_count = rows[0][1] if rows[0][1] is not None else 0
        else:
            current_count = 0
            previous_count = 0
    except Exception as e:
        logger.warning("Failed to query volume change: %s", e)
        current_count = 0
        previous_count = 0

    # Calculate percentage change
    if previous_count > 0:
        pct_change = ((current_count - previous_count) / previous_count) * 100
    else:
        pct_change = 0.0

    if is_drop:
        # Traffic drop: negative percentage change >= threshold
        metric_value = abs(pct_change) if pct_change < 0 else 0.0
        is_triggered = pct_change < 0 and abs(pct_change) >= threshold
    else:
        # Traffic surge: positive percentage change >= threshold
        metric_value = pct_change if pct_change > 0 else 0.0
        is_triggered = pct_change > 0 and pct_change >= threshold

    return EvaluationResult(
        is_triggered=is_triggered,
        metric_value=metric_value,
        threshold_value=threshold,
    )


async def evaluate_alert_rule(
    rule: AlertRule,
) -> EvaluationResult:
    """Evaluate an alert rule and return the result.

    Dispatches to the appropriate evaluator based on preset_key.

    Args:
        rule: The alert rule to evaluate

    Returns:
        EvaluationResult with trigger status and values
    """
    preset_key = rule.preset_key
    threshold = rule.threshold_value
    duration = rule.duration_seconds
    org_id = rule.org_id
    project_id = rule.project_id

    if preset_key == "high_error_rate":
        return await evaluate_high_error_rate(project_id, threshold, duration)
    elif preset_key == "service_down":
        return await evaluate_service_down(project_id, threshold, duration)
    elif preset_key == "slow_responses":
        return await evaluate_slow_responses(org_id, project_id, threshold, duration)
    elif preset_key == "latency_spike":
        return await evaluate_latency_spike(org_id, project_id, threshold, duration)
    elif preset_key == "traffic_drop":
        return await evaluate_traffic_drop(org_id, project_id, threshold, duration)
    elif preset_key == "traffic_surge":
        return await evaluate_traffic_surge(org_id, project_id, threshold, duration)
    else:
        logger.warning("Unknown alert preset: %s", preset_key)
        return EvaluationResult(
            is_triggered=False,
            metric_value=0.0,
            threshold_value=threshold,
        )


async def fire_alert(
    db: AsyncSession,
    rule: AlertRule,
    result: EvaluationResult,
) -> AlertEvent | None:
    """Fire an alert by creating an alert event.

    Handles cooldown logic:
    - If in cooldown, updates existing event status instead of creating new
    - If not in cooldown, creates new event and sets cooldown

    Args:
        db: Database session
        rule: The alert rule that triggered
        result: Evaluation result with metric values

    Returns:
        The AlertEvent if created/updated, None if skipped due to cooldown
    """
    # Check if in cooldown
    if await alert_counters.is_in_cooldown(rule.id):
        logger.info(
            "Alert rule %s is in cooldown, updating existing event",
            rule.id,
        )
        # Find existing active event and update its status
        existing = await db.execute(
            select(AlertEvent)
            .where(
                AlertEvent.rule_id == rule.id,
                AlertEvent.status.in_(["triggered", "active"]),
            )
            .order_by(AlertEvent.triggered_at.desc())
            .limit(1)
        )
        event = existing.scalar_one_or_none()
        if event:
            event.status = "active"
            event.metric_value = result.metric_value
            await db.commit()
            return event
        return None

    # Create new alert event
    cooldown_until = datetime.now(timezone.utc) + timedelta(seconds=DEFAULT_COOLDOWN_SECONDS)
    event = AlertEvent(
        rule_id=rule.id,
        org_id=rule.org_id,
        project_id=rule.project_id,
        metric_value=result.metric_value,
        threshold_value=result.threshold_value,
        status="triggered",
        cooldown_until=cooldown_until,
        notification_sent=False,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    # Set cooldown in Redis
    await alert_counters.set_cooldown(rule.id, DEFAULT_COOLDOWN_SECONDS)

    logger.info(
        "Alert fired: rule=%s metric=%f threshold=%f",
        rule.preset_key,
        result.metric_value,
        result.threshold_value,
    )

    return event


async def resolve_alert(
    db: AsyncSession,
    rule: AlertRule,
) -> AlertEvent | None:
    """Resolve an active alert when condition is no longer met.

    Args:
        db: Database session
        rule: The alert rule

    Returns:
        The resolved AlertEvent if found, None otherwise
    """
    # Find existing active event
    existing = await db.execute(
        select(AlertEvent)
        .where(
            AlertEvent.rule_id == rule.id,
            AlertEvent.status.in_(["triggered", "active"]),
        )
        .order_by(AlertEvent.triggered_at.desc())
        .limit(1)
    )
    event = existing.scalar_one_or_none()

    if event:
        event.status = "resolved"
        event.resolved_at = datetime.now(timezone.utc)
        await db.commit()

        # Clear cooldown
        await alert_counters.clear_cooldown(rule.id)

        logger.info("Alert resolved: rule=%s", rule.preset_key)
        return event

    return None


def is_critical_alert(preset_key: str) -> bool:
    """Check if an alert preset is a critical (inline) alert."""
    return preset_key in CRITICAL_ALERTS


def is_threshold_alert(preset_key: str) -> bool:
    """Check if an alert preset is a threshold (scheduled) alert."""
    return preset_key in THRESHOLD_ALERTS
