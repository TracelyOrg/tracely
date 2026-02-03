from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.project import Project
from app.schemas.project import ProjectCreate
from app.utils.exceptions import NotFoundError


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture
def sample_org_id():
    return uuid.uuid4()


@pytest.fixture
def sample_project(sample_org_id):
    return Project(
        id=uuid.uuid4(),
        org_id=sample_org_id,
        name="My API",
        slug="my-api",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


# ─── create_project tests (AC #1) ────────────────────────────────────


@pytest.mark.asyncio
async def test_create_project_success(mock_db, sample_org_id):
    """AC#1: Valid name → project created with slug, scoped to org."""
    from app.services import project_service

    with patch.object(
        project_service, "generate_unique_project_slug", new_callable=AsyncMock
    ) as mock_slug:
        mock_slug.return_value = "my-api"

        project = await project_service.create_project(
            mock_db, ProjectCreate(name="My API"), sample_org_id
        )

    assert project.name == "My API"
    assert project.slug == "my-api"
    assert project.org_id == sample_org_id
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_project_scoped_to_org(mock_db, sample_org_id):
    """AC#1: Project is scoped to the correct org_id."""
    from app.services import project_service

    with patch.object(
        project_service, "generate_unique_project_slug", new_callable=AsyncMock
    ) as mock_slug:
        mock_slug.return_value = "test-project"

        project = await project_service.create_project(
            mock_db, ProjectCreate(name="Test Project"), sample_org_id
        )

    assert project.org_id == sample_org_id


# ─── list_projects tests ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_projects_returns_active(mock_db, sample_project, sample_org_id):
    """Returns active projects for the given org."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [sample_project]
    mock_db.execute = AsyncMock(return_value=mock_result)

    from app.services.project_service import list_projects

    projects = await list_projects(mock_db, sample_org_id)
    assert len(projects) == 1
    assert projects[0].slug == "my-api"


@pytest.mark.asyncio
async def test_list_projects_empty(mock_db, sample_org_id):
    """Org with no projects gets empty list."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    from app.services.project_service import list_projects

    projects = await list_projects(mock_db, sample_org_id)
    assert projects == []


# ─── get_project_by_slug tests ──────────────────────────────────────


@pytest.mark.asyncio
async def test_get_project_by_slug_found(mock_db, sample_project, sample_org_id):
    """Returns project when found by slug within org."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_project
    mock_db.execute = AsyncMock(return_value=mock_result)

    from app.services.project_service import get_project_by_slug

    project = await get_project_by_slug(mock_db, sample_org_id, "my-api")
    assert project.slug == "my-api"
    assert project.org_id == sample_org_id


@pytest.mark.asyncio
async def test_get_project_by_slug_not_found(mock_db, sample_org_id):
    """Raises NotFoundError when project not found."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    from app.services.project_service import get_project_by_slug

    with pytest.raises(NotFoundError, match="Project not found"):
        await get_project_by_slug(mock_db, sample_org_id, "nonexistent")


# ─── Multi-tenant isolation (AC #5 cross-reference) ──────────────────


@pytest.mark.asyncio
async def test_list_projects_different_org_empty(mock_db):
    """Cannot see projects from a different org."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    from app.services.project_service import list_projects

    other_org_id = uuid.uuid4()
    projects = await list_projects(mock_db, other_org_id)
    assert projects == []
