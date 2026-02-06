"""Discord notification service for alerts using webhooks."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Discord embed color codes for severity (decimal format)
DISCORD_SEVERITY_COLORS = {
    "critical": 0xFF0000,  # Red
    "warning": 0xFFA500,  # Orange/Amber
    "info": 0x0000FF,  # Blue
}


@dataclass
class DiscordAlertData:
    """Data required for Discord alert notification."""

    alert_name: str
    project_name: str
    severity: str
    metric_name: str
    metric_value: float
    threshold_value: float
    triggered_at: datetime
    dashboard_url: str


def _build_discord_embed(data: DiscordAlertData) -> dict[str, Any]:
    """Build Discord embed message for alert notification.

    Returns a formatted Discord embed with:
    - Title: alert name
    - Description: metric value vs threshold
    - Color: severity-based
    - Footer: timestamp
    - URL: dashboard link
    """
    severity_color = DISCORD_SEVERITY_COLORS.get(data.severity, 0x333333)
    severity_emoji = {
        "critical": ":red_circle:",
        "warning": ":orange_circle:",
        "info": ":blue_circle:",
    }.get(data.severity, ":white_circle:")

    description = (
        f"**Project:** {data.project_name}\n"
        f"**Severity:** {data.severity.upper()}\n\n"
        f"**{data.metric_name}:** `{data.metric_value:.2f}` exceeds threshold `{data.threshold_value:.2f}`"
    )

    return {
        "embeds": [
            {
                "title": f"{severity_emoji} Alert: {data.alert_name}",
                "description": description,
                "color": severity_color,
                "url": data.dashboard_url,
                "footer": {
                    "text": f"Triggered at {data.triggered_at.strftime('%Y-%m-%d %H:%M:%S UTC')}",
                },
                "timestamp": data.triggered_at.isoformat(),
            }
        ],
    }


async def send_discord_notification(
    webhook_url: str,
    data: DiscordAlertData,
    timeout: float = 10.0,
) -> tuple[bool, str | None]:
    """Send alert notification to Discord via webhook.

    Args:
        webhook_url: Discord webhook URL
        data: Alert data for the notification
        timeout: Request timeout in seconds

    Returns:
        Tuple of (success: bool, error_message: str | None)
    """
    if not webhook_url:
        logger.warning("No Discord webhook URL provided")
        return False, "Webhook URL not configured"

    message = _build_discord_embed(data)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=message,
                timeout=timeout,
            )

            # Discord returns 204 No Content on success
            if response.status_code in (200, 204):
                logger.info(
                    "Discord notification sent for alert '%s'",
                    data.alert_name,
                )
                return True, None
            else:
                error_msg = f"Discord webhook returned {response.status_code}: {response.text}"
                logger.warning(error_msg)
                return False, error_msg

    except httpx.TimeoutException:
        error_msg = f"Discord webhook timed out after {timeout}s"
        logger.warning(error_msg)
        return False, error_msg

    except httpx.RequestError as e:
        error_msg = f"Discord webhook request failed: {e}"
        logger.warning(error_msg)
        return False, error_msg

    except Exception as e:
        error_msg = f"Unexpected error sending Discord notification: {e}"
        logger.exception(error_msg)
        return False, error_msg


async def test_discord_webhook(webhook_url: str) -> tuple[bool, str | None]:
    """Test Discord webhook by sending a test message.

    Args:
        webhook_url: Discord webhook URL

    Returns:
        Tuple of (success: bool, error_message: str | None)
    """
    test_message = {
        "embeds": [
            {
                "title": ":white_check_mark: TRACELY Test Notification",
                "description": "Your Discord webhook is configured correctly!",
                "color": 0x00FF00,  # Green
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

            if response.status_code in (200, 204):
                return True, None
            else:
                return False, f"Webhook returned {response.status_code}: {response.text}"

    except Exception as e:
        return False, str(e)
