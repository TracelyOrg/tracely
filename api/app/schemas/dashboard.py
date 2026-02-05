from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class HealthStatus(str, Enum):
    """Health status for a service."""
    healthy = "healthy"
    degraded = "degraded"
    error = "error"


class ServiceHealth(BaseModel):
    """Health metrics for a single service."""
    name: str = Field(..., description="Service name")
    status: HealthStatus = Field(..., description="Health status: healthy, degraded, or error")
    request_rate: float = Field(..., description="Requests per minute")
    error_rate: float = Field(..., description="Error rate as percentage (0-100)")
    p95_latency: float = Field(..., description="95th percentile latency in milliseconds")


class HealthResponse(BaseModel):
    """Response schema for health endpoint."""
    services: list[ServiceHealth] = Field(default_factory=list, description="List of service health data")


# --- Live Dashboard Schemas (Story 4.2) ---


class DataPoint(BaseModel):
    """A single data point for time series."""
    timestamp: datetime = Field(..., description="Timestamp of the data point")
    value: float = Field(..., description="Value at this timestamp")


class ServiceStatus(BaseModel):
    """Service status for live dashboard."""
    name: str = Field(..., description="Service name")
    status: HealthStatus = Field(..., description="Health status")
    request_rate: float = Field(..., description="Requests per minute")
    error_rate: float = Field(..., description="Error rate percentage")
    p95_latency: float = Field(..., description="P95 latency in ms")


class LiveDashboardResponse(BaseModel):
    """Response schema for live dashboard endpoint (Story 4.2)."""
    requests_per_minute: list[DataPoint] = Field(
        default_factory=list,
        description="Time series of requests per minute for sparkline (last 15 minutes)"
    )
    error_rate: float = Field(0.0, description="Current error rate percentage")
    p95_latency: float = Field(0.0, description="Current P95 latency in milliseconds")
    services: list[ServiceStatus] = Field(
        default_factory=list,
        description="List of service status indicators"
    )
