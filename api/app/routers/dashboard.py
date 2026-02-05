from __future__ import annotations

from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_org
from app.schemas.dashboard import HealthResponse
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
