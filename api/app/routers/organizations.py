from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.organization import OrgCreate, OrgMemberOut, OrgOut, OrgUpdate
from app.services import org_service
from app.utils.envelope import success

router = APIRouter(prefix="/api/orgs", tags=["organizations"])


@router.post("", status_code=201)
async def create_org(
    data: OrgCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a new organization. The caller becomes admin."""
    org, member = await org_service.create_organization(db, data, current_user.id)
    return success(
        {
            "organization": OrgOut.model_validate(org).model_dump(mode="json"),
            "member": OrgMemberOut.model_validate(member).model_dump(mode="json"),
        }
    )


@router.get("")
async def list_orgs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all organizations the current user belongs to."""
    enriched = await org_service.list_user_organizations(db, current_user.id)
    return success(
        [
            OrgOut(
                id=item.org.id,
                name=item.org.name,
                slug=item.org.slug,
                member_count=item.member_count,
                project_count=item.project_count,
                user_role=item.user_role,
                created_at=item.org.created_at,
            ).model_dump(mode="json")
            for item in enriched
        ]
    )


@router.get("/{org_slug}")
async def get_org(
    org_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get organization details. Requires membership."""
    from app.models.org_member import OrgMember
    from sqlalchemy import select

    org = await org_service.get_org_by_slug(db, org_slug)

    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org.id,
            OrgMember.user_id == current_user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        from app.utils.exceptions import ForbiddenError

        raise ForbiddenError("Not a member of this organization")

    return success(
        OrgOut(
            id=org.id,
            name=org.name,
            slug=org.slug,
            user_role=member.role,
            created_at=org.created_at,
        ).model_dump(mode="json")
    )


@router.put("/{org_slug}/settings")
async def update_org_settings(
    org_slug: str,
    data: OrgUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update organization settings. Admin only."""
    org = await org_service.get_org_by_slug(db, org_slug)
    updated = await org_service.update_organization(db, org.id, data)
    return success(
        OrgOut(
            id=updated.id,
            name=updated.name,
            slug=updated.slug,
            created_at=updated.created_at,
        ).model_dump(mode="json")
    )
