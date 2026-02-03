from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.db.postgres import get_db
from app.dependencies import get_current_user
from app.models.org_member import OrgMember
from app.models.project import Project
from app.models.user import User
from app.utils.exceptions import ForbiddenError, NotFoundError

router = APIRouter(tags=["stream"])

HEARTBEAT_INTERVAL_S = 30


async def _verify_project_access(
    project_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> Project:
    """Verify the project exists and the user has access via org membership."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.is_active == True,  # noqa: E712
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise NotFoundError("Project not found")

    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == project.org_id,
            OrgMember.user_id == user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise ForbiddenError("Not a member of the project's organization")

    return project


async def _heartbeat_generator(
    project_id: uuid.UUID,
) -> AsyncGenerator[dict[str, str], None]:
    """Generate heartbeat events every 30s.

    NOTE: This is a stub for Story 1.6. Full span broadcasting
    will be implemented in Epic 2 (Story 2.8).
    """
    while True:
        yield {
            "event": "heartbeat",
            "data": f'{{"timestamp":"{datetime.now(timezone.utc).isoformat()}"}}',
        }
        await asyncio.sleep(HEARTBEAT_INTERVAL_S)


@router.get("/api/stream/{project_id}")
async def stream_events(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventSourceResponse:
    """SSE endpoint for real-time project event streaming.

    Authenticates via cookie (dashboard user) and verifies
    the user has access to the project's organization.
    Currently sends heartbeats only — span broadcasting
    is implemented in Epic 2 Story 2.8.
    """
    await _verify_project_access(project_id, current_user, db)

    return EventSourceResponse(
        _heartbeat_generator(project_id),
        media_type="text/event-stream",
    )
