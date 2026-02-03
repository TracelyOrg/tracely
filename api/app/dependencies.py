from __future__ import annotations

from collections.abc import Callable

from fastapi import Cookie, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.models.user import User
from app.utils.exceptions import ForbiddenError, UnauthorizedError
from app.utils.security import verify_token


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


def require_role(role: str) -> Callable:
    """Dependency factory that checks org membership role.

    Stubbed for Story 1.3 — role checking against org_members will be
    implemented in Story 1.4+ when organizations exist. Currently just
    returns the authenticated user.
    """

    async def _check_role(
        current_user: User = Depends(get_current_user),
    ) -> User:
        # TODO: Story 1.4 — query org_members for current_user + org combo
        # and verify role >= required role. For now, just ensure authenticated.
        _ = role  # Will be used in Story 1.4
        return current_user

    return _check_role
