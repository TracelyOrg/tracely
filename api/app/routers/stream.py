from __future__ import annotations

import asyncio
import logging
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
from app.services.stream_manager import connection_manager
from app.utils.exceptions import ForbiddenError, NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["stream"])

HEARTBEAT_INTERVAL_S = 15


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


async def _event_generator(
    project_id: uuid.UUID,
    queue: asyncio.Queue[dict[str, str]],
) -> AsyncGenerator[dict[str, str], None]:
    """Yield span events from the connection queue and heartbeats on a timer.

    Merges two sources:
    - Span events pushed into the queue by the ConnectionManager
    - Heartbeat events every HEARTBEAT_INTERVAL_S seconds

    On generator close (client disconnect), the queue is unregistered.
    """
    try:
        while True:
            try:
                event = await asyncio.wait_for(
                    queue.get(), timeout=HEARTBEAT_INTERVAL_S
                )
                yield event
            except asyncio.TimeoutError:
                yield {
                    "event": "heartbeat",
                    "data": f'{{"timestamp":"{datetime.now(timezone.utc).isoformat()}"}}',
                }
    finally:
        connection_manager.disconnect(project_id, queue)
        logger.debug("SSE client disconnected from project %s", project_id)


@router.get("/api/stream/{project_id}")
async def stream_events(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventSourceResponse:
    """SSE endpoint for real-time project event streaming.

    Authenticates via cookie (dashboard user) and verifies
    the user has access to the project's organization.
    Streams span events in real-time and heartbeats every 15s.
    """
    await _verify_project_access(project_id, current_user, db)

    queue = connection_manager.connect(project_id)

    return EventSourceResponse(
        _event_generator(project_id, queue),
        media_type="text/event-stream",
    )
