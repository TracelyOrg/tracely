from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.api_key import ApiKey
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


@pytest.fixture
def sample_api_key(sample_project, sample_org):
    return ApiKey(
        id=uuid.uuid4(),
        project_id=sample_project.id,
        org_id=sample_org.id,
        key_prefix="trly_a1b2c3",
        key_hash="a" * 64,
        name="Production",
        last_used_at=None,
        is_revoked=False,
        created_at=datetime.now(timezone.utc),
    )


def _override_full(app, user, org, member):
    """Override auth + org deps, provide mock db for require_role."""
    from app.dependencies import get_current_org, get_current_user

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_org] = lambda: org.id

    mock_db = AsyncMock()

    def _make_result(value):
        return MagicMock(scalar_one_or_none=MagicMock(return_value=value))

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


# ─── POST .../api-keys — generate key (AC #3, #4) ───────────────────


def test_generate_api_key_success(
    client, mock_user, sample_org, sample_project, sample_api_key, admin_member
):
    """AC#3: Admin generates key → 201, full key returned once."""
    from app.main import app

    _override_full(app, mock_user, sample_org, admin_member)

    raw_key = "trly_abcdef1234567890abcdef12345678"

    with (
        patch("app.routers.api_keys.project_service") as mock_proj_svc,
        patch("app.routers.api_keys.api_key_service") as mock_key_svc,
    ):
        mock_proj_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_key_svc.generate_api_key = AsyncMock(
            return_value=(sample_api_key, raw_key)
        )

        response = client.post(
            "/api/orgs/acme-corp/projects/my-api/api-keys",
            json={"name": "Production"},
        )

    _clear(app)

    assert response.status_code == 201
    body = response.json()
    assert body["data"]["key"] == raw_key
    assert body["data"]["prefix"] == "trly_a1b2c3"


def test_generate_api_key_envelope(
    client, mock_user, sample_org, sample_project, sample_api_key, admin_member
):
    """Envelope format on key generation."""
    from app.main import app

    _override_full(app, mock_user, sample_org, admin_member)

    with (
        patch("app.routers.api_keys.project_service") as mock_proj_svc,
        patch("app.routers.api_keys.api_key_service") as mock_key_svc,
    ):
        mock_proj_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_key_svc.generate_api_key = AsyncMock(
            return_value=(sample_api_key, "trly_test1234567890123456789012")
        )

        response = client.post(
            "/api/orgs/acme-corp/projects/my-api/api-keys",
            json={},
        )

    _clear(app)

    body = response.json()
    assert "data" in body
    assert "meta" in body


def test_generate_api_key_member_forbidden(
    client, mock_member_user, sample_org, member_member
):
    """RBAC: member → 403 on key generation."""
    from app.main import app

    _override_full(app, mock_member_user, sample_org, member_member)

    response = client.post(
        "/api/orgs/acme-corp/projects/my-api/api-keys",
        json={},
    )

    _clear(app)

    assert response.status_code == 403


# ─── GET .../api-keys — list keys (AC #7) ───────────────────────────


def test_list_api_keys_success(
    client, mock_user, sample_org, sample_project, sample_api_key, admin_member
):
    """AC#7: List returns prefix, name, dates — never full key."""
    from app.main import app

    _override_full(app, mock_user, sample_org, admin_member)

    with (
        patch("app.routers.api_keys.project_service") as mock_proj_svc,
        patch("app.routers.api_keys.api_key_service") as mock_key_svc,
    ):
        mock_proj_svc.get_project_by_slug = AsyncMock(return_value=sample_project)
        mock_key_svc.list_api_keys = AsyncMock(return_value=[sample_api_key])

        response = client.get(
            "/api/orgs/acme-corp/projects/my-api/api-keys",
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    keys = body["data"]
    assert len(keys) == 1
    assert keys[0]["prefix"] == "trly_a1b2c3"
    # Ensure full key is NOT in the list response
    assert "key" not in keys[0]
    assert "key_hash" not in keys[0]


# ─── DELETE .../api-keys/{key_id} — revoke key (AC #8) ──────────────


def test_revoke_api_key_success(
    client, mock_user, sample_org, sample_api_key, admin_member
):
    """AC#8: Admin revokes key → 200."""
    from app.main import app

    _override_full(app, mock_user, sample_org, admin_member)

    with patch("app.routers.api_keys.api_key_service") as mock_key_svc:
        mock_key_svc.revoke_api_key = AsyncMock(return_value=None)

        response = client.delete(
            f"/api/orgs/acme-corp/projects/my-api/api-keys/{sample_api_key.id}",
        )

    _clear(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["message"] == "API key revoked"


def test_revoke_api_key_unauthenticated(client, sample_api_key):
    """Unauthenticated → 401."""
    response = client.delete(
        f"/api/orgs/acme-corp/projects/my-api/api-keys/{sample_api_key.id}",
    )
    assert response.status_code == 401


def test_revoke_api_key_member_forbidden(
    client, mock_member_user, sample_org, sample_api_key, member_member
):
    """RBAC: member → 403 on key revocation."""
    from app.main import app

    _override_full(app, mock_member_user, sample_org, member_member)

    response = client.delete(
        f"/api/orgs/acme-corp/projects/my-api/api-keys/{sample_api_key.id}",
    )

    _clear(app)

    assert response.status_code == 403
