from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User


@pytest.fixture
def mock_user():
    return User(
        id=uuid.uuid4(),
        email="admin@example.com",
        password_hash="$2b$12$hashed",
        full_name=None,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def mock_member_user():
    """Non-admin user for RBAC tests."""
    return User(
        id=uuid.uuid4(),
        email="member@example.com",
        password_hash="$2b$12$hashed",
        full_name=None,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def sample_org():
    return Organization(
        id=uuid.uuid4(),
        name="Acme Corp",
        slug="acme-corp",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def sample_project(sample_org):
    return Project(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        name="My API",
        slug="my-api",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def admin_member(sample_org, mock_user):
    return OrgMember(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        user_id=mock_user.id,
        role="admin",
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def member_member(sample_org, mock_member_user):
    return OrgMember(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        user_id=mock_member_user.id,
        role="member",
        created_at=datetime.now(timezone.utc),
    )


def _override_full(app, user, org, member):
    """Override auth and provide mock db for require_role + get_current_org."""
    from app.dependencies import get_current_org, get_current_user

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_org] = lambda: org.id

    mock_db = AsyncMock()

    def _make_result(value):
        return MagicMock(scalar_one_or_none=MagicMock(return_value=value))

    # require_role does: 1) select org by slug, 2) select member by org_id+user_id
    mock_db.execute = AsyncMock(
        side_effect=[
            _make_result(org),
            _make_result(member),
        ]
    )

    from app.db.postgres import get_db

    app.dependency_overrides[get_db] = lambda: mock_db
    return mock_db


def _clear(app):
    app.dependency_overrides.clear()


# ─── POST /api/orgs/{org_slug}/projects — create project (AC #1) ────


def test_create_project_admin_success(
    client, mock_user, sample_org, sample_project, admin_member
):
    """AC#1: Admin creates project → 201 with slug."""
    from app.main import app

    _override_full(app, mock_user, sample_org, admin_member)

    with patch("app.routers.projects.project_service") as mock_svc:
        mock_svc.create_project = AsyncMock(return_value=sample_project)

        response = client.post(
            "/api/orgs/acme-corp/projects",
            json={"name": "My API"},
        )

    _clear(app)

    assert response.status_code == 201
    body = response.json()
    assert "data" in body
    assert body["data"]["slug"] == "my-api"
    assert body["data"]["org_id"] == str(sample_org.id)


def test_create_project_envelope_format(
    client, mock_user, sample_org, sample_project, admin_member
):
    """All responses use envelope format."""
    from app.main import app

    _override_full(app, mock_user, sample_org, admin_member)

    with patch("app.routers.projects.project_service") as mock_svc:
        mock_svc.create_project = AsyncMock(return_value=sample_project)

        response = client.post(
            "/api/orgs/acme-corp/projects",
            json={"name": "My API"},
        )

    _clear(app)

    body = response.json()
    assert "data" in body
    assert "meta" in body


def test_create_project_member_forbidden(
    client, mock_member_user, sample_org, member_member
):
    """AC RBAC: member → 403 on project creation."""
    from app.main import app

    _override_full(app, mock_member_user, sample_org, member_member)

    response = client.post(
        "/api/orgs/acme-corp/projects",
        json={"name": "My API"},
    )

    _clear(app)

    assert response.status_code == 403


def test_create_project_unauthenticated(client):
    """Unauthenticated → 401."""
    response = client.post(
        "/api/orgs/acme-corp/projects",
        json={"name": "My API"},
    )
    assert response.status_code == 401


def test_create_project_name_too_long(
    client, mock_user, sample_org, admin_member
):
    """Name > 50 chars → 422."""
    from app.main import app

    _override_full(app, mock_user, sample_org, admin_member)

    response = client.post(
        "/api/orgs/acme-corp/projects",
        json={"name": "x" * 51},
    )

    _clear(app)

    assert response.status_code == 422


def test_create_project_empty_name(
    client, mock_user, sample_org, admin_member
):
    """Empty name → 422."""
    from app.main import app

    _override_full(app, mock_user, sample_org, admin_member)

    response = client.post(
        "/api/orgs/acme-corp/projects",
        json={"name": ""},
    )

    _clear(app)

    assert response.status_code == 422


# ─── GET /api/orgs/{org_slug}/projects — list projects (AC #2) ──────


def test_list_projects_any_member(
    client, mock_member_user, sample_org, sample_project, member_member
):
    """Any org member can list projects."""
    from app.main import app
    from app.dependencies import get_current_org, get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_member_user
    app.dependency_overrides[get_current_org] = lambda: sample_org.id

    with patch("app.routers.projects.project_service") as mock_svc:
        mock_svc.list_projects = AsyncMock(return_value=[sample_project])

        response = client.get("/api/orgs/acme-corp/projects")

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]) == 1
    assert body["data"][0]["slug"] == "my-api"


# ─── GET /api/orgs/{org_slug}/projects/{slug} — get project ─────────


def test_get_project_by_slug(
    client, mock_user, sample_org, sample_project, admin_member
):
    """Get project details by slug."""
    from app.main import app
    from app.dependencies import get_current_org, get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_current_org] = lambda: sample_org.id

    with patch("app.routers.projects.project_service") as mock_svc:
        mock_svc.get_project_by_slug = AsyncMock(return_value=sample_project)

        response = client.get("/api/orgs/acme-corp/projects/my-api")

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["slug"] == "my-api"


# ─── Multi-tenant isolation (AC #5) ─────────────────────────────────


def test_create_project_scoped_to_org(
    client, mock_user, sample_org, sample_project, admin_member
):
    """AC#5: Project is scoped to the correct org."""
    from app.main import app

    _override_full(app, mock_user, sample_org, admin_member)

    with patch("app.routers.projects.project_service") as mock_svc:
        mock_svc.create_project = AsyncMock(return_value=sample_project)

        response = client.post(
            "/api/orgs/acme-corp/projects",
            json={"name": "My API"},
        )

    _clear(app)

    assert response.status_code == 201
    body = response.json()
    assert body["data"]["org_id"] == str(sample_org.id)
