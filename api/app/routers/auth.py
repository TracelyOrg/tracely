from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, UserCreate, UserOut
from app.services import auth_service
from app.utils.envelope import success
from app.utils.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_ACCESS_MAX_AGE = ACCESS_TOKEN_EXPIRE_MINUTES * 60
_REFRESH_MAX_AGE = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _set_auth_cookies(
    response: Response, access_token: str, refresh_token: str
) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=_ACCESS_MAX_AGE,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=_REFRESH_MAX_AGE,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", httponly=True, secure=True, samesite="lax")
    response.delete_cookie(key="refresh_token", httponly=True, secure=True, samesite="lax")


@router.post("/register", status_code=201)
async def register(
    data: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await auth_service.register_user(db, data)

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    _set_auth_cookies(response, access_token, refresh_token)

    user_out = UserOut.model_validate(user)
    return success(AuthResponse(user=user_out).model_dump())


@router.post("/login")
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user, access_token, refresh_token = await auth_service.login_user(db, data)

    _set_auth_cookies(response, access_token, refresh_token)

    user_out = UserOut.model_validate(user)
    return success(AuthResponse(user=user_out).model_dump())


@router.post("/refresh")
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.utils.exceptions import UnauthorizedError

    if refresh_token is None:
        raise UnauthorizedError("No refresh token provided")

    new_access, new_refresh = await auth_service.refresh_access_token(
        db, refresh_token
    )

    _set_auth_cookies(response, new_access, new_refresh)

    return success({"message": "Token refreshed"})


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if refresh_token is not None:
        await auth_service.logout_user(db, refresh_token)

    _clear_auth_cookies(response)

    return success({"message": "Logged out"})


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)) -> dict:
    user_out = UserOut.model_validate(current_user)
    return success(AuthResponse(user=user_out).model_dump())
