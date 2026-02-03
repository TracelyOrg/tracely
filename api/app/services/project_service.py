from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.schemas.project import ProjectCreate
from app.utils.exceptions import NotFoundError
from app.utils.slugify import generate_unique_project_slug


async def create_project(
    db: AsyncSession, data: ProjectCreate, org_id: uuid.UUID
) -> Project:
    """Create a new project scoped to the given organization."""
    slug = await generate_unique_project_slug(db, data.name, org_id)

    project = Project(name=data.name, slug=slug, org_id=org_id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def list_projects(
    db: AsyncSession, org_id: uuid.UUID
) -> list[Project]:
    """Return all active projects for the given organization."""
    result = await db.execute(
        select(Project).where(
            Project.org_id == org_id,
            Project.is_active == True,  # noqa: E712
        )
    )
    return list(result.scalars().all())


async def get_project_by_slug(
    db: AsyncSession, org_id: uuid.UUID, slug: str
) -> Project:
    """Fetch a project by slug within an org, or raise NotFoundError."""
    result = await db.execute(
        select(Project).where(
            Project.org_id == org_id,
            Project.slug == slug,
            Project.is_active == True,  # noqa: E712
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise NotFoundError("Project not found")
    return project
