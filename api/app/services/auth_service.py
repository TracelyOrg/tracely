from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, UserCreate
from app.services.email_service import send_password_reset_email, send_verification_email
from app.utils.exceptions import (
    BadRequestError,
    ConflictError,
    TooManyRequestsError,
    UnauthorizedError,
)
from app.utils.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token,
)

VERIFICATION_TOKEN_EXPIRY_HOURS = 24
PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1
RESEND_COOLDOWN_SECONDS = 60


async def register_user(db: AsyncSession, data: UserCreate) -> User:
    result = await db.execute(select(User).where(User.email == data.email))
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise ConflictError("Email already registered")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        email_verified=False,
        email_verification_token=token_hash,
        email_verification_sent_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await send_verification_email(user.email, token)

    return user


async def verify_email(db: AsyncSession, token: str) -> User:
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    result = await db.execute(
        select(User).where(User.email_verification_token == token_hash)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise BadRequestError("Invalid verification token")

    if user.email_verified:
        raise BadRequestError("Email already verified")

    if user.email_verification_sent_at is not None:
        expiry = user.email_verification_sent_at + timedelta(
            hours=VERIFICATION_TOKEN_EXPIRY_HOURS
        )
        if datetime.now(timezone.utc) > expiry:
            raise BadRequestError("Verification link has expired")

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_sent_at = None
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def resend_verification(db: AsyncSession, email: str) -> None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return

    if user.email_verified:
        return

    if user.email_verification_sent_at is not None:
        cooldown = user.email_verification_sent_at + timedelta(
            seconds=RESEND_COOLDOWN_SECONDS
        )
        if datetime.now(timezone.utc) < cooldown:
            raise TooManyRequestsError("Please wait before requesting again")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    user.email_verification_token = token_hash
    user.email_verification_sent_at = datetime.now(timezone.utc)
    db.add(user)
    await db.commit()

    await send_verification_email(user.email, token)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def login_user(
    db: AsyncSession, data: LoginRequest
) -> tuple[User, str, str]:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(refresh_record)
    await db.commit()

    return user, access_token, refresh_token


async def refresh_access_token(
    db: AsyncSession, refresh_token: str
) -> tuple[str, str | None]:
    user_id = verify_token(refresh_token, expected_type="refresh")
    if user_id is None:
        raise UnauthorizedError("Invalid or expired refresh token")

    token_hash = _hash_token(refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.is_revoked == False,  # noqa: E712
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    stored = result.scalar_one_or_none()
    if stored is None:
        raise UnauthorizedError("Invalid or expired refresh token")

    new_access_token = create_access_token(user_id)

    # Rotate refresh token: revoke old, issue new
    stored.is_revoked = True
    new_refresh_token = create_refresh_token(user_id)
    new_record = RefreshToken(
        user_id=stored.user_id,
        token_hash=_hash_token(new_refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_record)
    await db.commit()

    return new_access_token, new_refresh_token


async def logout_user(db: AsyncSession, refresh_token: str) -> None:
    token_hash = _hash_token(refresh_token)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .values(is_revoked=True)
    )
    await db.commit()


async def forgot_password(db: AsyncSession, email: str) -> None:
    print(f"[forgot_password] called for email={email}")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        print(f"[forgot_password] no user found for email={email}")
        return

    if user.password_reset_sent_at is not None:
        cooldown = user.password_reset_sent_at + timedelta(
            seconds=RESEND_COOLDOWN_SECONDS
        )
        if datetime.now(timezone.utc) < cooldown:
            print(f"[forgot_password] cooldown active for email={email}")
            raise TooManyRequestsError("Please wait before requesting again")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    user.password_reset_token = token_hash
    user.password_reset_sent_at = datetime.now(timezone.utc)
    db.add(user)
    await db.commit()

    print(f"[forgot_password] token stored, sending email to {user.email}")
    await send_password_reset_email(user.email, token)


async def reset_password(db: AsyncSession, token: str, new_password: str) -> User:
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    result = await db.execute(
        select(User).where(User.password_reset_token == token_hash)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise BadRequestError("Invalid or expired reset token")

    if user.password_reset_sent_at is not None:
        expiry = user.password_reset_sent_at + timedelta(
            hours=PASSWORD_RESET_TOKEN_EXPIRY_HOURS
        )
        if datetime.now(timezone.utc) > expiry:
            raise BadRequestError("Reset link has expired")

    user.password_hash = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_sent_at = None
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
