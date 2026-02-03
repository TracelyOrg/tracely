from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import uuid

import pytest


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
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    return user


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
    assert body["data"]["user"]["email"] == "test@example.com"


def test_register_sets_httponly_cookies(client, mock_user):
    """Test registration sets HTTP-only cookies."""
    with patch("app.routers.auth.auth_service") as mock_service:
        mock_service.register_user = AsyncMock(return_value=mock_user)

        response = client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "securepass123"},
        )

    assert response.status_code == 201
    cookies = response.cookies
    assert "access_token" in cookies
    assert "refresh_token" in cookies


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
