from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.api_key import ApiKey
from app.services.api_key_service import (
    _extract_prefix,
    _generate_raw_key,
    _hash_key,
    generate_api_key,
    list_api_keys,
    revoke_api_key,
    validate_api_key,
)
from app.utils.exceptions import NotFoundError


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.fixture
def sample_project_id():
    return uuid.uuid4()


@pytest.fixture
def sample_org_id():
    return uuid.uuid4()


@pytest.fixture
def sample_api_key(sample_project_id, sample_org_id):
    return ApiKey(
        id=uuid.uuid4(),
        project_id=sample_project_id,
        org_id=sample_org_id,
        key_prefix="trly_a1b2c3",
        key_hash="abc123def456" * 5 + "abcd",  # 64 chars
        name="Production",
        last_used_at=None,
        is_revoked=False,
        created_at=datetime.now(timezone.utc),
    )


# ─── Key generation utility tests (AC #3) ───────────────────────────


def test_generate_raw_key_format():
    """AC#3: Key format is trly_ + 32 hex chars."""
    key = _generate_raw_key()
    assert key.startswith("trly_")
    assert len(key) == 37  # 5 prefix + 32 hex
    # Verify hex part is valid hex
    int(key[5:], 16)


def test_generate_raw_key_unique():
    """Each call generates a different key."""
    k1 = _generate_raw_key()
    k2 = _generate_raw_key()
    assert k1 != k2


def test_hash_key_sha256():
    """AC#5: SHA-256 hash is 64 hex chars."""
    key = "trly_" + "a" * 32
    h = _hash_key(key)
    assert len(h) == 64
    int(h, 16)  # Valid hex


def test_hash_key_deterministic():
    """Same key always produces same hash."""
    key = "trly_abcdef1234567890abcdef12345678"
    assert _hash_key(key) == _hash_key(key)


def test_extract_prefix():
    """Prefix is first 12 chars."""
    key = "trly_a1b2c3d4e5f6g7h8"
    assert _extract_prefix(key) == "trly_a1b2c3d"


# ─── generate_api_key tests (AC #3, #5, #6) ─────────────────────────


@pytest.mark.asyncio
async def test_generate_api_key_returns_raw_key(mock_db, sample_project_id, sample_org_id):
    """AC#3: Returns full key once. AC#5: Stores hash only."""
    api_key, raw_key = await generate_api_key(
        mock_db, sample_project_id, sample_org_id, name="Test"
    )

    assert raw_key.startswith("trly_")
    assert len(raw_key) == 37
    assert api_key.key_hash == _hash_key(raw_key)
    assert api_key.key_prefix == raw_key[:12]
    assert api_key.name == "Test"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_api_key_scoped_to_project(mock_db, sample_project_id, sample_org_id):
    """AC#6: Key is scoped to project and org."""
    api_key, _ = await generate_api_key(
        mock_db, sample_project_id, sample_org_id
    )

    assert api_key.project_id == sample_project_id
    assert api_key.org_id == sample_org_id


# ─── list_api_keys tests (AC #7) ────────────────────────────────────


@pytest.mark.asyncio
async def test_list_api_keys_returns_keys(
    mock_db, sample_api_key, sample_project_id, sample_org_id
):
    """AC#7: Lists prefix, name, dates — never full key."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [sample_api_key]
    mock_db.execute = AsyncMock(return_value=mock_result)

    keys = await list_api_keys(mock_db, sample_project_id, sample_org_id)
    assert len(keys) == 1
    assert keys[0].key_prefix == "trly_a1b2c3"
    # Verify key_hash is NOT the raw key (it's a hash)
    assert not keys[0].key_hash.startswith("trly_")


@pytest.mark.asyncio
async def test_list_api_keys_empty(mock_db, sample_project_id, sample_org_id):
    """No keys → empty list."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    keys = await list_api_keys(mock_db, sample_project_id, sample_org_id)
    assert keys == []


# ─── revoke_api_key tests (AC #8) ───────────────────────────────────


@pytest.mark.asyncio
async def test_revoke_api_key_success(mock_db, sample_api_key, sample_org_id):
    """AC#8: Revoke sets is_revoked = true."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_api_key
    mock_db.execute = AsyncMock(return_value=mock_result)

    await revoke_api_key(mock_db, sample_api_key.id, sample_org_id)
    assert sample_api_key.is_revoked is True
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_revoke_api_key_not_found(mock_db, sample_org_id):
    """Revoking non-existent key raises NotFoundError."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    with pytest.raises(NotFoundError, match="API key not found"):
        await revoke_api_key(mock_db, uuid.uuid4(), sample_org_id)


# ─── validate_api_key tests (AC #9) ─────────────────────────────────


@pytest.mark.asyncio
async def test_validate_api_key_valid(
    mock_db, sample_api_key, sample_project_id, sample_org_id
):
    """AC#9: Valid key → returns project_id + org_id."""
    raw_key = "trly_a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    sample_api_key.key_hash = _hash_key(raw_key)
    sample_api_key.project_id = sample_project_id
    sample_api_key.org_id = sample_org_id

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_api_key
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await validate_api_key(mock_db, raw_key)
    assert result is not None
    project_id, org_id = result
    assert project_id == sample_project_id
    assert org_id == sample_org_id


@pytest.mark.asyncio
async def test_validate_api_key_invalid(mock_db):
    """Invalid key → returns None."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await validate_api_key(mock_db, "trly_invalidkey1234567890abcdef12")
    assert result is None


@pytest.mark.asyncio
async def test_validate_api_key_revoked(mock_db):
    """AC#9: Revoked key → returns None (query filters is_revoked=False)."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None  # Query excludes revoked
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await validate_api_key(mock_db, "trly_revokedkey12345678901234abcd")
    assert result is None
