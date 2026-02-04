from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    UserCreate,
    UserOut,
    VerifyEmailRequest,
)
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
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await auth_service.register_user(db, data)

    return success(
        RegisterResponse(
            message="Please check your email to verify your account",
            email=user.email,
        ).model_dump()
    )


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


@router.post("/verify-email")
async def verify_email(
    data: VerifyEmailRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await auth_service.verify_email(db, data.token)

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    _set_auth_cookies(response, access_token, refresh_token)

    user_out = UserOut.model_validate(user)
    return success(AuthResponse(user=user_out).model_dump())


@router.post("/resend-verification")
async def resend_verification(
    data: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await auth_service.resend_verification(db, data.email)

    return success({"message": "If the email exists and is unverified, a new link has been sent"})


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await auth_service.forgot_password(db, data.email)

    return success({"message": "If an account with that email exists, a reset link has been sent"})


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await auth_service.reset_password(db, data.token, data.password)

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    _set_auth_cookies(response, access_token, refresh_token)

    user_out = UserOut.model_validate(user)
    return success(AuthResponse(user=user_out).model_dump())


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)) -> dict:
    user_out = UserOut.model_validate(current_user)
    return success(AuthResponse(user=user_out).model_dump())


@router.post("/onboarding-complete")
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    current_user.onboarding_completed = True
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    user_out = UserOut.model_validate(current_user)
    return success(AuthResponse(user=user_out).model_dump())
