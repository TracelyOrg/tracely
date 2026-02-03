from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.organization import OrgCreate, OrgMemberOut, OrgOut
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
    orgs = await org_service.list_user_organizations(db, current_user.id)
    return success(
        [OrgOut.model_validate(o).model_dump(mode="json") for o in orgs]
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

    return success(OrgOut.model_validate(org).model_dump(mode="json"))
