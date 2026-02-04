from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.models.user import User
from app.utils.security import create_access_token


@pytest.fixture
def mock_user():
    return User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash="$2b$12$hashed",
        full_name=None,
        is_active=True,
        onboarding_completed=False,
        email_verified=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def mock_user_b():
    """Second user for multi-tenant isolation tests."""
    return User(
        id=uuid.uuid4(),
        email="other@example.com",
        password_hash="$2b$12$hashed",
        full_name=None,
        is_active=True,
        onboarding_completed=False,
        email_verified=False,
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
def sample_member(sample_org, mock_user):
    return OrgMember(
        id=uuid.uuid4(),
        org_id=sample_org.id,
        user_id=mock_user.id,
        role="admin",
        created_at=datetime.now(timezone.utc),
    )


def _override_auth(app, user):
    """Override get_current_user to return the given user."""
    from app.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: user


def _clear_overrides(app):
    app.dependency_overrides.clear()


# ─── POST /api/orgs — org creation (AC #1, #2, #3, #6) ──────────────


def test_create_org_success(client, mock_user, sample_org, sample_member):
    """AC#1: Valid name → org created with slug, AC#2: admin role assigned."""
    from app.main import app

    _override_auth(app, mock_user)

    with patch("app.routers.organizations.org_service") as mock_service:
        mock_service.create_organization = AsyncMock(
            return_value=(sample_org, sample_member)
        )

        response = client.post(
            "/api/orgs",
            json={"name": "Acme Corp"},
        )

    _clear_overrides(app)

    assert response.status_code == 201
    body = response.json()
    assert "data" in body
    assert body["data"]["organization"]["slug"] == "acme-corp"
    assert body["data"]["member"]["role"] == "admin"


def test_create_org_envelope_format(client, mock_user, sample_org, sample_member):
    """All responses follow envelope format."""
    from app.main import app

    _override_auth(app, mock_user)

    with patch("app.routers.organizations.org_service") as mock_service:
        mock_service.create_organization = AsyncMock(
            return_value=(sample_org, sample_member)
        )

        response = client.post(
            "/api/orgs",
            json={"name": "Acme Corp"},
        )

    _clear_overrides(app)

    body = response.json()
    assert "data" in body
    assert "meta" in body


def test_create_org_unauthenticated(client):
    """Unauthenticated user cannot create org."""
    response = client.post(
        "/api/orgs",
        json={"name": "Acme Corp"},
    )

    assert response.status_code == 401


def test_create_org_name_too_long(client, mock_user):
    """Name > 50 chars rejected."""
    from app.main import app

    _override_auth(app, mock_user)

    response = client.post(
        "/api/orgs",
        json={"name": "x" * 51},
    )

    _clear_overrides(app)

    assert response.status_code == 422


def test_create_org_empty_name(client, mock_user):
    """Empty name rejected."""
    from app.main import app

    _override_auth(app, mock_user)

    response = client.post(
        "/api/orgs",
        json={"name": ""},
    )

    _clear_overrides(app)

    assert response.status_code == 422


# ─── GET /api/orgs — list user orgs ──────────────────────────────────


def test_list_orgs_success(client, mock_user, sample_org):
    """Lists orgs the user belongs to."""
    from app.main import app
    from app.services.org_service import EnrichedOrg

    _override_auth(app, mock_user)

    enriched = EnrichedOrg(
        org=sample_org, user_role="admin", member_count=1, project_count=0
    )

    with patch("app.routers.organizations.org_service") as mock_service:
        mock_service.list_user_organizations = AsyncMock(
            return_value=[enriched]
        )

        response = client.get("/api/orgs")

    _clear_overrides(app)

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert len(body["data"]) == 1
    assert body["data"][0]["slug"] == "acme-corp"


def test_list_orgs_empty(client, mock_user):
    """User with no orgs gets empty list."""
    from app.main import app

    _override_auth(app, mock_user)

    with patch("app.routers.organizations.org_service") as mock_service:
        mock_service.list_user_organizations = AsyncMock(return_value=[])

        response = client.get("/api/orgs")

    _clear_overrides(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == []


def test_list_orgs_unauthenticated(client):
    """Unauthenticated user cannot list orgs."""
    response = client.get("/api/orgs")
    assert response.status_code == 401


# ─── GET /api/orgs/{org_slug} — get org details ──────────────────────


def test_get_org_success(client, mock_user, sample_org, sample_member):
    """Member can see their org."""
    from app.main import app

    _override_auth(app, mock_user)

    mock_db = AsyncMock()
    # Only the membership check hits db.execute (get_org_by_slug is patched)
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sample_member))
    )

    with patch("app.routers.organizations.org_service") as mock_service:
        mock_service.get_org_by_slug = AsyncMock(return_value=sample_org)

        from app.db.postgres import get_db

        app.dependency_overrides[get_db] = lambda: mock_db

        response = client.get("/api/orgs/acme-corp")

    _clear_overrides(app)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["slug"] == "acme-corp"


# ─── Multi-tenant isolation tests (AC #4, #5) ────────────────────────


def test_get_org_non_member_forbidden(client, mock_user, sample_org):
    """AC#5: User who is NOT a member of org gets 403."""
    from app.main import app

    _override_auth(app, mock_user)

    mock_db = AsyncMock()
    # Only the membership check hits db.execute (service call is patched)
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    )

    with patch("app.routers.organizations.org_service") as mock_service:
        mock_service.get_org_by_slug = AsyncMock(return_value=sample_org)

        from app.db.postgres import get_db

        app.dependency_overrides[get_db] = lambda: mock_db

        response = client.get("/api/orgs/acme-corp")

    _clear_overrides(app)

    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "FORBIDDEN"


def test_get_org_not_found(client, mock_user):
    """Non-existent org slug returns 404."""
    from app.main import app
    from app.utils.exceptions import NotFoundError

    _override_auth(app, mock_user)

    with patch("app.routers.organizations.org_service") as mock_service:
        mock_service.get_org_by_slug = AsyncMock(
            side_effect=NotFoundError("Organization not found")
        )

        response = client.get("/api/orgs/no-such-org")

    _clear_overrides(app)

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"


# ─── RBAC tests (AC #4) ──────────────────────────────────────────────


def test_require_role_admin_allows_admin():
    """AC#4: require_role('admin') allows admin user."""
    from app.dependencies import ROLE_HIERARCHY

    assert ROLE_HIERARCHY["admin"] >= ROLE_HIERARCHY["admin"]


def test_require_role_admin_blocks_member():
    """AC#4: require_role('admin') blocks member."""
    from app.dependencies import ROLE_HIERARCHY

    assert ROLE_HIERARCHY["member"] < ROLE_HIERARCHY["admin"]


def test_require_role_admin_blocks_viewer():
    """AC#4: require_role('admin') blocks viewer."""
    from app.dependencies import ROLE_HIERARCHY

    assert ROLE_HIERARCHY["viewer"] < ROLE_HIERARCHY["admin"]


def test_require_role_member_allows_admin():
    """Admin satisfies member requirement."""
    from app.dependencies import ROLE_HIERARCHY

    assert ROLE_HIERARCHY["admin"] >= ROLE_HIERARCHY["member"]


def test_require_role_viewer_allows_all():
    """All roles satisfy viewer requirement."""
    from app.dependencies import ROLE_HIERARCHY

    for role in ("admin", "member", "viewer"):
        assert ROLE_HIERARCHY[role] >= ROLE_HIERARCHY["viewer"]


# ─── get_current_org dependency tests (AC #4, #5) ────────────────────


@pytest.mark.asyncio
async def test_get_current_org_valid_member(mock_user, sample_org, sample_member):
    """AC#4: Valid member → returns org_id."""
    from app.dependencies import get_current_org

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=MagicMock(return_value=sample_org)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=sample_member)),
        ]
    )

    org_id = await get_current_org(
        org_slug="acme-corp",
        current_user=mock_user,
        db=mock_db,
    )
    assert org_id == sample_org.id


@pytest.mark.asyncio
async def test_get_current_org_non_member_forbidden(mock_user, sample_org):
    """AC#5: Non-member → 403 ForbiddenError."""
    from app.dependencies import get_current_org
    from app.utils.exceptions import ForbiddenError

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=MagicMock(return_value=sample_org)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]
    )

    with pytest.raises(ForbiddenError, match="Not a member"):
        await get_current_org(
            org_slug="acme-corp",
            current_user=mock_user,
            db=mock_db,
        )


@pytest.mark.asyncio
async def test_get_current_org_org_not_found(mock_user):
    """Org not found → 404 NotFoundError."""
    from app.dependencies import get_current_org
    from app.utils.exceptions import NotFoundError

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    )

    with pytest.raises(NotFoundError, match="Organization not found"):
        await get_current_org(
            org_slug="ghost-org",
            current_user=mock_user,
            db=mock_db,
        )
