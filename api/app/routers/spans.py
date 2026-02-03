from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_org
from app.models.project import Project
from app.services import span_service
from app.utils.envelope import success
from app.utils.exceptions import NotFoundError

router = APIRouter(
    prefix="/api/orgs/{org_slug}/projects/{project_slug}/spans",
    tags=["spans"],
)


@router.get("")
async def list_spans(
    project_slug: str = Path(...),
    org_id: uuid.UUID = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
    before: datetime | None = Query(default=None, description="Cursor: return spans before this ISO timestamp"),
    limit: int = Query(default=50, ge=1, le=200, description="Max rows to return"),
) -> dict:
    """List historical spans for a project with cursor-based pagination.

    Used by the Pulse View reverse infinite scroll to load older requests.
    Returns spans ordered newest-first (DESC). The frontend reverses them
    for chronological prepend.
    """
    # Resolve project slug → UUID
    result = await db.execute(
        select(Project).where(
            Project.org_id == org_id,
            Project.slug == project_slug,
            Project.is_active == True,  # noqa: E712
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise NotFoundError("Project not found")

    spans = await span_service.get_span_history(
        org_id=org_id,
        project_id=project.id,
        before=before,
        limit=limit,
    )

    return success(
        [s.model_dump(mode="json") for s in spans],
        meta={
            "has_more": len(spans) == limit,
            "oldest_timestamp": spans[-1].start_time if spans else None,
        },
    )


@router.get("/{span_id}")
async def get_span_detail(
    project_slug: str = Path(...),
    span_id: str = Path(..., description="The span_id to retrieve"),
    org_id: uuid.UUID = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fetch full detail for a single span.

    Used by the Span Inspector panel to display request/response bodies,
    headers, attributes, and error information.
    """
    # Resolve project slug → UUID
    result = await db.execute(
        select(Project).where(
            Project.org_id == org_id,
            Project.slug == project_slug,
            Project.is_active == True,  # noqa: E712
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise NotFoundError("Project not found")

    span = await span_service.get_span_by_id(
        org_id=org_id,
        project_id=project.id,
        span_id=span_id,
    )
    if span is None:
        raise NotFoundError("Span not found")

    return success(span.model_dump(mode="json"))
