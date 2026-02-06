from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_org
from app.schemas.alert import (
    AlertRuleCreate,
    AlertRuleOut,
    AlertRuleUpdate,
    AlertTemplatesResponse,
    AlertToggleRequest,
)
from app.services import alert_service, project_service
from app.utils.envelope import success

router = APIRouter(
    prefix="/api/orgs/{org_slug}/projects/{project_slug}/alerts",
    tags=["alerts"],
)


@router.get("/templates")
async def get_alert_templates(
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get all alert templates with user's activation status.

    Returns the preset alert templates merged with the user's
    activation status and any custom thresholds for this project.

    Templates are organized by category:
    - Availability: High Error Rate, Service Down
    - Performance: Slow Responses, Latency Spike
    - Volume: Traffic Drop, Traffic Surge

    Each template includes:
    - Preset defaults (threshold, duration, comparison)
    - User's current settings (is_active, custom thresholds)

    Multi-tenant isolation: Queries scoped by org_id and project_id.
    """
    # Get project by slug to get the UUID
    project = await project_service.get_project_by_slug(db, org_id, project_slug)

    # Fetch templates with user's activation status
    templates = await alert_service.get_templates_with_status(db, org_id, project.id)

    # Return wrapped in response schema
    response = AlertTemplatesResponse(templates=templates)
    return success(response.model_dump(mode="json"))


@router.post("/rules", status_code=201)
async def create_alert_rule(
    data: AlertRuleCreate,
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create or update an alert rule for a preset.

    Activates a preset alert template with optional custom thresholds.
    If the rule already exists, it will be updated.

    Args:
        data: Alert rule creation data with preset_key and optional thresholds

    Returns:
        The created/updated alert rule
    """
    project = await project_service.get_project_by_slug(db, org_id, project_slug)
    rule = await alert_service.create_or_update_alert_rule(db, org_id, project.id, data)
    return success(AlertRuleOut.model_validate(rule).model_dump(mode="json"))


@router.post("/rules/toggle")
async def toggle_alert(
    data: AlertToggleRequest,
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Toggle an alert rule on/off.

    If the alert rule exists, toggles its is_active status.
    If it doesn't exist, creates a new active rule with preset defaults.

    Args:
        data: Toggle request with preset_key

    Returns:
        The toggled alert rule with new is_active status
    """
    project = await project_service.get_project_by_slug(db, org_id, project_slug)
    rule = await alert_service.toggle_alert_rule(db, org_id, project.id, data.preset_key)
    return success(AlertRuleOut.model_validate(rule).model_dump(mode="json"))


@router.put("/rules/{rule_id}")
async def update_alert_rule(
    data: AlertRuleUpdate,
    rule_id: uuid.UUID = Path(...),
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update an alert rule's threshold, duration, or activation status.

    Args:
        rule_id: The alert rule ID to update
        data: Update data with optional threshold_value, duration_seconds, is_active

    Returns:
        The updated alert rule
    """
    project = await project_service.get_project_by_slug(db, org_id, project_slug)
    rule = await alert_service.update_alert_rule(
        db,
        org_id,
        project.id,
        rule_id,
        threshold_value=data.threshold_value,
        duration_seconds=data.duration_seconds,
        is_active=data.is_active,
    )
    return success(AlertRuleOut.model_validate(rule).model_dump(mode="json"))


@router.post("/rules/{rule_id}/reset")
async def reset_alert_to_defaults(
    rule_id: uuid.UUID = Path(...),
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reset an alert rule to its preset defaults.

    Restores the threshold and duration to the original preset values
    and clears the is_custom flag.

    Args:
        rule_id: The alert rule ID to reset

    Returns:
        The reset alert rule
    """
    project = await project_service.get_project_by_slug(db, org_id, project_slug)
    rule = await alert_service.reset_alert_rule_to_defaults(db, org_id, project.id, rule_id)
    return success(AlertRuleOut.model_validate(rule).model_dump(mode="json"))
