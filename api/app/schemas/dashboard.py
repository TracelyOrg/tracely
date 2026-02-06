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


# --- Enhanced Dashboard Schemas (Bento Grid) ---


class StatusCodeStats(BaseModel):
    """Status code category statistics."""
    code: str = Field(..., description="Status code category: 2xx, 3xx, 4xx, 5xx")
    count: int = Field(0, description="Number of requests in this category")


class EndpointStats(BaseModel):
    """Statistics for a single endpoint."""
    route: str = Field(..., description="HTTP route pattern")
    method: str = Field(..., description="HTTP method (GET, POST, etc.)")
    count: int = Field(0, description="Total request count")
    avg_latency: float = Field(0.0, description="Average latency in ms")
    error_rate: float = Field(0.0, description="Error rate percentage")


class LatencyBucket(BaseModel):
    """Latency distribution bucket."""
    range: str = Field(..., description="Range description (e.g., '0-50ms')")
    label: str = Field(..., description="Short label for chart (e.g., '<50')")
    count: int = Field(0, description="Number of requests in this bucket")


class DashboardMetricsResponse(BaseModel):
    """Enhanced dashboard metrics response for bento grid layout."""
    # Time series data
    requests_per_minute: list[DataPoint] = Field(
        default_factory=list,
        description="Time series of requests per minute"
    )
    errors_per_minute: list[DataPoint] = Field(
        default_factory=list,
        description="Time series of errors per minute"
    )

    # Summary metrics
    total_requests: int = Field(0, description="Total requests in time range")
    total_errors: int = Field(0, description="Total errors in time range")
    error_rate: float = Field(0.0, description="Error rate percentage")
    p50_latency: float = Field(0.0, description="P50 latency in ms")
    p95_latency: float = Field(0.0, description="P95 latency in ms")
    p99_latency: float = Field(0.0, description="P99 latency in ms")
    avg_latency: float = Field(0.0, description="Average latency in ms")

    # Distributions
    status_codes: list[StatusCodeStats] = Field(
        default_factory=list,
        description="Status code distribution"
    )
    top_endpoints: list[EndpointStats] = Field(
        default_factory=list,
        description="Top endpoints by request count"
    )
    latency_distribution: list[LatencyBucket] = Field(
        default_factory=list,
        description="Latency distribution histogram"
    )

    # Service health
    services: list[ServiceStatus] = Field(
        default_factory=list,
        description="Service status indicators"
    )
