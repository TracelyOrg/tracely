"""Notification dispatcher orchestrator for alerts.

Dispatches alert notifications to all configured channels (email, Slack, Discord).
Handles retry logic and channel isolation (one failure doesn't block others).
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.alert_event import AlertEvent
from app.models.alert_rule import AlertRule
from app.models.notification_channel import NotificationChannel
from app.models.org_member import OrgMember
from app.models.user import User
from app.services.notifications.discord_notifier import DiscordAlertData, send_discord_notification
from app.services.notifications.email_notifier import AlertEmailData, send_alert_email
from app.services.notifications.slack_notifier import SlackAlertData, send_slack_notification

logger = logging.getLogger(__name__)

# Retry delay in seconds
RETRY_DELAY_SECONDS = 30

# Alert severity mapping
ALERT_SEVERITY = {
    "high_error_rate": "critical",
    "service_down": "critical",
    "slow_responses": "warning",
    "latency_spike": "warning",
    "traffic_drop": "warning",
    "traffic_surge": "info",
}

# Metric display names
METRIC_NAMES = {
    "high_error_rate": "Error Rate",
    "service_down": "Request Count",
    "slow_responses": "P95 Latency",
    "latency_spike": "Latency Increase",
    "traffic_drop": "Traffic Drop",
    "traffic_surge": "Traffic Increase",
}


@dataclass
class DispatchResult:
    """Result of a notification dispatch attempt."""

    channel_type: str
    success: bool
    error: str | None = None
    retried: bool = False


async def _get_org_admin_emails(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> list[str]:
    """Get email addresses of all org admins.

    Args:
        db: Database session
        org_id: Organization ID

    Returns:
        List of admin email addresses
    """
    result = await db.execute(
        select(User.email)
        .join(OrgMember, OrgMember.user_id == User.id)
        .where(
            OrgMember.org_id == org_id,
            OrgMember.role.in_(["admin", "owner"]),
        )
    )
    return [row[0] for row in result.fetchall()]


async def _get_notification_channels(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> list[NotificationChannel]:
    """Get all enabled notification channels for a project.

    Args:
        db: Database session
        project_id: Project ID

    Returns:
        List of enabled NotificationChannel objects
    """
    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.project_id == project_id,
            NotificationChannel.is_enabled == True,  # noqa: E712
        )
    )
    return list(result.scalars().all())


async def _get_project_name(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> str:
    """Get project name by ID."""
    from app.models.project import Project

    result = await db.execute(
        select(Project.name).where(Project.id == project_id)
    )
    row = result.fetchone()
    return row[0] if row else "Unknown Project"


def _build_dashboard_url(org_slug: str, project_slug: str) -> str:
    """Build dashboard URL for alert link."""
    return f"{settings.frontend_url}/{org_slug}/{project_slug}/alerts"


async def _dispatch_email(
    db: AsyncSession,
    rule: AlertRule,
    event: AlertEvent,
    project_name: str,
    dashboard_url: str,
) -> DispatchResult:
    """Dispatch email notification to org admins."""
    # Get admin email addresses
    recipients = await _get_org_admin_emails(db, rule.org_id)

    if not recipients:
        return DispatchResult(
            channel_type="email",
            success=False,
            error="No admin recipients found",
        )

    severity = ALERT_SEVERITY.get(rule.preset_key, "info")
    metric_name = METRIC_NAMES.get(rule.preset_key, "Metric")

    data = AlertEmailData(
        alert_name=rule.name,
        project_name=project_name,
        severity=severity,
        metric_name=metric_name,
        metric_value=event.metric_value,
        threshold_value=event.threshold_value,
        triggered_at=event.triggered_at or datetime.now(timezone.utc),
        dashboard_url=dashboard_url,
    )

    success, error = await send_alert_email(recipients, data)
    return DispatchResult(channel_type="email", success=success, error=error)


async def _dispatch_slack(
    channel: NotificationChannel,
    rule: AlertRule,
    event: AlertEvent,
    project_name: str,
    dashboard_url: str,
) -> DispatchResult:
    """Dispatch Slack notification."""
    webhook_url = channel.config.get("webhook_url")

    if not webhook_url:
        return DispatchResult(
            channel_type="slack",
            success=False,
            error="Webhook URL not configured",
        )

    severity = ALERT_SEVERITY.get(rule.preset_key, "info")
    metric_name = METRIC_NAMES.get(rule.preset_key, "Metric")

    data = SlackAlertData(
        alert_name=rule.name,
        project_name=project_name,
        severity=severity,
        metric_name=metric_name,
        metric_value=event.metric_value,
        threshold_value=event.threshold_value,
        triggered_at=event.triggered_at or datetime.now(timezone.utc),
        dashboard_url=dashboard_url,
    )

    success, error = await send_slack_notification(webhook_url, data)
    return DispatchResult(channel_type="slack", success=success, error=error)


async def _dispatch_discord(
    channel: NotificationChannel,
    rule: AlertRule,
    event: AlertEvent,
    project_name: str,
    dashboard_url: str,
) -> DispatchResult:
    """Dispatch Discord notification."""
    webhook_url = channel.config.get("webhook_url")

    if not webhook_url:
        return DispatchResult(
            channel_type="discord",
            success=False,
            error="Webhook URL not configured",
        )

    severity = ALERT_SEVERITY.get(rule.preset_key, "info")
    metric_name = METRIC_NAMES.get(rule.preset_key, "Metric")

    data = DiscordAlertData(
        alert_name=rule.name,
        project_name=project_name,
        severity=severity,
        metric_name=metric_name,
        metric_value=event.metric_value,
        threshold_value=event.threshold_value,
        triggered_at=event.triggered_at or datetime.now(timezone.utc),
        dashboard_url=dashboard_url,
    )

    success, error = await send_discord_notification(webhook_url, data)
    return DispatchResult(channel_type="discord", success=success, error=error)


async def _dispatch_with_retry(
    dispatch_fn,
    *args,
    **kwargs,
) -> DispatchResult:
    """Execute dispatch with single retry on failure."""
    result = await dispatch_fn(*args, **kwargs)

    if not result.success:
        logger.info(
            "Notification dispatch failed for %s, scheduling retry in %ds",
            result.channel_type,
            RETRY_DELAY_SECONDS,
        )
        await asyncio.sleep(RETRY_DELAY_SECONDS)

        # Retry once
        retry_result = await dispatch_fn(*args, **kwargs)
        retry_result.retried = True

        if retry_result.success:
            logger.info("Retry succeeded for %s", result.channel_type)
        else:
            logger.warning(
                "Retry failed for %s: %s",
                result.channel_type,
                retry_result.error,
            )

        return retry_result

    return result


async def dispatch_alert_notification(
    db: AsyncSession,
    event: AlertEvent,
    rule: AlertRule,
    org_slug: str,
    project_slug: str,
) -> list[DispatchResult]:
    """Dispatch alert notification to all configured channels.

    Sends notifications to:
    - Email: Always (all tiers) - sends to org admins
    - Slack: If configured and enabled
    - Discord: If configured and enabled

    Each channel is dispatched independently; failures don't block others.
    Failed channels are retried once after 30 seconds.

    Args:
        db: Database session
        event: The alert event that triggered
        rule: The alert rule that fired
        org_slug: Organization slug for dashboard URL
        project_slug: Project slug for dashboard URL

    Returns:
        List of DispatchResult for each channel attempted
    """
    project_name = await _get_project_name(db, rule.project_id)
    dashboard_url = _build_dashboard_url(org_slug, project_slug)

    # Get configured notification channels
    channels = await _get_notification_channels(db, rule.project_id)

    # Build dispatch tasks
    tasks: list[asyncio.Task] = []
    results: list[DispatchResult] = []

    # Always send email (all tiers)
    email_task = asyncio.create_task(
        _dispatch_with_retry(
            _dispatch_email,
            db,
            rule,
            event,
            project_name,
            dashboard_url,
        )
    )
    tasks.append(email_task)

    # Dispatch to configured channels
    for channel in channels:
        if channel.channel_type == "slack":
            task = asyncio.create_task(
                _dispatch_with_retry(
                    _dispatch_slack,
                    channel,
                    rule,
                    event,
                    project_name,
                    dashboard_url,
                )
            )
            tasks.append(task)

        elif channel.channel_type == "discord":
            task = asyncio.create_task(
                _dispatch_with_retry(
                    _dispatch_discord,
                    channel,
                    rule,
                    event,
                    project_name,
                    dashboard_url,
                )
            )
            tasks.append(task)

    # Wait for all dispatches to complete
    if tasks:
        results = await asyncio.gather(*tasks)

    # Log summary
    successful = sum(1 for r in results if r.success)
    failed = len(results) - successful
    logger.info(
        "Alert notification dispatch complete: %d/%d succeeded, %d failed",
        successful,
        len(results),
        failed,
    )

    # Update event notification status
    event.notification_sent = successful > 0
    await db.commit()

    return results


async def dispatch_alert_notification_async(
    event_id: uuid.UUID,
    rule_id: uuid.UUID,
    org_slug: str,
    project_slug: str,
) -> None:
    """Fire-and-forget wrapper for alert notification dispatch.

    Loads event and rule from database and dispatches notifications.
    Intended to be called with asyncio.create_task().
    """
    from app.db.postgres import async_session_factory

    try:
        async with async_session_factory() as db:
            # Load event and rule
            event_result = await db.execute(
                select(AlertEvent).where(AlertEvent.id == event_id)
            )
            event = event_result.scalar_one_or_none()

            rule_result = await db.execute(
                select(AlertRule).where(AlertRule.id == rule_id)
            )
            rule = rule_result.scalar_one_or_none()

            if not event or not rule:
                logger.warning(
                    "Cannot dispatch notification: event=%s rule=%s not found",
                    event_id,
                    rule_id,
                )
                return

            await dispatch_alert_notification(
                db, event, rule, org_slug, project_slug
            )

    except Exception as e:
        logger.exception(
            "Error dispatching alert notification for event %s: %s",
            event_id,
            e,
        )
