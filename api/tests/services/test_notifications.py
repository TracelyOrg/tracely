"""Tests for notification dispatch services (Story 5.4)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.notifications.email_notifier import AlertEmailData, send_alert_email
from app.services.notifications.slack_notifier import SlackAlertData, send_slack_notification
from app.services.notifications.discord_notifier import DiscordAlertData, send_discord_notification


# ─── Email notifier tests ─────────────────────────────────


@pytest.fixture
def email_data():
    return AlertEmailData(
        alert_name="High Error Rate",
        project_name="My Project",
        severity="critical",
        metric_name="Error Rate",
        metric_value=10.5,
        threshold_value=5.0,
        triggered_at=datetime.now(timezone.utc),
        dashboard_url="https://tracely.sh/my-org/my-project/alerts",
    )


@pytest.mark.asyncio
async def test_send_alert_email_success(email_data):
    """Email is sent successfully via Resend."""
    import sys

    recipients = ["admin@example.com", "owner@example.com"]

    # Create mock resend module
    mock_resend = MagicMock()
    mock_resend.Emails = MagicMock()
    mock_resend.Emails.send = MagicMock(return_value={"id": "test-email-id"})

    with patch("app.services.notifications.email_notifier.settings") as mock_settings:
        mock_settings.resend_api_key = "test-api-key"
        mock_settings.resend_from_email = "noreply@tracely.sh"

        with patch.dict(sys.modules, {"resend": mock_resend}):
            success, error = await send_alert_email(recipients, email_data)

    assert success is True
    assert error is None


@pytest.mark.asyncio
async def test_send_alert_email_no_api_key(email_data):
    """Email fails gracefully when API key not configured."""
    recipients = ["admin@example.com"]

    with patch("app.services.notifications.email_notifier.settings") as mock_settings:
        mock_settings.resend_api_key = ""

        success, error = await send_alert_email(recipients, email_data)

    assert success is False
    assert "not configured" in error.lower()


@pytest.mark.asyncio
async def test_send_alert_email_no_recipients(email_data):
    """Email fails when no recipients provided."""
    with patch("app.services.notifications.email_notifier.settings") as mock_settings:
        mock_settings.resend_api_key = "test-key"

        success, error = await send_alert_email([], email_data)

    assert success is False
    assert "no recipients" in error.lower()


@pytest.mark.asyncio
async def test_send_alert_email_handles_exception(email_data):
    """Email failure is handled gracefully."""
    import sys

    recipients = ["admin@example.com"]

    # Create mock resend module that raises an error
    mock_resend = MagicMock()
    mock_resend.Emails = MagicMock()
    mock_resend.Emails.send = MagicMock(side_effect=Exception("Resend error"))

    with patch("app.services.notifications.email_notifier.settings") as mock_settings:
        mock_settings.resend_api_key = "test-key"
        mock_settings.resend_from_email = "noreply@tracely.sh"

        with patch.dict(sys.modules, {"resend": mock_resend}):
            success, error = await send_alert_email(recipients, email_data)

    assert success is False
    assert "Resend error" in error


# ─── Slack notifier tests ─────────────────────────────────


@pytest.fixture
def slack_data():
    return SlackAlertData(
        alert_name="High Error Rate",
        project_name="My Project",
        severity="critical",
        metric_name="Error Rate",
        metric_value=10.5,
        threshold_value=5.0,
        triggered_at=datetime.now(timezone.utc),
        dashboard_url="https://tracely.sh/my-org/my-project/alerts",
    )


@pytest.mark.asyncio
async def test_send_slack_notification_success(slack_data):
    """Slack notification is sent successfully."""
    webhook_url = "https://hooks.slack.com/services/test"

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = "ok"

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        success, error = await send_slack_notification(webhook_url, slack_data)

    assert success is True
    assert error is None
    mock_client.post.assert_called_once()


@pytest.mark.asyncio
async def test_send_slack_notification_no_webhook(slack_data):
    """Slack fails when webhook URL not provided."""
    success, error = await send_slack_notification("", slack_data)

    assert success is False
    assert "not configured" in error.lower()


@pytest.mark.asyncio
async def test_send_slack_notification_webhook_error(slack_data):
    """Slack handles webhook errors."""
    webhook_url = "https://hooks.slack.com/services/test"

    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_response.text = "channel_not_found"

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        success, error = await send_slack_notification(webhook_url, slack_data)

    assert success is False
    assert "404" in error


@pytest.mark.asyncio
async def test_send_slack_notification_timeout(slack_data):
    """Slack handles timeout gracefully."""
    import httpx

    webhook_url = "https://hooks.slack.com/services/test"

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_client_class.return_value.__aenter__.return_value = mock_client

        success, error = await send_slack_notification(webhook_url, slack_data)

    assert success is False
    assert "timed out" in error.lower()


# ─── Discord notifier tests ─────────────────────────────────


@pytest.fixture
def discord_data():
    return DiscordAlertData(
        alert_name="High Error Rate",
        project_name="My Project",
        severity="critical",
        metric_name="Error Rate",
        metric_value=10.5,
        threshold_value=5.0,
        triggered_at=datetime.now(timezone.utc),
        dashboard_url="https://tracely.sh/my-org/my-project/alerts",
    )


@pytest.mark.asyncio
async def test_send_discord_notification_success(discord_data):
    """Discord notification is sent successfully."""
    webhook_url = "https://discord.com/api/webhooks/test"

    mock_response = MagicMock()
    mock_response.status_code = 204  # Discord returns 204 on success

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        success, error = await send_discord_notification(webhook_url, discord_data)

    assert success is True
    assert error is None
    mock_client.post.assert_called_once()


@pytest.mark.asyncio
async def test_send_discord_notification_no_webhook(discord_data):
    """Discord fails when webhook URL not provided."""
    success, error = await send_discord_notification("", discord_data)

    assert success is False
    assert "not configured" in error.lower()


@pytest.mark.asyncio
async def test_send_discord_notification_webhook_error(discord_data):
    """Discord handles webhook errors."""
    webhook_url = "https://discord.com/api/webhooks/test"

    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_response.text = "Unknown Webhook"

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        success, error = await send_discord_notification(webhook_url, discord_data)

    assert success is False
    assert "404" in error


@pytest.mark.asyncio
async def test_send_discord_notification_timeout(discord_data):
    """Discord handles timeout gracefully."""
    import httpx

    webhook_url = "https://discord.com/api/webhooks/test"

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_client_class.return_value.__aenter__.return_value = mock_client

        success, error = await send_discord_notification(webhook_url, discord_data)

    assert success is False
    assert "timed out" in error.lower()


# ─── Severity color tests ─────────────────────────────────


def test_slack_severity_colors():
    """Slack uses correct severity colors."""
    from app.services.notifications.slack_notifier import SLACK_SEVERITY_COLORS

    assert SLACK_SEVERITY_COLORS["critical"] == "#FF0000"
    assert SLACK_SEVERITY_COLORS["warning"] == "#FFA500"
    assert SLACK_SEVERITY_COLORS["info"] == "#0000FF"


def test_discord_severity_colors():
    """Discord uses correct severity colors."""
    from app.services.notifications.discord_notifier import DISCORD_SEVERITY_COLORS

    assert DISCORD_SEVERITY_COLORS["critical"] == 0xFF0000
    assert DISCORD_SEVERITY_COLORS["warning"] == 0xFFA500
    assert DISCORD_SEVERITY_COLORS["info"] == 0x0000FF


# ─── Message format tests ─────────────────────────────────


def test_slack_message_format(slack_data):
    """Slack message includes all required fields."""
    from app.services.notifications.slack_notifier import _build_slack_message

    message = _build_slack_message(slack_data)

    assert "blocks" in message
    assert "attachments" in message

    # Check header block
    blocks = message["blocks"]
    assert len(blocks) >= 3

    # Header should contain alert name
    header = blocks[0]
    assert header["type"] == "header"
    assert slack_data.alert_name in header["text"]["text"]

    # Should have a button to view dashboard
    actions = next((b for b in blocks if b["type"] == "actions"), None)
    assert actions is not None
    assert actions["elements"][0]["url"] == slack_data.dashboard_url


def test_discord_embed_format(discord_data):
    """Discord embed includes all required fields."""
    from app.services.notifications.discord_notifier import _build_discord_embed

    message = _build_discord_embed(discord_data)

    assert "embeds" in message
    embed = message["embeds"][0]

    assert discord_data.alert_name in embed["title"]
    assert discord_data.project_name in embed["description"]
    assert "color" in embed
    assert embed["url"] == discord_data.dashboard_url
    assert "footer" in embed
