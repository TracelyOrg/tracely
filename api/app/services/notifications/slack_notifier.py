"""Slack notification service for alerts using webhooks."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Slack color codes for severity
SLACK_SEVERITY_COLORS = {
    "critical": "#FF0000",  # Red
    "warning": "#FFA500",  # Orange/Amber
    "info": "#0000FF",  # Blue
}


@dataclass
class SlackAlertData:
    """Data required for Slack alert notification."""

    alert_name: str
    project_name: str
    severity: str
    metric_name: str
    metric_value: float
    threshold_value: float
    triggered_at: datetime
    dashboard_url: str


def _build_slack_message(data: SlackAlertData) -> dict[str, Any]:
    """Build Slack Block Kit message for alert notification.

    Returns a formatted Slack message with:
    - Header block with alert name
    - Section with metric value and threshold
    - Context with timestamp
    - Button linking to dashboard
    - Color attachment based on severity
    """
    severity_color = SLACK_SEVERITY_COLORS.get(data.severity, "#333333")
    severity_emoji = {
        "critical": ":red_circle:",
        "warning": ":large_orange_circle:",
        "info": ":large_blue_circle:",
    }.get(data.severity, ":white_circle:")

    return {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{severity_emoji} Alert: {data.alert_name}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*Project:* {data.project_name}\n"
                        f"*Severity:* {data.severity.upper()}\n\n"
                        f"*{data.metric_name}:* `{data.metric_value:.2f}` "
                        f"(threshold: `{data.threshold_value:.2f}`)"
                    ),
                },
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "plain_text",
                        "text": f"Triggered at {data.triggered_at.strftime('%Y-%m-%d %H:%M:%S UTC')}",
                    }
                ],
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Dashboard",
                            "emoji": True,
                        },
                        "url": data.dashboard_url,
                        "style": "primary",
                    }
                ],
            },
        ],
        "attachments": [{"color": severity_color}],
    }


async def send_slack_notification(
    webhook_url: str,
    data: SlackAlertData,
    timeout: float = 10.0,
) -> tuple[bool, str | None]:
    """Send alert notification to Slack via webhook.

    Args:
        webhook_url: Slack incoming webhook URL
        data: Alert data for the notification
        timeout: Request timeout in seconds

    Returns:
        Tuple of (success: bool, error_message: str | None)
    """
    if not webhook_url:
        logger.warning("No Slack webhook URL provided")
        return False, "Webhook URL not configured"

    message = _build_slack_message(data)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=message,
                timeout=timeout,
            )

            if response.status_code == 200:
                logger.info(
                    "Slack notification sent for alert '%s'",
                    data.alert_name,
                )
                return True, None
            else:
                error_msg = f"Slack webhook returned {response.status_code}: {response.text}"
                logger.warning(error_msg)
                return False, error_msg

    except httpx.TimeoutException:
        error_msg = f"Slack webhook timed out after {timeout}s"
        logger.warning(error_msg)
        return False, error_msg

    except httpx.RequestError as e:
        error_msg = f"Slack webhook request failed: {e}"
        logger.warning(error_msg)
        return False, error_msg

    except Exception as e:
        error_msg = f"Unexpected error sending Slack notification: {e}"
        logger.exception(error_msg)
        return False, error_msg


async def test_slack_webhook(webhook_url: str) -> tuple[bool, str | None]:
    """Test Slack webhook by sending a test message.

    Args:
        webhook_url: Slack incoming webhook URL

    Returns:
        Tuple of (success: bool, error_message: str | None)
    """
    test_message = {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": ":white_check_mark: *TRACELY Test Notification*\nYour Slack webhook is configured correctly!",
                },
            }
        ],
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=test_message,
                timeout=10.0,
            )

            if response.status_code == 200:
                return True, None
            else:
                return False, f"Webhook returned {response.status_code}: {response.text}"

    except Exception as e:
        return False, str(e)
