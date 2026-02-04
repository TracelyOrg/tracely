from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User
from app.schemas.organization import OrgCreate, OrgUpdate
from app.utils.exceptions import ForbiddenError, NotFoundError
from app.utils.slugify import generate_unique_slug


@dataclass
class EnrichedOrg:
    org: Organization
    user_role: str
    member_count: int
    project_count: int


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
) -> list[EnrichedOrg]:
    """Return all organizations the user is a member of, enriched with counts and role."""
    # Subqueries for counts to avoid incorrect results from multiple JOINs
    member_count_sq = (
        select(
            OrgMember.org_id,
            func.count(OrgMember.id).label("member_count"),
        )
        .group_by(OrgMember.org_id)
        .subquery()
    )

    project_count_sq = (
        select(
            Project.org_id,
            func.count(Project.id).label("project_count"),
        )
        .where(Project.is_active == True)  # noqa: E712
        .group_by(Project.org_id)
        .subquery()
    )

    stmt = (
        select(
            Organization,
            OrgMember.role,
            func.coalesce(member_count_sq.c.member_count, 0).label("member_count"),
            func.coalesce(project_count_sq.c.project_count, 0).label("project_count"),
        )
        .join(OrgMember, OrgMember.org_id == Organization.id)
        .outerjoin(member_count_sq, member_count_sq.c.org_id == Organization.id)
        .outerjoin(project_count_sq, project_count_sq.c.org_id == Organization.id)
        .where(
            OrgMember.user_id == user_id,
            Organization.is_active == True,  # noqa: E712
        )
        .order_by(Organization.name)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        EnrichedOrg(
            org=row[0],
            user_role=row[1],
            member_count=row[2],
            project_count=row[3],
        )
        for row in rows
    ]


async def update_organization(
    db: AsyncSession, org_id: uuid.UUID, data: OrgUpdate
) -> Organization:
    """Update organization name. Slug remains immutable."""
    result = await db.execute(
        select(Organization).where(
            Organization.id == org_id, Organization.is_active == True  # noqa: E712
        )
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise NotFoundError("Organization not found")

    org.name = data.name
    await db.commit()
    await db.refresh(org)
    return org


ROLE_SORT_ORDER = {"admin": 0, "member": 1, "viewer": 2}


async def list_members(
    db: AsyncSession, org_id: uuid.UUID
) -> list[dict]:
    """List all members of an org with user info. Sorted: admins first."""
    result = await db.execute(
        select(OrgMember, User.email, User.full_name)
        .join(User, User.id == OrgMember.user_id)
        .where(OrgMember.org_id == org_id)
    )
    rows = result.all()

    members = [
        {
            "id": row[0].id,
            "user_id": row[0].user_id,
            "email": row[1],
            "full_name": row[2],
            "role": row[0].role,
            "created_at": row[0].created_at,
        }
        for row in rows
    ]

    members.sort(key=lambda m: ROLE_SORT_ORDER.get(m["role"], 99))
    return members


async def _count_admins(db: AsyncSession, org_id: uuid.UUID) -> int:
    """Count admins in an organization."""
    result = await db.execute(
        select(func.count()).where(
            OrgMember.org_id == org_id,
            OrgMember.role == "admin",
        )
    )
    return result.scalar() or 0


async def update_member_role(
    db: AsyncSession, org_id: uuid.UUID, member_id: uuid.UUID, new_role: str
) -> OrgMember:
    """Update a member's role. Protects last admin."""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.id == member_id,
            OrgMember.org_id == org_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise NotFoundError("Member not found")

    if member.role == "admin" and new_role != "admin":
        admin_count = await _count_admins(db, org_id)
        if admin_count <= 1:
            raise ForbiddenError("Organization must have at least one admin")

    member.role = new_role
    await db.commit()
    await db.refresh(member)
    return member


async def remove_member(
    db: AsyncSession, org_id: uuid.UUID, member_id: uuid.UUID
) -> None:
    """Remove a member from the organization. Protects last admin."""
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.id == member_id,
            OrgMember.org_id == org_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise NotFoundError("Member not found")

    if member.role == "admin":
        admin_count = await _count_admins(db, org_id)
        if admin_count <= 1:
            raise ForbiddenError(
                "Cannot remove the last admin. Transfer admin role to another member first."
            )

    await db.delete(member)
    await db.commit()


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
