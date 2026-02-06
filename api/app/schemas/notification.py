"""Pydantic schemas for notification settings."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class NotificationChannelBase(BaseModel):
    """Base schema for notification channel."""

    channel_type: str = Field(..., description="Channel type: email, slack, discord")
    config: dict[str, Any] = Field(default_factory=dict, description="Channel configuration")
    is_enabled: bool = Field(default=True, description="Whether the channel is enabled")

    @field_validator("channel_type")
    @classmethod
    def validate_channel_type(cls, v: str) -> str:
        allowed = {"email", "slack", "discord"}
        if v not in allowed:
            raise ValueError(f"channel_type must be one of: {allowed}")
        return v


class NotificationChannelCreate(NotificationChannelBase):
    """Schema for creating a notification channel."""

    pass


class NotificationChannelUpdate(BaseModel):
    """Schema for updating a notification channel."""

    config: dict[str, Any] | None = None
    is_enabled: bool | None = None


class NotificationChannelOut(NotificationChannelBase):
    """Schema for notification channel response."""

    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationTestRequest(BaseModel):
    """Schema for testing a notification channel."""

    pass  # No body needed, uses existing channel config


class NotificationTestResponse(BaseModel):
    """Schema for notification test result."""

    success: bool
    error: str | None = None


class SlackConfigSchema(BaseModel):
    """Schema for Slack channel configuration."""

    webhook_url: str = Field(..., description="Slack incoming webhook URL")

    @field_validator("webhook_url")
    @classmethod
    def validate_webhook_url(cls, v: str) -> str:
        if not v.startswith("https://hooks.slack.com/"):
            raise ValueError("Invalid Slack webhook URL format")
        return v


class DiscordConfigSchema(BaseModel):
    """Schema for Discord channel configuration."""

    webhook_url: str = Field(..., description="Discord webhook URL")

    @field_validator("webhook_url")
    @classmethod
    def validate_webhook_url(cls, v: str) -> str:
        if not v.startswith("https://discord.com/api/webhooks/"):
            raise ValueError("Invalid Discord webhook URL format")
        return v


class EmailConfigSchema(BaseModel):
    """Schema for email channel configuration."""

    # Email uses org admins by default, but can have additional recipients
    additional_recipients: list[str] = Field(
        default_factory=list,
        description="Additional email recipients beyond org admins",
    )
