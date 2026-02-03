from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.schemas.organization import OrgCreate
from app.utils.exceptions import NotFoundError
from app.utils.slugify import generate_unique_slug


async def create_organization(
    db: AsyncSession, data: OrgCreate, user_id: uuid.UUID
) -> tuple[Organization, OrgMember]:
    """Create an organization and assign the creating user as admin."""
    slug = await generate_unique_slug(db, data.name)

    org = Organization(name=data.name, slug=slug)
    db.add(org)
    await db.flush()

    member = OrgMember(org_id=org.id, user_id=user_id, role="admin")
    db.add(member)

    await db.commit()
    await db.refresh(org)
    await db.refresh(member)

    return org, member


async def list_user_organizations(
    db: AsyncSession, user_id: uuid.UUID
) -> list[Organization]:
    """Return all organizations the user is a member of."""
    result = await db.execute(
        select(Organization)
        .join(OrgMember, OrgMember.org_id == Organization.id)
        .where(OrgMember.user_id == user_id, Organization.is_active == True)  # noqa: E712
    )
    return list(result.scalars().all())


async def get_org_by_slug(
    db: AsyncSession, slug: str
) -> Organization:
    """Fetch an organization by slug or raise NotFoundError."""
    result = await db.execute(
        select(Organization).where(
            Organization.slug == slug, Organization.is_active == True  # noqa: E712
        )
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise NotFoundError("Organization not found")
    return org
