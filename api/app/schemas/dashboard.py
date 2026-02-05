from __future__ import annotations

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
