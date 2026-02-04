from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invitation import Invitation
from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.models.user import User
from app.schemas.invitation import InvitationCreate
from app.services.email_service import send_invitation_email
from app.utils.exceptions import ConflictError, ForbiddenError, NotFoundError


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_invitation(
    db: AsyncSession,
    org: Organization,
    data: InvitationCreate,
    inviter: User,
) -> Invitation:
    """Create an invitation and send email. Raises ConflictError on duplicates."""
    email_lower = data.email.lower()

    # Check not already a member
    result = await db.execute(
        select(OrgMember)
        .join(User, User.id == OrgMember.user_id)
        .where(
            OrgMember.org_id == org.id,
            User.email == email_lower,
        )
    )
    if result.scalar_one_or_none() is not None:
        raise ConflictError("This user is already a member of your organization")

    # Check no pending invitation
    result = await db.execute(
        select(Invitation).where(
            Invitation.org_id == org.id,
            Invitation.email == email_lower,
            Invitation.status == "pending",
        )
    )
    if result.scalar_one_or_none() is not None:
        raise ConflictError("An invitation is already pending for this email")

    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)

    invitation = Invitation(
        org_id=org.id,
        email=email_lower,
        role=data.role,
        token_hash=token_hash,
        invited_by=inviter.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    # Send email (non-blocking — log failures, don't block)
    await send_invitation_email(
        to_email=email_lower,
        org_name=org.name,
        inviter_name=inviter.full_name or inviter.email,
        token=token,
        role=data.role,
    )

    return invitation


async def accept_invitation(
    db: AsyncSession, token: str, user_id: uuid.UUID
) -> Organization:
    """Accept an invitation by token. Returns the org for redirect."""
    token_hash = _hash_token(token)

    result = await db.execute(
        select(Invitation).where(
            Invitation.token_hash == token_hash,
            Invitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()

    if invitation is None:
        raise NotFoundError("Invalid or already used invitation")

    # Check expiry
    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = "expired"
        await db.commit()
        raise ForbiddenError("This invitation has expired — ask your admin for a new one")

    # Check if user is already a member
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == invitation.org_id,
            OrgMember.user_id == user_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        # Already a member — just mark accepted
        invitation.status = "accepted"
        await db.commit()
    else:
        # Create membership
        member = OrgMember(
            org_id=invitation.org_id,
            user_id=user_id,
            role=invitation.role,
        )
        db.add(member)
        invitation.status = "accepted"
        await db.commit()

    # Load org for redirect
    result = await db.execute(
        select(Organization).where(Organization.id == invitation.org_id)
    )
    org = result.scalar_one()
    return org


async def get_invitation_info(db: AsyncSession, token: str) -> dict:
    """Get invitation info by token for the landing page. Public endpoint."""
    token_hash = _hash_token(token)

    result = await db.execute(
        select(Invitation).where(Invitation.token_hash == token_hash)
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise NotFoundError("Invalid invitation")

    # Check expiry and update status if needed
    if invitation.status == "pending" and invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = "expired"
        await db.commit()

    # Load org
    result = await db.execute(
        select(Organization).where(Organization.id == invitation.org_id)
    )
    org = result.scalar_one()

    # Load inviter name
    result = await db.execute(
        select(User).where(User.id == invitation.invited_by)
    )
    inviter = result.scalar_one_or_none()

    return {
        "org_name": org.name,
        "org_slug": org.slug,
        "role": invitation.role,
        "inviter_name": inviter.full_name or inviter.email if inviter else None,
        "status": invitation.status,
    }


async def list_invitations(
    db: AsyncSession, org_id: uuid.UUID
) -> list[dict]:
    """List all invitations for an org with inviter names."""
    result = await db.execute(
        select(Invitation, User.full_name, User.email)
        .outerjoin(User, User.id == Invitation.invited_by)
        .where(Invitation.org_id == org_id)
        .order_by(Invitation.created_at.desc())
    )
    rows = result.all()

    return [
        {
            "id": row[0].id,
            "email": row[0].email,
            "role": row[0].role,
            "status": row[0].status,
            "invited_by_name": row[1] or row[2],
            "created_at": row[0].created_at,
            "expires_at": row[0].expires_at,
        }
        for row in rows
    ]


async def cancel_invitation(
    db: AsyncSession, invitation_id: uuid.UUID, org_id: uuid.UUID
) -> None:
    """Cancel a pending invitation. Scoped by org_id."""
    result = await db.execute(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.org_id == org_id,
            Invitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise NotFoundError("Invitation not found or already processed")

    invitation.status = "cancelled"
    await db.commit()


async def resend_invitation(
    db: AsyncSession, invitation_id: uuid.UUID, org_id: uuid.UUID
) -> Invitation:
    """Resend invitation with new token and expiry. Scoped by org_id."""
    result = await db.execute(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.org_id == org_id,
            Invitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise NotFoundError("Invitation not found or already processed")

    # Generate new token
    token = secrets.token_urlsafe(32)
    invitation.token_hash = _hash_token(token)
    invitation.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invitation.created_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(invitation)

    # Load org and inviter for email
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one()

    result = await db.execute(
        select(User).where(User.id == invitation.invited_by)
    )
    inviter = result.scalar_one_or_none()

    await send_invitation_email(
        to_email=invitation.email,
        org_name=org.name,
        inviter_name=inviter.full_name or inviter.email if inviter else "A team member",
        token=token,
        role=invitation.role,
    )

    return invitation
