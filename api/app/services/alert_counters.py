"""Redis-based in-memory counters for critical alert evaluation.

Provides sliding window counters for error rate and request count tracking.
Used for inline evaluation during span ingestion (AR7 hybrid approach).

Key patterns:
- alert:counter:{project_id}:errors:{minute}
- alert:counter:{project_id}:requests:{minute}
- alert:cooldown:{rule_id}
"""
from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

from app.db.redis import get_redis

logger = logging.getLogger(__name__)

# Counter TTL in seconds (10 minutes for cleanup of stale data)
COUNTER_TTL = 600

# Cooldown TTL in seconds (5 minutes default)
COOLDOWN_TTL = 300


def _get_minute_key() -> int:
    """Get current minute as Unix timestamp (floored to minute)."""
    return int(time.time()) // 60


def _counter_key(project_id: uuid.UUID, metric: str, minute: int) -> str:
    """Build Redis key for a counter."""
    return f"alert:counter:{project_id}:{metric}:{minute}"


def _cooldown_key(rule_id: uuid.UUID) -> str:
    """Build Redis key for cooldown tracking."""
    return f"alert:cooldown:{rule_id}"


async def increment_error_count(project_id: uuid.UUID) -> int:
    """Increment error counter for current minute.

    Args:
        project_id: Project ID

    Returns:
        New counter value
    """
    client = get_redis()
    minute = _get_minute_key()
    key = _counter_key(project_id, "errors", minute)

    try:
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, COUNTER_TTL)
        results = await pipe.execute()
        return results[0]  # Return the incremented value
    except Exception:
        logger.warning("Failed to increment error counter for project %s", project_id)
        return 0


async def increment_request_count(project_id: uuid.UUID) -> int:
    """Increment request counter for current minute.

    Args:
        project_id: Project ID

    Returns:
        New counter value
    """
    client = get_redis()
    minute = _get_minute_key()
    key = _counter_key(project_id, "requests", minute)

    try:
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, COUNTER_TTL)
        results = await pipe.execute()
        return results[0]
    except Exception:
        logger.warning("Failed to increment request counter for project %s", project_id)
        return 0


async def get_error_count(project_id: uuid.UUID, window_minutes: int = 5) -> int:
    """Get total error count over the sliding window.

    Args:
        project_id: Project ID
        window_minutes: Number of minutes to look back (default 5)

    Returns:
        Total error count over the window
    """
    client = get_redis()
    current_minute = _get_minute_key()

    keys = [
        _counter_key(project_id, "errors", current_minute - i)
        for i in range(window_minutes)
    ]

    try:
        values = await client.mget(keys)
        return sum(int(v) for v in values if v is not None)
    except Exception:
        logger.warning("Failed to get error count for project %s", project_id)
        return 0


async def get_request_count(project_id: uuid.UUID, window_minutes: int = 5) -> int:
    """Get total request count over the sliding window.

    Args:
        project_id: Project ID
        window_minutes: Number of minutes to look back (default 5)

    Returns:
        Total request count over the window
    """
    client = get_redis()
    current_minute = _get_minute_key()

    keys = [
        _counter_key(project_id, "requests", current_minute - i)
        for i in range(window_minutes)
    ]

    try:
        values = await client.mget(keys)
        return sum(int(v) for v in values if v is not None)
    except Exception:
        logger.warning("Failed to get request count for project %s", project_id)
        return 0


async def get_error_rate(project_id: uuid.UUID, window_minutes: int = 5) -> float:
    """Calculate error rate as percentage over the sliding window.

    Args:
        project_id: Project ID
        window_minutes: Number of minutes to look back (default 5)

    Returns:
        Error rate as percentage (0-100)
    """
    error_count = await get_error_count(project_id, window_minutes)
    request_count = await get_request_count(project_id, window_minutes)

    if request_count == 0:
        return 0.0

    return (error_count / request_count) * 100


async def is_in_cooldown(rule_id: uuid.UUID) -> bool:
    """Check if an alert rule is currently in cooldown.

    Args:
        rule_id: Alert rule ID

    Returns:
        True if in cooldown, False otherwise
    """
    client = get_redis()
    key = _cooldown_key(rule_id)

    try:
        exists = await client.exists(key)
        return exists > 0
    except Exception:
        logger.warning("Failed to check cooldown for rule %s", rule_id)
        return False


async def set_cooldown(rule_id: uuid.UUID, ttl_seconds: int = COOLDOWN_TTL) -> bool:
    """Set cooldown for an alert rule.

    Args:
        rule_id: Alert rule ID
        ttl_seconds: Cooldown duration in seconds (default 5 minutes)

    Returns:
        True if set successfully
    """
    client = get_redis()
    key = _cooldown_key(rule_id)

    try:
        await client.setex(key, ttl_seconds, "1")
        return True
    except Exception:
        logger.warning("Failed to set cooldown for rule %s", rule_id)
        return False


async def clear_cooldown(rule_id: uuid.UUID) -> bool:
    """Clear cooldown for an alert rule (when alert resolves).

    Args:
        rule_id: Alert rule ID

    Returns:
        True if cleared successfully
    """
    client = get_redis()
    key = _cooldown_key(rule_id)

    try:
        await client.delete(key)
        return True
    except Exception:
        logger.warning("Failed to clear cooldown for rule %s", rule_id)
        return False


async def get_cooldown_remaining(rule_id: uuid.UUID) -> int:
    """Get remaining cooldown time in seconds.

    Args:
        rule_id: Alert rule ID

    Returns:
        Remaining seconds, 0 if not in cooldown
    """
    client = get_redis()
    key = _cooldown_key(rule_id)

    try:
        ttl = await client.ttl(key)
        return max(0, ttl)
    except Exception:
        logger.warning("Failed to get cooldown TTL for rule %s", rule_id)
        return 0
