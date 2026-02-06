from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_org
from app.schemas.dashboard import DashboardMetricsResponse, HealthResponse, LiveDashboardResponse
from app.services import dashboard_service, project_service
from app.utils.envelope import success

router = APIRouter(
    prefix="/api/orgs/{org_slug}/projects/{project_slug}",
    tags=["dashboard"],
)


@router.get("/health")
async def get_project_health(
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get health overview for all services in a project.

    Returns aggregated health metrics per service including:
    - Health status (healthy/degraded/error)
    - Request rate (requests/min)
    - Error rate (percentage)
    - P95 latency (ms)

    Data is cached in Redis with 20s TTL and aggregated from
    ClickHouse metrics_1m materialized view over the last 5 minutes.

    Multi-tenant isolation enforced via org_id scoping.
    """
    # Get project by slug to get the UUID
    project = await project_service.get_project_by_slug(db, org_id, project_slug)

    # Fetch health data
    health = await dashboard_service.get_project_health(org_id, project.id)

    return success(health.model_dump(mode="json"))


@router.get("/dashboard/live")
async def get_live_dashboard(
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get live dashboard metrics for a project (Story 4.2).

    Returns real-time metrics for the live dashboard view:
    - requests_per_minute: Time series for sparkline (last 15 minutes, 1-min granularity)
    - error_rate: Current error rate percentage
    - p95_latency: Current P95 latency in milliseconds
    - services: List of service status indicators

    Data is cached in Redis with 5s TTL. Sparkline data comes from
    ClickHouse metrics_1m view, current aggregates from Redis cache.

    Multi-tenant isolation enforced via org_id scoping.
    """
    # Get project by slug to get the UUID
    project = await project_service.get_project_by_slug(db, org_id, project_slug)

    # Fetch live dashboard data
    live_data = await dashboard_service.get_live_dashboard(org_id, project.id)

    return success(live_data.model_dump(mode="json"))


@router.get("/dashboard/metrics")
async def get_dashboard_metrics(
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    time: str = Query("15m", description="Time preset: 5m, 15m, 1h, 6h, 24h, or custom"),
    start: str | None = Query(None, description="Custom range start (ISO 8601)"),
    end: str | None = Query(None, description="Custom range end (ISO 8601)"),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get comprehensive dashboard metrics for bento grid layout.

    Returns all metrics needed for the enhanced dashboard view:
    - Time series: requests/minute, errors/minute
    - Summary: total requests, errors, error rate, percentiles
    - Distributions: status codes, latency histogram
    - Top endpoints by request count
    - Service health status

    Supports timeframe selection via query parameters:
    - time: Preset (5m, 15m, 1h, 6h, 24h) or "custom"
    - start, end: ISO 8601 strings (only when time=custom)

    Data is cached in Redis with 10s TTL. Aggregated from ClickHouse
    metrics_1m view and spans table.

    Multi-tenant isolation enforced via org_id scoping.
    """
    # Get project by slug to get the UUID
    project = await project_service.get_project_by_slug(db, org_id, project_slug)

    # Fetch dashboard metrics with timeframe
    metrics = await dashboard_service.get_dashboard_metrics(
        org_id, project.id, preset=time, start=start, end=end
    )

    return success(metrics.model_dump(mode="json"))
