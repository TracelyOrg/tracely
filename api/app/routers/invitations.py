from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.invitation import InvitationAccept, InvitationCreate, InvitationInfo, InvitationOut
from app.services import invitation_service, org_service
from app.utils.envelope import success

router = APIRouter(tags=["invitations"])


# --- Org-scoped endpoints (admin only) ---


@router.post("/api/orgs/{org_slug}/invitations", status_code=201)
async def create_invitation(
    org_slug: str,
    data: InvitationCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Send a team invitation. Admin only."""
    org = await org_service.get_org_by_slug(db, org_slug)
    invitation = await invitation_service.create_invitation(db, org, data, current_user)
    return success(
        InvitationOut(
            id=invitation.id,
            email=invitation.email,
            role=invitation.role,
            status=invitation.status,
            created_at=invitation.created_at,
            expires_at=invitation.expires_at,
        ).model_dump(mode="json")
    )


@router.get("/api/orgs/{org_slug}/invitations")
async def list_invitations(
    org_slug: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all invitations for an org. Admin only."""
    org = await org_service.get_org_by_slug(db, org_slug)
    invitations = await invitation_service.list_invitations(db, org.id)
    return success(
        [
            InvitationOut(**inv).model_dump(mode="json")
            for inv in invitations
        ]
    )


@router.delete("/api/orgs/{org_slug}/invitations/{invitation_id}")
async def cancel_invitation(
    org_slug: str,
    invitation_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Cancel a pending invitation. Admin only."""
    org = await org_service.get_org_by_slug(db, org_slug)
    await invitation_service.cancel_invitation(db, invitation_id, org.id)
    return success({"message": "Invitation cancelled"})


@router.post("/api/orgs/{org_slug}/invitations/{invitation_id}/resend")
async def resend_invitation(
    org_slug: str,
    invitation_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Resend an invitation with a new token. Admin only."""
    org = await org_service.get_org_by_slug(db, org_slug)
    invitation = await invitation_service.resend_invitation(db, invitation_id, org.id)
    return success(
        InvitationOut(
            id=invitation.id,
            email=invitation.email,
            role=invitation.role,
            status=invitation.status,
            created_at=invitation.created_at,
            expires_at=invitation.expires_at,
        ).model_dump(mode="json")
    )


# --- Public invitation endpoints ---


@router.get("/api/invitations/info")
async def get_invitation_info(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get invitation info by token. Public (no auth required)."""
    info = await invitation_service.get_invitation_info(db, token)
    return success(InvitationInfo(**info).model_dump(mode="json"))


@router.post("/api/invitations/accept")
async def accept_invitation(
    data: InvitationAccept,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Accept an invitation. Requires authentication."""
    org = await invitation_service.accept_invitation(db, data.token, current_user.id)
    return success({"org_slug": org.slug, "org_name": org.name})
