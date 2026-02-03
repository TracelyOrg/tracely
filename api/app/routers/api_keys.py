from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_org, require_role
from app.models.user import User
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreated, ApiKeyOut
from app.services import api_key_service, project_service
from app.utils.envelope import success

router = APIRouter(
    prefix="/api/orgs/{org_slug}/projects/{project_slug}/api-keys",
    tags=["api-keys"],
)


async def _resolve_project_id(
    project_slug: str, org_id: uuid.UUID, db: AsyncSession
) -> uuid.UUID:
    """Resolve project slug to project_id within the org."""
    project = await project_service.get_project_by_slug(db, org_id, project_slug)
    return project.id


@router.post("", status_code=201)
async def generate_api_key(
    data: ApiKeyCreate,
    project_slug: str = Path(...),
    org_slug: str = Path(...),
    current_user: User = Depends(require_role("admin")),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a new API key for the project. Admin only.

    The full key is returned once and never shown again.
    """
    project_id = await _resolve_project_id(project_slug, org_id, db)
    api_key, raw_key = await api_key_service.generate_api_key(
        db, project_id, org_id, name=data.name
    )
    return success(
        ApiKeyCreated(
            id=api_key.id,
            key=raw_key,
            prefix=api_key.key_prefix,
            name=api_key.name,
            created_at=api_key.created_at,
        ).model_dump(mode="json")
    )


@router.get("")
async def list_api_keys(
    project_slug: str = Path(...),
    org_slug: str = Path(...),
    current_user: User = Depends(require_role("admin")),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List API keys for the project (prefix + metadata only). Admin only."""
    project_id = await _resolve_project_id(project_slug, org_id, db)
    keys = await api_key_service.list_api_keys(db, project_id, org_id)
    return success(
        [
            ApiKeyOut(
                id=k.id,
                prefix=k.key_prefix,
                name=k.name,
                last_used_at=k.last_used_at,
                created_at=k.created_at,
            ).model_dump(mode="json")
            for k in keys
        ]
    )


@router.delete("/{key_id}", status_code=200)
async def revoke_api_key(
    key_id: uuid.UUID,
    project_slug: str = Path(...),
    org_slug: str = Path(...),
    current_user: User = Depends(require_role("admin")),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Revoke an API key. Admin only."""
    await api_key_service.revoke_api_key(db, key_id, org_id)
    return success({"message": "API key revoked"})
