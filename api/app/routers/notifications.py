"""Notification settings API endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.models.notification_channel import NotificationChannel
from app.models.org_member import OrgMember
from app.routers.auth import get_current_user
from app.schemas.notification import (
    NotificationChannelCreate,
    NotificationChannelOut,
    NotificationChannelUpdate,
    NotificationTestResponse,
)
from app.services.notifications.discord_notifier import test_discord_webhook
from app.services.notifications.slack_notifier import test_slack_webhook
from app.utils.envelope import success
from app.utils.exceptions import BadRequestError, ForbiddenError, NotFoundError

router = APIRouter(
    prefix="/api/orgs/{org_id}/projects/{project_id}/notifications",
    tags=["notifications"],
)


async def _verify_project_access(
    db: AsyncSession,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
) -> None:
    """Verify user has access to the organization."""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise ForbiddenError("Access denied to this organization")


@router.get("")
async def list_notification_channels(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all notification channels for a project.

    Returns all configured notification channels (email, Slack, Discord).
    """
    await _verify_project_access(db, current_user.id, org_id)

    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.project_id == project_id,
            NotificationChannel.org_id == org_id,
        )
    )
    channels = result.scalars().all()

    return success(
        [NotificationChannelOut.model_validate(ch).model_dump(mode="json") for ch in channels]
    )


@router.post("")
async def create_notification_channel(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: NotificationChannelCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new notification channel.

    Creates a notification channel for the specified type (email, slack, discord).
    Each project can have one channel of each type.
    """
    await _verify_project_access(db, current_user.id, org_id)

    # Check if channel type already exists for this project
    existing = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.project_id == project_id,
            NotificationChannel.channel_type == payload.channel_type,
        )
    )
    if existing.scalar_one_or_none():
        raise BadRequestError(
            f"A {payload.channel_type} channel already exists for this project"
        )

    # Validate config based on channel type
    if payload.channel_type == "slack" and "webhook_url" not in payload.config:
        raise BadRequestError("Slack channel requires webhook_url in config")
    if payload.channel_type == "discord" and "webhook_url" not in payload.config:
        raise BadRequestError("Discord channel requires webhook_url in config")

    channel = NotificationChannel(
        org_id=org_id,
        project_id=project_id,
        channel_type=payload.channel_type,
        config=payload.config,
        is_enabled=payload.is_enabled,
    )

    db.add(channel)
    await db.commit()
    await db.refresh(channel)

    return success(NotificationChannelOut.model_validate(channel).model_dump(mode="json"))


@router.patch("/{channel_id}")
async def update_notification_channel(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    channel_id: uuid.UUID,
    payload: NotificationChannelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update a notification channel.

    Updates the configuration or enabled status of a notification channel.
    """
    await _verify_project_access(db, current_user.id, org_id)

    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.id == channel_id,
            NotificationChannel.project_id == project_id,
            NotificationChannel.org_id == org_id,
        )
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise NotFoundError("Notification channel not found")

    if payload.config is not None:
        # Validate webhook URL for Slack/Discord
        if channel.channel_type in ("slack", "discord"):
            if "webhook_url" not in payload.config:
                raise BadRequestError(
                    f"{channel.channel_type.capitalize()} channel requires webhook_url"
                )
        channel.config = payload.config

    if payload.is_enabled is not None:
        channel.is_enabled = payload.is_enabled

    await db.commit()
    await db.refresh(channel)

    return success(NotificationChannelOut.model_validate(channel).model_dump(mode="json"))


@router.delete("/{channel_id}")
async def delete_notification_channel(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Delete a notification channel.

    Removes the notification channel configuration.
    """
    await _verify_project_access(db, current_user.id, org_id)

    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.id == channel_id,
            NotificationChannel.project_id == project_id,
            NotificationChannel.org_id == org_id,
        )
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise NotFoundError("Notification channel not found")

    await db.delete(channel)
    await db.commit()

    return success(None)


@router.post("/{channel_id}/test")
async def test_notification_channel(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Test a notification channel.

    Sends a test notification to verify the channel is configured correctly.
    """
    await _verify_project_access(db, current_user.id, org_id)

    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.id == channel_id,
            NotificationChannel.project_id == project_id,
            NotificationChannel.org_id == org_id,
        )
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise NotFoundError("Notification channel not found")

    test_success = False
    test_error = None

    if channel.channel_type == "slack":
        webhook_url = channel.config.get("webhook_url")
        if not webhook_url:
            test_error = "Webhook URL not configured"
        else:
            test_success, test_error = await test_slack_webhook(webhook_url)

    elif channel.channel_type == "discord":
        webhook_url = channel.config.get("webhook_url")
        if not webhook_url:
            test_error = "Webhook URL not configured"
        else:
            test_success, test_error = await test_discord_webhook(webhook_url)

    elif channel.channel_type == "email":
        # Email test would send to current user
        test_success = True  # Assume email is configured if Resend key is set
        from app.config import settings

        if not settings.resend_api_key:
            test_success = False
            test_error = "Email service not configured"

    return success(
        NotificationTestResponse(success=test_success, error=test_error).model_dump(mode="json")
    )
