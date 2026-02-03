from __future__ import annotations

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization


def generate_slug(name: str) -> str:
    """Convert a name to a kebab-case slug.

    Normalizes unicode, lowercases, replaces non-alphanumeric chars with
    hyphens, collapses consecutive hyphens, and strips leading/trailing
    hyphens.  Truncates to 60 characters.
    """
    slug = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = slug.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug[:60]


async def generate_unique_slug(db: AsyncSession, name: str) -> str:
    """Generate a slug from *name* that is unique among organizations.

    If the base slug already exists, appends ``-1``, ``-2``, … until a
    unique value is found.
    """
    base_slug = generate_slug(name)

    result = await db.execute(
        select(Organization.slug).where(Organization.slug == base_slug)
    )
    if result.scalar_one_or_none() is None:
        return base_slug

    counter = 1
    while True:
        candidate = f"{base_slug}-{counter}"
        result = await db.execute(
            select(Organization.slug).where(Organization.slug == candidate)
        )
        if result.scalar_one_or_none() is None:
            return candidate
        counter += 1
