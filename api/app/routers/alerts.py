from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.dependencies import get_current_org
from app.schemas.alert import (
    AlertEventOut,
    AlertHistoryResponse,
    AlertRuleCreate,
    AlertRuleOut,
    AlertRuleUpdate,
    AlertTemplatesResponse,
    AlertToggleRequest,
    BulkToggleRequest,
)
from app.services import alert_service, project_service
from app.utils.envelope import paginated, success
from app.utils.exceptions import ForbiddenError, NotFoundError

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


# =============================================================================
# Alert History Endpoints
# =============================================================================


@router.get("/history")
async def get_alert_history(
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, pattern="^(active|resolved|acknowledged)$"),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get alert event history with pagination and filtering.

    Returns a chronological list (most recent first) of all triggered alerts
    for the specified project. Each event includes the rule name, category,
    metric value at trigger, threshold, and current status.

    Query Parameters:
        offset: Number of records to skip (default: 0)
        limit: Maximum records to return (default: 20, max: 100)
        status: Filter by status (active/resolved/acknowledged)
        start_date: Filter events triggered after this date (ISO format)
        end_date: Filter events triggered before this date (ISO format)

    Multi-tenant isolation: Queries scoped by org_id and project_id.
    """
    project = await project_service.get_project_by_slug(db, org_id, project_slug)

    events, total = await alert_service.get_alert_history(
        db,
        org_id,
        project.id,
        offset=offset,
        limit=limit,
        status=status,
        start_date=start_date,
        end_date=end_date,
    )

    response = AlertHistoryResponse(
        events=events,
        total=total,
        offset=offset,
        limit=limit,
    )
    return success(response.model_dump(mode="json"))


@router.get("/history/{event_id}")
async def get_alert_event(
    event_id: uuid.UUID = Path(...),
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get details of a single alert event.

    Returns the full alert event including:
    - Event details (triggered_at, resolved_at, metric_value, threshold_value)
    - Rule configuration at trigger time (via rule_snapshot if available)
    - Notification delivery status

    Args:
        event_id: The alert event UUID

    Raises:
        404: If the event doesn't exist or doesn't belong to org/project
    """
    project = await project_service.get_project_by_slug(db, org_id, project_slug)

    try:
        event = await alert_service.get_alert_event(db, org_id, project.id, event_id)
        return success(event.model_dump(mode="json"))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/bulk-toggle")
async def bulk_toggle_alerts(
    data: BulkToggleRequest,
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Bulk toggle multiple alert rules on/off.

    Accepts a list of preset keys and a target state (active/inactive).
    Creates new rules with defaults if they don't exist (when activating).

    Args:
        data: BulkToggleRequest with preset_keys list and is_active state

    Returns:
        List of updated/created alert rules
    """
    project = await project_service.get_project_by_slug(db, org_id, project_slug)

    rules = await alert_service.bulk_toggle_alerts(
        db,
        org_id,
        project.id,
        preset_keys=data.preset_keys,
        is_active=data.is_active,
    )

    return success({
        "rules": [AlertRuleOut.model_validate(r).model_dump(mode="json") for r in rules],
        "count": len(rules),
    })


@router.delete("/rules/{preset_key}")
async def delete_custom_alert(
    preset_key: str = Path(...),
    org_slug: str = Path(...),
    project_slug: str = Path(...),
    org_id=Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete a custom alert rule.

    Only custom alerts (is_custom=True) can be deleted. Preset alerts
    can only be deactivated, not deleted.

    Deleting an alert also removes all associated alert events.

    Args:
        preset_key: The preset key of the alert to delete

    Raises:
        404: If the alert rule doesn't exist
        403: If attempting to delete a preset (non-custom) alert
    """
    project = await project_service.get_project_by_slug(db, org_id, project_slug)

    try:
        await alert_service.delete_custom_alert(db, org_id, project.id, preset_key)
        return success({"deleted": preset_key})
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ForbiddenError as e:
        raise HTTPException(status_code=403, detail=str(e))
