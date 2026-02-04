from __future__ import annotations

import asyncio
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def _verification_html(verification_url: str) -> str:
    return f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">Verify your TRACELY account</h2>
        <p>Click the button below to verify your email address and get started.</p>
        <a href="{verification_url}"
           style="display: inline-block; padding: 12px 24px; background: #0f172a;
                  color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Verify Email
        </a>
        <p style="color: #666; font-size: 14px;">
            If you didn't create a TRACELY account, you can safely ignore this email.
        </p>
        <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
    </div>
    """


def _invitation_html(
    org_name: str, inviter_name: str, role: str, invite_url: str
) -> str:
    return f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">You've been invited to {org_name} on TRACELY</h2>
        <p><strong>{inviter_name}</strong> invited you to join as <strong>{role}</strong>.</p>
        <a href="{invite_url}"
           style="display: inline-block; padding: 12px 24px; background: #0f172a;
                  color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Accept Invitation
        </a>
        <p style="color: #999; font-size: 12px;">This invitation expires in 7 days.</p>
    </div>
    """


async def send_verification_email(to_email: str, token: str) -> bool:
    """Send email verification link via Resend. Returns True on success."""
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping verification email to %s", to_email)
        return False

    verification_url = f"{settings.frontend_url}/verify?token={token}"

    try:
        import resend

        resend.api_key = settings.resend_api_key
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": "Verify your TRACELY account",
                "html": _verification_html(verification_url),
            },
        )
        logger.info("Verification email sent to %s", to_email)
        return True
    except Exception:
        logger.exception("Failed to send verification email to %s", to_email)
        return False


def _password_reset_html(reset_url: str) -> str:
    return f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">Reset your TRACELY password</h2>
        <p>Click the button below to set a new password for your account.</p>
        <a href="{reset_url}"
           style="display: inline-block; padding: 12px 24px; background: #0f172a;
                  color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Reset Password
        </a>
        <p style="color: #666; font-size: 14px;">
            If you didn't request a password reset, you can safely ignore this email.
        </p>
        <p style="color: #999; font-size: 12px;">This link expires in 1 hour.</p>
    </div>
    """


async def send_password_reset_email(to_email: str, token: str) -> bool:
    """Send password reset link via Resend. Returns True on success."""
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping password reset email to %s", to_email)
        return False

    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    print(f"[send_password_reset_email] to={to_email}, from={settings.resend_from_email}, reset_url={reset_url}")

    try:
        import resend

        resend.api_key = settings.resend_api_key
        response = await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": "Reset your TRACELY password",
                "html": _password_reset_html(reset_url),
            },
        )
        print(f"[send_password_reset_email] sent to {to_email} — Resend response: {response}")
        return True
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        return False


async def send_invitation_email(
    to_email: str, org_name: str, inviter_name: str, token: str, role: str
) -> bool:
    """Send team invitation email via Resend. Returns True on success."""
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping invitation email to %s", to_email)
        return False

    invite_url = f"{settings.frontend_url}/invite?token={token}"

    try:
        import resend

        resend.api_key = settings.resend_api_key
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": f"You've been invited to {org_name} on TRACELY",
                "html": _invitation_html(org_name, inviter_name, role, invite_url),
            },
        )
        logger.info("Invitation email sent to %s for org %s", to_email, org_name)
        return True
    except Exception:
        logger.exception("Failed to send invitation email to %s", to_email)
        return False
