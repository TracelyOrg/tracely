from __future__ import annotations

import asyncio
import uuid

import pytest

from app.services.stream_manager import connection_manager


@pytest.fixture(autouse=True)
def _clear_channels():
    """Ensure connection manager is clean before/after each test."""
    connection_manager._channels.clear()
    yield
    connection_manager._channels.clear()


# ── connect / disconnect ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_connect_returns_queue():
    """connect() returns an asyncio.Queue registered in the project channel."""
    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    assert isinstance(queue, asyncio.Queue)
    assert project_id in connection_manager._channels
    assert queue in connection_manager._channels[project_id]


@pytest.mark.asyncio
async def test_connect_multiple_clients_same_project():
    """Multiple clients connect to the same project channel."""
    project_id = uuid.uuid4()
    q1 = connection_manager.connect(project_id)
    q2 = connection_manager.connect(project_id)

    assert q1 is not q2
    assert len(connection_manager._channels[project_id]) == 2


@pytest.mark.asyncio
async def test_connect_different_projects():
    """Connections to different projects are independent channels."""
    pid1 = uuid.uuid4()
    pid2 = uuid.uuid4()
    q1 = connection_manager.connect(pid1)
    q2 = connection_manager.connect(pid2)

    assert pid1 in connection_manager._channels
    assert pid2 in connection_manager._channels
    assert q1 in connection_manager._channels[pid1]
    assert q2 in connection_manager._channels[pid2]


@pytest.mark.asyncio
async def test_disconnect_removes_queue():
    """disconnect() removes queue from channel."""
    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    connection_manager.disconnect(project_id, queue)

    assert queue not in connection_manager._channels.get(project_id, set())


@pytest.mark.asyncio
async def test_disconnect_cleans_up_empty_channel():
    """disconnect() removes the channel entirely when last client leaves."""
    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    connection_manager.disconnect(project_id, queue)

    assert project_id not in connection_manager._channels


@pytest.mark.asyncio
async def test_disconnect_keeps_channel_with_remaining_clients():
    """disconnect() keeps channel when other clients remain."""
    project_id = uuid.uuid4()
    q1 = connection_manager.connect(project_id)
    q2 = connection_manager.connect(project_id)

    connection_manager.disconnect(project_id, q1)

    assert project_id in connection_manager._channels
    assert q2 in connection_manager._channels[project_id]
    assert len(connection_manager._channels[project_id]) == 1


@pytest.mark.asyncio
async def test_disconnect_nonexistent_project_no_error():
    """disconnect() with unknown project_id does not raise."""
    connection_manager.disconnect(uuid.uuid4(), asyncio.Queue())


@pytest.mark.asyncio
async def test_disconnect_nonexistent_queue_no_error():
    """disconnect() with unknown queue does not raise."""
    project_id = uuid.uuid4()
    connection_manager.connect(project_id)
    connection_manager.disconnect(project_id, asyncio.Queue())


# ── broadcast ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_broadcast_delivers_to_single_client():
    """broadcast() delivers event to a connected client's queue."""
    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    event = {"event": "span", "data": '{"trace_id":"abc"}'}
    connection_manager.broadcast(project_id, event)

    result = queue.get_nowait()
    assert result == event


@pytest.mark.asyncio
async def test_broadcast_delivers_to_all_clients():
    """broadcast() delivers event to ALL connected clients on the project."""
    project_id = uuid.uuid4()
    q1 = connection_manager.connect(project_id)
    q2 = connection_manager.connect(project_id)
    q3 = connection_manager.connect(project_id)

    event = {"event": "span", "data": '{"trace_id":"abc"}'}
    connection_manager.broadcast(project_id, event)

    assert q1.get_nowait() == event
    assert q2.get_nowait() == event
    assert q3.get_nowait() == event


@pytest.mark.asyncio
async def test_broadcast_does_not_cross_projects():
    """broadcast() to project A does not affect project B clients."""
    pid_a = uuid.uuid4()
    pid_b = uuid.uuid4()
    qa = connection_manager.connect(pid_a)
    qb = connection_manager.connect(pid_b)

    event = {"event": "span", "data": '{"trace_id":"abc"}'}
    connection_manager.broadcast(pid_a, event)

    assert qa.get_nowait() == event
    assert qb.empty()


@pytest.mark.asyncio
async def test_broadcast_no_listeners_no_error():
    """broadcast() with no connected clients does not raise."""
    connection_manager.broadcast(uuid.uuid4(), {"event": "span", "data": "{}"})


@pytest.mark.asyncio
async def test_broadcast_drops_event_when_queue_full():
    """broadcast() drops event silently when queue is full (bounded memory)."""
    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    # Fill the queue to capacity
    for i in range(queue.maxsize):
        connection_manager.broadcast(project_id, {"event": "span", "data": f'{{"n":{i}}}'})

    # This broadcast should be dropped, not block
    connection_manager.broadcast(project_id, {"event": "span", "data": '{"n":"overflow"}'})

    assert queue.full()
    # First item should be the original first item (not the overflow)
    first = queue.get_nowait()
    assert '"n":0' in first["data"] or '"n": 0' in first["data"]


# ── bounded queue ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_queue_is_bounded():
    """Connected queue has a maxsize to bound memory (AC4)."""
    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    assert queue.maxsize > 0


# ── connection_count ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_connection_count_empty():
    """connection_count returns 0 for unknown project."""
    assert connection_manager.connection_count(uuid.uuid4()) == 0


@pytest.mark.asyncio
async def test_connection_count_tracks_connections():
    """connection_count returns correct number of connected clients."""
    project_id = uuid.uuid4()
    q1 = connection_manager.connect(project_id)
    assert connection_manager.connection_count(project_id) == 1

    q2 = connection_manager.connect(project_id)
    assert connection_manager.connection_count(project_id) == 2

    connection_manager.disconnect(project_id, q1)
    assert connection_manager.connection_count(project_id) == 1

    connection_manager.disconnect(project_id, q2)
    assert connection_manager.connection_count(project_id) == 0
