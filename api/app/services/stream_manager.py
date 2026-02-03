from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

logger = logging.getLogger(__name__)

QUEUE_MAX_SIZE = 256


class ConnectionManager:
    """In-process per-project SSE connection manager.

    Maintains a dict of project_id -> set of asyncio.Queue.
    Each connected SSE client gets a bounded queue.
    Broadcasting pushes events into all queues for a project.
    """

    def __init__(self) -> None:
        self._channels: dict[uuid.UUID, set[asyncio.Queue[dict[str, str]]]] = {}

    def connect(self, project_id: uuid.UUID) -> asyncio.Queue[dict[str, str]]:
        """Register a new SSE client for a project. Returns a bounded queue."""
        queue: asyncio.Queue[dict[str, str]] = asyncio.Queue(maxsize=QUEUE_MAX_SIZE)
        if project_id not in self._channels:
            self._channels[project_id] = set()
        self._channels[project_id].add(queue)
        logger.debug(
            "SSE client connected to project %s (total: %d)",
            project_id,
            len(self._channels[project_id]),
        )
        return queue

    def disconnect(self, project_id: uuid.UUID, queue: asyncio.Queue[dict[str, str]]) -> None:
        """Unregister an SSE client. Cleans up empty channels."""
        channel = self._channels.get(project_id)
        if channel is None:
            return
        channel.discard(queue)
        if not channel:
            del self._channels[project_id]
            logger.debug("SSE channel removed for project %s (no clients)", project_id)
        else:
            logger.debug(
                "SSE client disconnected from project %s (remaining: %d)",
                project_id,
                len(channel),
            )

    def broadcast(self, project_id: uuid.UUID, event: dict[str, str]) -> None:
        """Push event to all connected clients for a project.

        Non-blocking: drops event silently if a client's queue is full.
        """
        channel = self._channels.get(project_id)
        if not channel:
            return
        for queue in channel:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(
                    "SSE queue full for project %s — dropping event",
                    project_id,
                )

    def connection_count(self, project_id: uuid.UUID) -> int:
        """Return the number of connected clients for a project."""
        channel = self._channels.get(project_id)
        return len(channel) if channel else 0


# Module-level singleton
connection_manager = ConnectionManager()
