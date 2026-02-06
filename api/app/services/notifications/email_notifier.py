"""Email notification service for alerts using Resend API."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class AlertEmailData:
    """Data required for alert email notification."""

    alert_name: str
    project_name: str
    severity: str
    metric_name: str
    metric_value: float
    threshold_value: float
    triggered_at: datetime
    dashboard_url: str


def _alert_email_html(data: AlertEmailData) -> str:
    """Build HTML email body for alert notification."""
    severity_color = {
        "critical": "#FF0000",
        "warning": "#FFA500",
        "info": "#0000FF",
    }.get(data.severity, "#333333")

    return f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="border-left: 4px solid {severity_color}; padding-left: 16px; margin-bottom: 24px;">
            <h2 style="color: #111; margin: 0 0 8px 0;">Alert: {data.alert_name}</h2>
            <p style="color: #666; margin: 0;">Project: {data.project_name}</p>
        </div>

        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0;">
                <strong>Severity:</strong>
                <span style="color: {severity_color}; text-transform: uppercase;">{data.severity}</span>
            </p>
            <p style="margin: 0 0 8px 0;">
                <strong>{data.metric_name}:</strong> {data.metric_value:.2f}
            </p>
            <p style="margin: 0 0 8px 0;">
                <strong>Threshold:</strong> {data.threshold_value:.2f}
            </p>
            <p style="margin: 0; color: #666;">
                <strong>Triggered at:</strong> {data.triggered_at.strftime('%Y-%m-%d %H:%M:%S UTC')}
            </p>
        </div>

        <a href="{data.dashboard_url}"
           style="display: inline-block; padding: 12px 24px; background: #0f172a;
                  color: #fff; text-decoration: none; border-radius: 6px;">
            View Dashboard
        </a>

        <p style="color: #999; font-size: 12px; margin-top: 24px;">
            You're receiving this because you're an admin of this organization or created this alert.
        </p>
    </div>
    """


def _alert_email_text(data: AlertEmailData) -> str:
    """Build plain text email body for alert notification."""
    return f"""
Alert: {data.alert_name}
Project: {data.project_name}
Severity: {data.severity.upper()}

{data.metric_name}: {data.metric_value:.2f}
Threshold: {data.threshold_value:.2f}

Triggered at: {data.triggered_at.strftime('%Y-%m-%d %H:%M:%S UTC')}

View Dashboard: {data.dashboard_url}

---
You're receiving this because you're an admin of this organization or created this alert.
"""


async def send_alert_email(
    recipients: list[str],
    data: AlertEmailData,
) -> tuple[bool, str | None]:
    """Send alert notification email to recipients.

    Args:
        recipients: List of email addresses
        data: Alert data for the email

    Returns:
        Tuple of (success: bool, error_message: str | None)
    """
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping alert email")
        return False, "Resend API key not configured"

    if not recipients:
        logger.warning("No recipients for alert email")
        return False, "No recipients specified"

    subject = f"[TRACELY Alert] {data.alert_name} - {data.project_name}"

    try:
        import resend

        resend.api_key = settings.resend_api_key

        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": settings.resend_from_email,
                "to": recipients,
                "subject": subject,
                "html": _alert_email_html(data),
                "text": _alert_email_text(data),
            },
        )

        logger.info(
            "Alert email sent to %d recipients for alert '%s'",
            len(recipients),
            data.alert_name,
        )
        return True, None

    except Exception as e:
        error_msg = str(e)
        logger.exception(
            "Failed to send alert email for '%s': %s",
            data.alert_name,
            error_msg,
        )
        return False, error_msg
