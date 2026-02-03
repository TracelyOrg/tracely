from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey
from app.utils.exceptions import NotFoundError


def _generate_raw_key() -> str:
    """Generate a raw API key: trly_ + 32 random hex chars."""
    return f"trly_{secrets.token_hex(16)}"


def _hash_key(raw_key: str) -> str:
    """Return SHA-256 hex digest of the raw key."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _extract_prefix(raw_key: str) -> str:
    """Return the display prefix (first 12 chars, e.g. 'trly_a1b2c3')."""
    return raw_key[:12]


async def generate_api_key(
    db: AsyncSession,
    project_id: uuid.UUID,
    org_id: uuid.UUID,
    name: str | None = None,
) -> tuple[ApiKey, str]:
    """Generate a new API key for a project.

    Returns the ApiKey record and the raw key (shown once, never stored).
    """
    raw_key = _generate_raw_key()
    key_hash = _hash_key(raw_key)
    prefix = _extract_prefix(raw_key)

    api_key = ApiKey(
        project_id=project_id,
        org_id=org_id,
        key_prefix=prefix,
        key_hash=key_hash,
        name=name,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return api_key, raw_key


async def list_api_keys(
    db: AsyncSession,
    project_id: uuid.UUID,
    org_id: uuid.UUID,
) -> list[ApiKey]:
    """List all non-revoked API keys for a project (prefix + metadata only)."""
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.project_id == project_id,
            ApiKey.org_id == org_id,
            ApiKey.is_revoked == False,  # noqa: E712
        )
    )
    return list(result.scalars().all())


async def revoke_api_key(
    db: AsyncSession,
    key_id: uuid.UUID,
    org_id: uuid.UUID,
) -> None:
    """Soft-revoke an API key. Raises NotFoundError if not found."""
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.org_id == org_id,
            ApiKey.is_revoked == False,  # noqa: E712
        )
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise NotFoundError("API key not found")

    api_key.is_revoked = True
    await db.commit()


async def validate_api_key(
    db: AsyncSession, raw_key: str
) -> tuple[uuid.UUID, uuid.UUID] | None:
    """Validate a raw API key by hash lookup.

    Returns (project_id, org_id) if valid and not revoked, else None.
    Updates last_used_at on success.
    """
    key_hash = _hash_key(raw_key)

    result = await db.execute(
        select(ApiKey).where(
            ApiKey.key_hash == key_hash,
            ApiKey.is_revoked == False,  # noqa: E712
        )
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        return None

    # Update last_used_at
    await db.execute(
        update(ApiKey)
        .where(ApiKey.id == api_key.id)
        .values(last_used_at=datetime.now(timezone.utc))
    )
    await db.commit()

    return api_key.project_id, api_key.org_id
