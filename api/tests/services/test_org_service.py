from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.schemas.organization import OrgCreate
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
def sample_org():
    return Organization(
        id=uuid.uuid4(),
        name="Acme Corp",
        slug="acme-corp",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


# ─── create_organization tests (AC #1, #2, #3) ──────────────────────


@pytest.mark.asyncio
async def test_create_organization_creates_org_and_admin(mock_db):
    """AC#1 + AC#2: creates org with slug and assigns admin role."""
    from app.services import org_service

    user_id = uuid.uuid4()

    with patch.object(
        org_service, "generate_unique_slug", new_callable=AsyncMock
    ) as mock_slug:
        mock_slug.return_value = "acme-corp"

        org, member = await org_service.create_organization(
            mock_db, OrgCreate(name="Acme Corp"), user_id
        )

    assert org.name == "Acme Corp"
    assert org.slug == "acme-corp"
    assert member.user_id == user_id
    assert member.role == "admin"
    mock_db.commit.assert_awaited_once()


# ─── list_user_organizations tests ───────────────────────────────────


@pytest.mark.asyncio
async def test_list_user_organizations_returns_orgs(mock_db, sample_org):
    """User sees only orgs they belong to."""
    mock_result = MagicMock()
    # Service uses result.all() which returns row tuples: (Organization, role, member_count, project_count)
    mock_result.all.return_value = [(sample_org, "admin", 1, 0)]
    mock_db.execute = AsyncMock(return_value=mock_result)

    from app.services.org_service import list_user_organizations

    orgs = await list_user_organizations(mock_db, uuid.uuid4())
    assert len(orgs) == 1
    assert orgs[0].org.slug == "acme-corp"
    assert orgs[0].user_role == "admin"


@pytest.mark.asyncio
async def test_list_user_organizations_empty(mock_db):
    """User with no orgs gets empty list."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    from app.services.org_service import list_user_organizations

    orgs = await list_user_organizations(mock_db, uuid.uuid4())
    assert orgs == []


# ─── get_org_by_slug tests ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_org_by_slug_found(mock_db, sample_org):
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_org
    mock_db.execute = AsyncMock(return_value=mock_result)

    from app.services.org_service import get_org_by_slug

    org = await get_org_by_slug(mock_db, "acme-corp")
    assert org.slug == "acme-corp"


@pytest.mark.asyncio
async def test_get_org_by_slug_not_found(mock_db):
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    from app.services.org_service import get_org_by_slug

    with pytest.raises(NotFoundError, match="Organization not found"):
        await get_org_by_slug(mock_db, "does-not-exist")
