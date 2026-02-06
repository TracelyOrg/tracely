from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


AlertCategory = Literal["availability", "performance", "volume"]
ComparisonOperator = Literal["gt", "lt", "eq", "gte", "lte", "pct_increase", "pct_decrease"]
MetricType = Literal["error_rate", "request_count", "p95_latency"]


class AlertTemplateOut(BaseModel):
    """Response schema for an alert template with user's activation status."""
    key: str
    name: str
    category: AlertCategory
    description: str
    default_threshold: float
    default_duration: int
    comparison: ComparisonOperator
    metric: MetricType
    is_active: bool = False
    custom_threshold: float | None = None
    custom_duration: int | None = None
    rule_id: uuid.UUID | None = None  # Database ID when rule exists

    model_config = {"from_attributes": True}


class AlertTemplatesResponse(BaseModel):
    """Response schema for the templates endpoint."""
    templates: list[AlertTemplateOut]


class AlertRuleOut(BaseModel):
    """Response schema for an alert rule from the database."""
    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID
    preset_key: str
    name: str
    category: str
    description: str | None
    threshold_value: float
    duration_seconds: int
    comparison_operator: str
    is_active: bool
    is_custom: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AlertRuleCreate(BaseModel):
    """Schema for creating/activating an alert rule."""
    preset_key: str = Field(..., min_length=1, max_length=50)
    threshold_value: float | None = None  # Use preset default if not provided
    duration_seconds: int | None = None   # Use preset default if not provided
    is_active: bool = True


class AlertRuleUpdate(BaseModel):
    """Schema for updating an alert rule."""
    threshold_value: float | None = None
    duration_seconds: int | None = None
    is_active: bool | None = None


class AlertToggleRequest(BaseModel):
    """Schema for toggling an alert on/off."""
    preset_key: str = Field(..., min_length=1, max_length=50)


# Alert Event (History) schemas
AlertEventStatus = Literal["active", "resolved", "acknowledged"]


class AlertEventOut(BaseModel):
    """Response schema for an alert event from the database."""
    id: uuid.UUID
    rule_id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID
    triggered_at: datetime
    resolved_at: datetime | None
    metric_value: float
    threshold_value: float
    status: AlertEventStatus
    notification_sent: bool
    rule_snapshot: dict | None = None
    # Joined from alert_rules
    rule_name: str
    rule_category: AlertCategory
    rule_preset_key: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AlertHistoryResponse(BaseModel):
    """Response schema for the alert history endpoint."""
    events: list[AlertEventOut]
    total: int
    offset: int
    limit: int


class AlertHistoryFilters(BaseModel):
    """Query parameters for filtering alert history."""
    status: AlertEventStatus | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class BulkToggleRequest(BaseModel):
    """Schema for bulk toggling alerts on/off."""
    preset_keys: list[str] = Field(..., min_length=1)
    is_active: bool
