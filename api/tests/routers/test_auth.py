from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import uuid

import pytest

from app.utils.security import create_access_token, create_refresh_token


@pytest.fixture
def mock_db():
    """Mock database session for tests."""
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture
def mock_user():
    """Create a mock user object."""
    from app.models.user import User

    user = User(
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
    return user


# ─── Registration tests (Story 1.2) ────────────────────────────────


def test_register_success(client, mock_user):
    """Test successful user registration returns 201 with envelope."""
    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.register_user = AsyncMock(return_value=mock_user)

        response = client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "securepass123"},
        )

    assert response.status_code == 201
    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert body["data"]["email"] == "test@example.com"
    assert "message" in body["data"]


def test_register_no_cookies_before_verification(client, mock_user):
    """Test registration does not set cookies (email verification required first)."""
    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.register_user = AsyncMock(return_value=mock_user)

        response = client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "securepass123"},
        )

    assert response.status_code == 201
    cookies = response.cookies
    assert "access_token" not in cookies
    assert "refresh_token" not in cookies


def test_register_duplicate_email(client):
    """Test registration with duplicate email returns 409."""
    from app.utils.exceptions import ConflictError

    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.register_user = AsyncMock(
            side_effect=ConflictError("Email already registered")
        )

        response = client.post(
            "/api/auth/register",
            json={"email": "existing@example.com", "password": "securepass123"},
        )

    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "CONFLICT"
    assert body["error"]["message"] == "Email already registered"


def test_register_weak_password(client):
    """Test registration with weak password returns 422."""
    response = client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "short"},
    )

    assert response.status_code == 422


def test_register_invalid_email(client):
    """Test registration with invalid email returns 422."""
    response = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "password": "securepass123"},
    )

    assert response.status_code == 422


def test_register_envelope_format(client, mock_user):
    """Test all responses follow the envelope format."""
    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.register_user = AsyncMock(return_value=mock_user)

        response = client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "securepass123"},
        )

    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert isinstance(body["meta"], dict)


def test_password_is_hashed():
    """Test that passwords are hashed with bcrypt, not stored plaintext."""
    from app.utils.security import hash_password, verify_password

    password = "mysecretpassword"
    hashed = hash_password(password)
    assert hashed != password
    assert hashed.startswith("$2b$")
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)


# ─── Login tests (Story 1.3 — AC #1, #2, #6) ──────────────────────


def test_login_success(client, mock_user):
    """Test login with valid credentials returns 200 + cookies."""
    with patch("app.routers.auth.auth_service") as mock_service:
        access = create_access_token(str(mock_user.id))
        refresh = create_refresh_token(str(mock_user.id))
        mock_service.login_user = AsyncMock(
            return_value=(mock_user, access, refresh)
        )

        response = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "securepass123"},
        )

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["data"]["user"]["email"] == "test@example.com"
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies


def test_login_invalid_credentials(client):
    """Test login with invalid credentials returns 401."""
    from app.utils.exceptions import UnauthorizedError

    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.login_user = AsyncMock(
            side_effect=UnauthorizedError("Invalid email or password")
        )

        response = client.post(
            "/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpass123"},
        )

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert body["error"]["message"] == "Invalid email or password"


def test_login_envelope_format(client, mock_user):
    """Test login response follows envelope format."""
    with patch("app.routers.auth.auth_service") as mock_service:
        access = create_access_token(str(mock_user.id))
        refresh = create_refresh_token(str(mock_user.id))
        mock_service.login_user = AsyncMock(
            return_value=(mock_user, access, refresh)
        )

        response = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "securepass123"},
        )

    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert "user" in body["data"]


# ─── Refresh tests (Story 1.3 — AC #4) ─────────────────────────────


def test_refresh_success(client):
    """Test valid refresh token returns new access token."""
    with patch("app.routers.auth.auth_service") as mock_service:
        new_access = create_access_token("some-user-id")
        new_refresh = create_refresh_token("some-user-id")
        mock_service.refresh_access_token = AsyncMock(
            return_value=(new_access, new_refresh)
        )

        response = client.post(
            "/api/auth/refresh",
            cookies={"refresh_token": "old-refresh-token"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["message"] == "Token refreshed"
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies


def test_refresh_expired_token(client):
    """Test expired refresh token returns 401."""
    from app.utils.exceptions import UnauthorizedError

    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.refresh_access_token = AsyncMock(
            side_effect=UnauthorizedError("Invalid or expired refresh token")
        )

        response = client.post(
            "/api/auth/refresh",
            cookies={"refresh_token": "expired-token"},
        )

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"


def test_refresh_revoked_token(client):
    """Test revoked refresh token returns 401."""
    from app.utils.exceptions import UnauthorizedError

    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.refresh_access_token = AsyncMock(
            side_effect=UnauthorizedError("Invalid or expired refresh token")
        )

        response = client.post(
            "/api/auth/refresh",
            cookies={"refresh_token": "revoked-token"},
        )

    assert response.status_code == 401


def test_refresh_no_cookie(client):
    """Test refresh without cookie returns 401."""
    response = client.post("/api/auth/refresh")

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"


# ─── Logout tests (Story 1.3 — AC #5) ──────────────────────────────


def test_logout_clears_cookies(client):
    """Test logout clears cookies and revokes refresh token."""
    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.logout_user = AsyncMock()

        response = client.post(
            "/api/auth/logout",
            cookies={"refresh_token": "some-refresh-token"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["message"] == "Logged out"
    mock_service.logout_user.assert_awaited_once()


def test_logout_without_cookie(client):
    """Test logout without cookie still succeeds (idempotent)."""
    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.logout_user = AsyncMock()
        response = client.post("/api/auth/logout")

    assert response.status_code == 200
    mock_service.logout_user.assert_not_awaited()


# ─── GET /api/auth/me tests (Story 1.3 — AC #1-6) ──────────────────


def test_me_with_valid_token(client, mock_user):
    """Test /me returns current user with valid access token."""
    from app.main import app
    from app.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_user

    response = client.get("/api/auth/me")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["data"]["user"]["email"] == "test@example.com"


def test_me_without_token(client):
    """Test /me without access token returns 401."""
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"


def test_me_with_expired_token(client):
    """Test /me with expired access token returns 401."""
    response = client.get(
        "/api/auth/me",
        cookies={"access_token": "expired-garbage-token"},
    )

    assert response.status_code == 401


def test_me_envelope_format(client, mock_user):
    """Test /me follows envelope format."""
    from app.main import app
    from app.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_user

    response = client.get("/api/auth/me")

    app.dependency_overrides.clear()

    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert "user" in body["data"]


# ─── get_current_user dependency tests ──────────────────────────────


def test_get_current_user_valid_token(client, mock_user):
    """Test get_current_user returns user with valid token."""
    from unittest.mock import MagicMock

    access_token = create_access_token(str(mock_user.id))

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_user
    mock_session.execute = AsyncMock(return_value=mock_result)

    from app.main import app
    from app.db.postgres import get_db

    app.dependency_overrides[get_db] = lambda: mock_session

    response = client.get(
        "/api/auth/me",
        cookies={"access_token": access_token},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["user"]["email"] == mock_user.email


def test_get_current_user_missing_token(client):
    """Test get_current_user with no cookie returns 401."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401
