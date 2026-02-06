"""Alert service for managing alert rules and templates."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_event import AlertEvent
from app.models.alert_rule import AlertRule
from app.schemas.alert import AlertEventOut, AlertRuleCreate, AlertTemplateOut
from app.services.alert_presets import ALERT_PRESETS, get_all_presets
from app.utils.exceptions import ConflictError, ForbiddenError, NotFoundError


async def get_templates_with_status(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
) -> list[AlertTemplateOut]:
    """Get all alert templates merged with user's activation status.

    Returns the preset templates with is_active=True and custom thresholds
    if the user has activated them for this project.

    Args:
        db: Database session
        org_id: Organization ID for multi-tenant scoping
        project_id: Project ID

    Returns:
        List of AlertTemplateOut with activation status merged from DB
    """
    # Fetch all user's alert rules for this project
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.org_id == org_id,
            AlertRule.project_id == project_id,
        )
    )
    user_rules = {rule.preset_key: rule for rule in result.scalars().all()}

    # Merge presets with user's rules
    templates: list[AlertTemplateOut] = []
    for preset in get_all_presets():
        user_rule = user_rules.get(preset.key)

        if user_rule:
            # User has activated this preset - include their settings
            template = AlertTemplateOut(
                key=preset.key,
                name=preset.name,
                category=preset.category,
                description=preset.description,
                default_threshold=preset.default_threshold,
                default_duration=preset.default_duration,
                comparison=preset.comparison,
                metric=preset.metric,
                is_active=user_rule.is_active,
                custom_threshold=user_rule.threshold_value if user_rule.is_custom else None,
                custom_duration=user_rule.duration_seconds if user_rule.is_custom else None,
                rule_id=user_rule.id,
            )
        else:
            # Preset not activated - show defaults with is_active=False
            template = AlertTemplateOut(
                key=preset.key,
                name=preset.name,
                category=preset.category,
                description=preset.description,
                default_threshold=preset.default_threshold,
                default_duration=preset.default_duration,
                comparison=preset.comparison,
                metric=preset.metric,
                is_active=False,
                rule_id=None,
            )

        templates.append(template)

    return templates


async def create_or_update_alert_rule(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    data: AlertRuleCreate,
) -> AlertRule:
    """Create or update an alert rule for a preset.

    Args:
        db: Database session
        org_id: Organization ID
        project_id: Project ID
        data: Alert rule creation data

    Returns:
        The created or updated AlertRule

    Raises:
        NotFoundError: If the preset_key doesn't exist
    """
    # Validate preset exists
    preset = ALERT_PRESETS.get(data.preset_key)
    if preset is None:
        raise NotFoundError(f"Alert preset '{data.preset_key}' not found")

    # Check if rule already exists
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.org_id == org_id,
            AlertRule.project_id == project_id,
            AlertRule.preset_key == data.preset_key,
        )
    )
    existing = result.scalar_one_or_none()

    # Determine threshold and duration values
    threshold = data.threshold_value if data.threshold_value is not None else preset.default_threshold
    duration = data.duration_seconds if data.duration_seconds is not None else preset.default_duration
    is_custom = (
        data.threshold_value is not None and data.threshold_value != preset.default_threshold
    ) or (
        data.duration_seconds is not None and data.duration_seconds != preset.default_duration
    )

    if existing:
        # Update existing rule
        existing.threshold_value = threshold
        existing.duration_seconds = duration
        existing.is_active = data.is_active
        existing.is_custom = is_custom
        await db.commit()
        await db.refresh(existing)
        return existing

    # Create new rule
    rule = AlertRule(
        org_id=org_id,
        project_id=project_id,
        preset_key=preset.key,
        name=preset.name,
        category=preset.category,
        description=preset.description,
        threshold_value=threshold,
        duration_seconds=duration,
        comparison_operator=preset.comparison,
        is_active=data.is_active,
        is_custom=is_custom,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def get_active_rules(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
) -> list[AlertRule]:
    """Get all active alert rules for a project.

    Args:
        db: Database session
        org_id: Organization ID for multi-tenant scoping
        project_id: Project ID

    Returns:
        List of active AlertRule objects
    """
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.org_id == org_id,
            AlertRule.project_id == project_id,
            AlertRule.is_active == True,  # noqa: E712
        )
    )
    return list(result.scalars().all())


async def get_alert_rule(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
) -> AlertRule:
    """Get an alert rule by ID with org/project scoping.

    Args:
        db: Database session
        org_id: Organization ID for multi-tenant scoping
        project_id: Project ID
        rule_id: Alert rule ID

    Returns:
        The AlertRule object

    Raises:
        NotFoundError: If the rule doesn't exist or doesn't belong to org/project
    """
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.id == rule_id,
            AlertRule.org_id == org_id,
            AlertRule.project_id == project_id,
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise NotFoundError("Alert rule not found")
    return rule


async def update_alert_rule(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    threshold_value: float | None = None,
    duration_seconds: int | None = None,
    is_active: bool | None = None,
) -> AlertRule:
    """Update an existing alert rule.

    Args:
        db: Database session
        org_id: Organization ID for multi-tenant scoping
        project_id: Project ID
        rule_id: Alert rule ID
        threshold_value: New threshold value (optional)
        duration_seconds: New duration in seconds (optional)
        is_active: New activation status (optional)

    Returns:
        The updated AlertRule object

    Raises:
        NotFoundError: If the rule doesn't exist or doesn't belong to org/project
    """
    rule = await get_alert_rule(db, org_id, project_id, rule_id)

    # Get preset to determine if custom values are being used
    preset = ALERT_PRESETS.get(rule.preset_key)

    # Update fields if provided
    if threshold_value is not None:
        rule.threshold_value = threshold_value
    if duration_seconds is not None:
        rule.duration_seconds = duration_seconds
    if is_active is not None:
        rule.is_active = is_active

    # Determine if rule has custom values
    if preset:
        rule.is_custom = (
            rule.threshold_value != preset.default_threshold
            or rule.duration_seconds != preset.default_duration
        )

    await db.commit()
    await db.refresh(rule)
    return rule


async def toggle_alert_rule(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    preset_key: str,
) -> AlertRule:
    """Toggle an alert rule's activation status.

    If the rule exists, toggles is_active. If not, creates it as active.

    Args:
        db: Database session
        org_id: Organization ID
        project_id: Project ID
        preset_key: The preset key to toggle

    Returns:
        The toggled AlertRule

    Raises:
        NotFoundError: If the preset_key doesn't exist
    """
    preset = ALERT_PRESETS.get(preset_key)
    if preset is None:
        raise NotFoundError(f"Alert preset '{preset_key}' not found")

    # Check if rule already exists
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.org_id == org_id,
            AlertRule.project_id == project_id,
            AlertRule.preset_key == preset_key,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Toggle existing rule
        existing.is_active = not existing.is_active
        await db.commit()
        await db.refresh(existing)
        return existing

    # Create new active rule with defaults
    rule = AlertRule(
        org_id=org_id,
        project_id=project_id,
        preset_key=preset.key,
        name=preset.name,
        category=preset.category,
        description=preset.description,
        threshold_value=preset.default_threshold,
        duration_seconds=preset.default_duration,
        comparison_operator=preset.comparison,
        is_active=True,
        is_custom=False,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def reset_alert_rule_to_defaults(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
) -> AlertRule:
    """Reset an alert rule to its preset defaults.

    Args:
        db: Database session
        org_id: Organization ID
        project_id: Project ID
        rule_id: Alert rule ID

    Returns:
        The reset AlertRule

    Raises:
        NotFoundError: If the rule or preset doesn't exist
    """
    rule = await get_alert_rule(db, org_id, project_id, rule_id)

    preset = ALERT_PRESETS.get(rule.preset_key)
    if preset is None:
        raise NotFoundError(f"Alert preset '{rule.preset_key}' not found")

    rule.threshold_value = preset.default_threshold
    rule.duration_seconds = preset.default_duration
    rule.is_custom = False

    await db.commit()
    await db.refresh(rule)
    return rule


# =============================================================================
# Alert History (Events) Functions
# =============================================================================


async def get_alert_history(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    offset: int = 0,
    limit: int = 20,
    status: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> tuple[list[AlertEventOut], int]:
    """Get alert event history with pagination and filtering.

    Args:
        db: Database session
        org_id: Organization ID for multi-tenant scoping
        project_id: Project ID
        offset: Number of records to skip
        limit: Maximum number of records to return
        status: Filter by event status (active/resolved/acknowledged)
        start_date: Filter events triggered after this date
        end_date: Filter events triggered before this date

    Returns:
        Tuple of (list of AlertEventOut, total count)
    """
    # Build base query with join to alert_rules
    base_conditions = [
        AlertEvent.org_id == org_id,
        AlertEvent.project_id == project_id,
    ]

    # Apply filters
    if status:
        base_conditions.append(AlertEvent.status == status)
    if start_date:
        base_conditions.append(AlertEvent.triggered_at >= start_date)
    if end_date:
        base_conditions.append(AlertEvent.triggered_at <= end_date)

    # Count total matching records
    count_query = select(func.count()).select_from(AlertEvent).where(*base_conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch paginated events with rule info joined
    query = (
        select(AlertEvent, AlertRule)
        .join(AlertRule, AlertEvent.rule_id == AlertRule.id)
        .where(*base_conditions)
        .order_by(AlertEvent.triggered_at.desc())
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    # Transform to AlertEventOut
    events = []
    for event, rule in rows:
        event_out = AlertEventOut(
            id=event.id,
            rule_id=event.rule_id,
            org_id=event.org_id,
            project_id=event.project_id,
            triggered_at=event.triggered_at,
            resolved_at=event.resolved_at,
            metric_value=event.metric_value,
            threshold_value=event.threshold_value,
            status=event.status,
            notification_sent=event.notification_sent,
            rule_snapshot=getattr(event, "rule_snapshot", None),
            rule_name=rule.name,
            rule_category=rule.category,
            rule_preset_key=rule.preset_key,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )
        events.append(event_out)

    return events, total


async def get_alert_event(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    event_id: uuid.UUID,
) -> AlertEventOut:
    """Get a single alert event with rule info.

    Args:
        db: Database session
        org_id: Organization ID for multi-tenant scoping
        project_id: Project ID
        event_id: Alert event ID

    Returns:
        AlertEventOut with rule details

    Raises:
        NotFoundError: If the event doesn't exist or doesn't belong to org/project
    """
    query = (
        select(AlertEvent, AlertRule)
        .join(AlertRule, AlertEvent.rule_id == AlertRule.id)
        .where(
            AlertEvent.id == event_id,
            AlertEvent.org_id == org_id,
            AlertEvent.project_id == project_id,
        )
    )

    result = await db.execute(query)
    row = result.first()

    if row is None:
        raise NotFoundError("Alert event not found")

    event, rule = row

    return AlertEventOut(
        id=event.id,
        rule_id=event.rule_id,
        org_id=event.org_id,
        project_id=event.project_id,
        triggered_at=event.triggered_at,
        resolved_at=event.resolved_at,
        metric_value=event.metric_value,
        threshold_value=event.threshold_value,
        status=event.status,
        notification_sent=event.notification_sent,
        rule_snapshot=getattr(event, "rule_snapshot", None),
        rule_name=rule.name,
        rule_category=rule.category,
        rule_preset_key=rule.preset_key,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


async def bulk_toggle_alerts(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    preset_keys: list[str],
    is_active: bool,
) -> list[AlertRule]:
    """Bulk toggle multiple alert rules on/off.

    Args:
        db: Database session
        org_id: Organization ID
        project_id: Project ID
        preset_keys: List of preset keys to toggle
        is_active: Target activation state

    Returns:
        List of updated AlertRule objects
    """
    updated_rules = []

    for preset_key in preset_keys:
        preset = ALERT_PRESETS.get(preset_key)
        if preset is None:
            continue  # Skip invalid presets

        # Check if rule exists
        result = await db.execute(
            select(AlertRule).where(
                AlertRule.org_id == org_id,
                AlertRule.project_id == project_id,
                AlertRule.preset_key == preset_key,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.is_active = is_active
            updated_rules.append(existing)
        elif is_active:
            # Create new rule if activating and doesn't exist
            rule = AlertRule(
                org_id=org_id,
                project_id=project_id,
                preset_key=preset.key,
                name=preset.name,
                category=preset.category,
                description=preset.description,
                threshold_value=preset.default_threshold,
                duration_seconds=preset.default_duration,
                comparison_operator=preset.comparison,
                is_active=True,
                is_custom=False,
            )
            db.add(rule)
            updated_rules.append(rule)

    await db.commit()
    for rule in updated_rules:
        await db.refresh(rule)

    return updated_rules


async def delete_custom_alert(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    preset_key: str,
) -> None:
    """Delete a custom alert rule.

    Only custom alerts (is_custom=True) can be deleted. Preset alerts
    can only be deactivated, not deleted.

    Args:
        db: Database session
        org_id: Organization ID
        project_id: Project ID
        preset_key: The preset key to delete

    Raises:
        NotFoundError: If the rule doesn't exist
        ForbiddenError: If attempting to delete a non-custom (preset) alert
    """
    # Find the rule
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.org_id == org_id,
            AlertRule.project_id == project_id,
            AlertRule.preset_key == preset_key,
        )
    )
    rule = result.scalar_one_or_none()

    if rule is None:
        raise NotFoundError(f"Alert rule '{preset_key}' not found")

    # Check if it's a custom alert
    if not rule.is_custom:
        raise ForbiddenError("Only custom alerts can be deleted. Preset alerts can be deactivated.")

    # Delete associated events (or mark as orphaned - we'll cascade delete)
    await db.execute(
        delete(AlertEvent).where(AlertEvent.rule_id == rule.id)
    )

    # Delete the rule
    await db.delete(rule)
    await db.commit()


async def create_alert_event(
    db: AsyncSession,
    rule: AlertRule,
    metric_value: float,
) -> AlertEvent:
    """Create a new alert event when a threshold is breached.

    Stores a snapshot of the rule configuration at the time of trigger
    for audit trail purposes.

    Args:
        db: Database session
        rule: The AlertRule that triggered
        metric_value: The metric value that caused the breach

    Returns:
        The created AlertEvent with rule_snapshot populated
    """
    # Create rule snapshot for audit trail
    rule_snapshot = {
        "id": str(rule.id),
        "preset_key": rule.preset_key,
        "name": rule.name,
        "category": rule.category,
        "description": rule.description,
        "threshold_value": rule.threshold_value,
        "duration_seconds": rule.duration_seconds,
        "comparison_operator": rule.comparison_operator,
        "is_custom": rule.is_custom,
    }

    event = AlertEvent(
        rule_id=rule.id,
        org_id=rule.org_id,
        project_id=rule.project_id,
        metric_value=metric_value,
        threshold_value=rule.threshold_value,
        status="active",
        notification_sent=False,
        rule_snapshot=rule_snapshot,
    )

    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def resolve_alert_event(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> AlertEvent:
    """Mark an alert event as resolved.

    Args:
        db: Database session
        event_id: The alert event ID to resolve

    Returns:
        The updated AlertEvent

    Raises:
        NotFoundError: If the event doesn't exist
    """
    result = await db.execute(
        select(AlertEvent).where(AlertEvent.id == event_id)
    )
    event = result.scalar_one_or_none()

    if event is None:
        raise NotFoundError("Alert event not found")

    event.status = "resolved"
    event.resolved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(event)
    return event


async def acknowledge_alert_event(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> AlertEvent:
    """Mark an alert event as acknowledged.

    Args:
        db: Database session
        event_id: The alert event ID to acknowledge

    Returns:
        The updated AlertEvent

    Raises:
        NotFoundError: If the event doesn't exist
    """
    result = await db.execute(
        select(AlertEvent).where(AlertEvent.id == event_id)
    )
    event = result.scalar_one_or_none()

    if event is None:
        raise NotFoundError("Alert event not found")

    event.status = "acknowledged"

    await db.commit()
    await db.refresh(event)
    return event
