"""Background scheduler for threshold alert evaluation.

Runs every 60 seconds to evaluate all active threshold alerts:
- slow_responses
- latency_spike
- traffic_drop
- traffic_surge

Uses ClickHouse metrics_1m aggregations for efficient querying.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import async_session_factory
from app.models.alert_rule import AlertRule
from app.services import alert_evaluator

logger = logging.getLogger(__name__)

# Evaluation interval in seconds
EVALUATION_INTERVAL = 60

# Global flag to control scheduler
_scheduler_running = False
_scheduler_task: asyncio.Task | None = None


async def _get_active_threshold_alerts(db: AsyncSession) -> list[AlertRule]:
    """Fetch all active threshold alerts from the database.

    Args:
        db: Database session

    Returns:
        List of active AlertRule objects for threshold alerts
    """
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.is_active == True,  # noqa: E712
            AlertRule.preset_key.in_(alert_evaluator.THRESHOLD_ALERTS),
        )
    )
    return list(result.scalars().all())


async def _evaluate_threshold_alerts():
    """Evaluate all active threshold alerts.

    This function runs on a schedule and evaluates each threshold alert
    against the ClickHouse metrics_1m aggregations.
    """
    logger.debug("Starting threshold alert evaluation cycle")

    try:
        async with async_session_factory() as db:
            # Fetch all active threshold alerts
            alerts = await _get_active_threshold_alerts(db)

            if not alerts:
                logger.debug("No active threshold alerts to evaluate")
                return

            logger.info("Evaluating %d threshold alerts", len(alerts))

            for rule in alerts:
                try:
                    # Evaluate the alert condition
                    result = await alert_evaluator.evaluate_alert_rule(rule)

                    if result.is_triggered:
                        # Fire the alert (handles cooldown internally)
                        await alert_evaluator.fire_alert(db, rule, result)
                    else:
                        # Check if we need to resolve an active alert
                        await alert_evaluator.resolve_alert(db, rule)

                except Exception as e:
                    logger.error(
                        "Error evaluating alert rule %s: %s",
                        rule.id,
                        e,
                        exc_info=True,
                    )

    except Exception as e:
        logger.error("Error in threshold alert evaluation cycle: %s", e, exc_info=True)


async def _scheduler_loop():
    """Main scheduler loop that runs alert evaluation every 60 seconds."""
    global _scheduler_running

    logger.info("Alert scheduler started (interval: %ds)", EVALUATION_INTERVAL)

    while _scheduler_running:
        try:
            await _evaluate_threshold_alerts()
        except Exception as e:
            logger.error("Scheduler error: %s", e, exc_info=True)

        # Wait for next cycle
        await asyncio.sleep(EVALUATION_INTERVAL)

    logger.info("Alert scheduler stopped")


def start_scheduler():
    """Start the background alert scheduler.

    Should be called during application startup (in lifespan).
    """
    global _scheduler_running, _scheduler_task

    if _scheduler_running:
        logger.warning("Alert scheduler already running")
        return

    _scheduler_running = True
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("Alert scheduler started")


async def stop_scheduler():
    """Stop the background alert scheduler.

    Should be called during application shutdown (in lifespan).
    """
    global _scheduler_running, _scheduler_task

    if not _scheduler_running:
        return

    _scheduler_running = False

    if _scheduler_task:
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
        _scheduler_task = None

    logger.info("Alert scheduler stopped")


@asynccontextmanager
async def scheduler_lifespan() -> AsyncIterator[None]:
    """Context manager for scheduler lifecycle.

    Usage in FastAPI:
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            async with scheduler_lifespan():
                yield
    """
    start_scheduler()
    try:
        yield
    finally:
        await stop_scheduler()
