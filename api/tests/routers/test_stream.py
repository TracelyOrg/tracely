from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.org_member import OrgMember
from app.models.project import Project
from app.models.user import User
from app.services.stream_manager import connection_manager


@pytest.fixture
def mock_user():
    """Create a mock user for stream tests."""
    user = User(
        id=uuid.uuid4(),
        email="stream@example.com",
        password_hash="$2b$12$hashed",
        full_name=None,
        is_active=True,
        onboarding_completed=False,
        email_verified=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    return user


@pytest.fixture
def mock_project():
    """Create a mock project."""
    project = Project(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        name="Test Project",
        slug="test-project",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    return project


@pytest.fixture
def mock_org_member(mock_user, mock_project):
    """Create a mock org membership."""
    member = OrgMember(
        id=uuid.uuid4(),
        org_id=mock_project.org_id,
        user_id=mock_user.id,
        role="admin",
        created_at=datetime.now(timezone.utc),
    )
    return member


@pytest.fixture(autouse=True)
def _clear_state():
    """Ensure connection manager and dependency overrides are clean."""
    from app.main import app

    connection_manager._channels.clear()
    app.dependency_overrides.clear()
    yield
    connection_manager._channels.clear()
    app.dependency_overrides.clear()


def _make_result(value):
    """Helper to create a mock SQLAlchemy result."""
    return MagicMock(scalar_one_or_none=MagicMock(return_value=value))


# ─── SSE Stream Endpoint tests ──────────────────────────────────────


def test_stream_unauthenticated(client):
    """Test SSE stream returns 401 without authentication (AC1)."""
    project_id = uuid.uuid4()
    response = client.get(f"/api/stream/{project_id}")

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"


def test_stream_authenticated_project_not_found(client, mock_user):
    """Test SSE stream returns 404 for non-existent project."""
    from app.db.postgres import get_db
    from app.dependencies import get_current_user
    from app.main import app

    project_id = uuid.uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_make_result(None))

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.get(f"/api/stream/{project_id}")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"


def test_stream_multi_tenant_forbidden(client, mock_user, mock_project):
    """Test user cannot connect to stream for project they don't own (AC1)."""
    from app.db.postgres import get_db
    from app.dependencies import get_current_user
    from app.main import app

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            _make_result(mock_project),  # Project found
            _make_result(None),  # OrgMember NOT found
        ]
    )

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.get(f"/api/stream/{mock_project.id}")

    app.dependency_overrides.clear()

    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "FORBIDDEN"


def test_stream_authenticated_with_access(client, mock_user, mock_project, mock_org_member):
    """Test SSE stream returns 200 with text/event-stream for authorized user (AC1)."""
    from app.db.postgres import get_db
    from app.dependencies import get_current_user
    from app.main import app

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            _make_result(mock_project),  # Project found
            _make_result(mock_org_member),  # OrgMember found
        ]
    )

    async def _finite_generator(project_id, queue):
        yield {
            "event": "heartbeat",
            "data": '{"timestamp":"2025-01-01T00:00:00+00:00"}',
        }

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    with patch("app.routers.stream._event_generator", _finite_generator):
        response = client.get(f"/api/stream/{mock_project.id}")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_stream_registers_connection(mock_user, mock_project, mock_org_member):
    """Test SSE endpoint registers a connection in ConnectionManager (AC1)."""
    from app.routers.stream import stream_events

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            _make_result(mock_project),
            _make_result(mock_org_member),
        ]
    )

    response = await stream_events(
        project_id=mock_project.id,
        current_user=mock_user,
        db=mock_db,
    )

    # The endpoint returns an EventSourceResponse with a connected queue
    assert connection_manager.connection_count(mock_project.id) == 1


# ─── Event Generator tests ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_event_generator_yields_span_events():
    """Event generator yields span events from queue (AC2)."""
    from app.routers.stream import _event_generator

    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    span_event = {"event": "span", "data": '{"trace_id":"abc123"}'}
    queue.put_nowait(span_event)

    gen = _event_generator(project_id, queue)
    event = await gen.__anext__()

    assert event == span_event
    assert event["event"] == "span"

    await gen.aclose()


@pytest.mark.asyncio
async def test_event_generator_yields_heartbeat_on_timeout():
    """Event generator yields heartbeat when no span events arrive (AC1)."""
    from app.routers.stream import _event_generator

    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    gen = _event_generator(project_id, queue)

    # Patch the heartbeat interval to avoid waiting 15s in tests
    with patch("app.routers.stream.HEARTBEAT_INTERVAL_S", 0.05):
        gen2 = _event_generator(project_id, queue)
        event = await gen2.__anext__()

    assert event["event"] == "heartbeat"
    data = json.loads(event["data"])
    assert "timestamp" in data

    await gen.aclose()
    await gen2.aclose()


@pytest.mark.asyncio
async def test_event_generator_disconnects_on_close():
    """Event generator calls disconnect on cleanup (AC3)."""
    from app.routers.stream import _event_generator

    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    assert connection_manager.connection_count(project_id) == 1

    gen = _event_generator(project_id, queue)
    queue.put_nowait({"event": "span", "data": "{}"})
    await gen.__anext__()
    await gen.aclose()

    assert connection_manager.connection_count(project_id) == 0


@pytest.mark.asyncio
async def test_heartbeat_interval_is_15s():
    """Heartbeat interval constant is 15 seconds per AC1."""
    from app.routers.stream import HEARTBEAT_INTERVAL_S

    assert HEARTBEAT_INTERVAL_S == 15


@pytest.mark.asyncio
async def test_heartbeat_data_format():
    """Heartbeat event contains valid JSON with ISO timestamp."""
    from app.routers.stream import _event_generator

    project_id = uuid.uuid4()
    queue = connection_manager.connect(project_id)

    with patch("app.routers.stream.HEARTBEAT_INTERVAL_S", 0.01):
        gen = _event_generator(project_id, queue)
        event = await gen.__anext__()

    data = json.loads(event["data"])
    assert "timestamp" in data
    datetime.fromisoformat(data["timestamp"])

    await gen.aclose()


# ─── Onboarding Complete Endpoint tests ──────────────────────────────


def test_onboarding_complete_unauthenticated(client):
    """Test onboarding-complete returns 401 without auth."""
    response = client.post("/api/auth/onboarding-complete")
    assert response.status_code == 401


def test_onboarding_complete_authenticated(client, mock_user):
    """Test onboarding-complete marks user as completed."""
    from app.db.postgres import get_db
    from app.dependencies import get_current_user
    from app.main import app

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.post("/api/auth/onboarding-complete")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
