from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.utils.slugify import generate_slug, generate_unique_slug


# ─── generate_slug (pure function) ───────────────────────────────────


def test_slug_basic():
    assert generate_slug("My Organization") == "my-organization"


def test_slug_special_characters():
    assert generate_slug("Org & Co. #1") == "org-co-1"


def test_slug_unicode():
    assert generate_slug("Cafe") == "cafe"


def test_slug_leading_trailing_hyphens():
    assert generate_slug("  --hello--  ") == "hello"


def test_slug_consecutive_hyphens():
    assert generate_slug("a   b   c") == "a-b-c"


def test_slug_truncates_to_60():
    long_name = "a" * 100
    slug = generate_slug(long_name)
    assert len(slug) <= 60


def test_slug_empty_after_normalise():
    # All non-ascii characters stripped → empty
    slug = generate_slug("...")
    assert slug == ""


# ─── generate_unique_slug (async, needs DB mock) ─────────────────────


@pytest.mark.asyncio
async def test_unique_slug_no_conflict():
    """Base slug is unique → returned as-is."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    slug = await generate_unique_slug(mock_db, "Acme Corp")
    assert slug == "acme-corp"


@pytest.mark.asyncio
async def test_unique_slug_with_conflict():
    """Base slug exists → appends -1."""
    mock_db = AsyncMock()

    # First call: base slug exists; second call: -1 is free
    results = [
        MagicMock(scalar_one_or_none=MagicMock(return_value="acme-corp")),
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
    ]
    mock_db.execute = AsyncMock(side_effect=results)

    slug = await generate_unique_slug(mock_db, "Acme Corp")
    assert slug == "acme-corp-1"


@pytest.mark.asyncio
async def test_unique_slug_with_multiple_conflicts():
    """Base slug and -1 exist → appends -2."""
    mock_db = AsyncMock()

    results = [
        MagicMock(scalar_one_or_none=MagicMock(return_value="acme-corp")),
        MagicMock(scalar_one_or_none=MagicMock(return_value="acme-corp-1")),
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
    ]
    mock_db.execute = AsyncMock(side_effect=results)

    slug = await generate_unique_slug(mock_db, "Acme Corp")
    assert slug == "acme-corp-2"
