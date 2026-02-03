from __future__ import annotations

from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_org, require_role
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectOut
from app.services import project_service
from app.utils.envelope import success

router = APIRouter(
    prefix="/api/orgs/{org_slug}/projects",
    tags=["projects"],
)


@router.post("", status_code=201)
async def create_project(
    data: ProjectCreate,
    org_slug: str = Path(...),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    org_id=Depends(get_current_org),
) -> dict:
    """Create a new project under the organization. Admin only."""
    project = await project_service.create_project(db, data, org_id)
    return success(ProjectOut.model_validate(project).model_dump(mode="json"))


@router.get("")
async def list_projects(
    org_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all projects in the organization. Any member."""
    projects = await project_service.list_projects(db, org_id)
    return success(
        [ProjectOut.model_validate(p).model_dump(mode="json") for p in projects]
    )


@router.get("/{project_slug}")
async def get_project(
    project_slug: str = Path(...),
    org_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get project details by slug. Any member."""
    project = await project_service.get_project_by_slug(db, org_id, project_slug)
    return success(ProjectOut.model_validate(project).model_dump(mode="json"))
