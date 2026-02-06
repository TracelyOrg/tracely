"""Alert service for managing alert rules and templates."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_rule import AlertRule
from app.schemas.alert import AlertRuleCreate, AlertTemplateOut
from app.services.alert_presets import ALERT_PRESETS, get_all_presets
from app.utils.exceptions import ConflictError, NotFoundError


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
