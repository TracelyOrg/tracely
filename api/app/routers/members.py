from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import require_role
from app.models.user import User
from app.schemas.member import MemberOut, RoleUpdate
from app.services import org_service
from app.utils.envelope import success

router = APIRouter(tags=["members"])


@router.get("/api/orgs/{org_slug}/members")
async def list_members(
    org_slug: str,
    current_user: User = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all members of an organization. Any member role can access."""
    org = await org_service.get_org_by_slug(db, org_slug)
    members = await org_service.list_members(db, org.id)
    return success(
        [MemberOut(**m).model_dump(mode="json") for m in members]
    )


@router.put("/api/orgs/{org_slug}/members/{member_id}/role")
async def update_member_role(
    org_slug: str,
    member_id: uuid.UUID,
    data: RoleUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Change a member's role. Admin only. Protects last admin."""
    org = await org_service.get_org_by_slug(db, org_slug)
    member = await org_service.update_member_role(db, org.id, member_id, data.role)
    return success({"id": str(member.id), "role": member.role})


@router.delete("/api/orgs/{org_slug}/members/{member_id}")
async def remove_member(
    org_slug: str,
    member_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Remove a member from the organization. Admin only. Protects last admin."""
    org = await org_service.get_org_by_slug(db, org_slug)
    await org_service.remove_member(db, org.id, member_id)
    return success({"message": "Member removed from organization"})
