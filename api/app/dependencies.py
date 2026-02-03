from __future__ import annotations

import uuid
from collections.abc import Callable

from fastapi import Cookie, Depends, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.models.user import User
from app.utils.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from app.utils.security import verify_token

ROLE_HIERARCHY = {"admin": 3, "member": 2, "viewer": 1}


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if access_token is None:
        raise UnauthorizedError("Not authenticated")

    user_id = verify_token(access_token, expected_type="access")
    if user_id is None:
        raise UnauthorizedError("Invalid or expired token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or inactive")

    return user


async def get_current_org(
    org_slug: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """Resolve org from URL path param and verify user membership.

    Returns the org_id that MUST be used in all subsequent queries.
    """
    result = await db.execute(
        select(Organization).where(
            Organization.slug == org_slug,
            Organization.is_active == True,  # noqa: E712
        )
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise NotFoundError("Organization not found")

    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org.id,
            OrgMember.user_id == current_user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise ForbiddenError("Not a member of this organization")

    return org.id


def require_role(role: str) -> Callable:
    """Dependency factory that checks org membership role.

    Verifies the current user has at least the required role level for
    the organization resolved from the URL path.
    """
    required_level = ROLE_HIERARCHY.get(role, 0)

    async def _check_role(
        org_slug: str = Path(...),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        result = await db.execute(
            select(Organization).where(
                Organization.slug == org_slug,
                Organization.is_active == True,  # noqa: E712
            )
        )
        org = result.scalar_one_or_none()
        if org is None:
            raise NotFoundError("Organization not found")

        result = await db.execute(
            select(OrgMember).where(
                OrgMember.org_id == org.id,
                OrgMember.user_id == current_user.id,
            )
        )
        member = result.scalar_one_or_none()
        if member is None:
            raise ForbiddenError("Not a member of this organization")

        user_level = ROLE_HIERARCHY.get(member.role, 0)
        if user_level < required_level:
            raise ForbiddenError("Insufficient permissions")

        return current_user

    return _check_role
