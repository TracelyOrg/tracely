from __future__ import annotations

import logging
from typing import Any

import redis.asyncio as redis

from app.config import settings

logger = logging.getLogger(__name__)

_pool: redis.ConnectionPool | None = None


async def init_redis() -> None:
    """Initialize Redis connection pool."""
    global _pool
    _pool = redis.ConnectionPool.from_url(
        settings.redis_url,
        decode_responses=True,
        max_connections=10,
    )
    logger.info("Redis connection pool initialized")


async def close_redis() -> None:
    """Close Redis connection pool."""
    global _pool
    if _pool is not None:
        await _pool.disconnect()
        _pool = None
        logger.info("Redis connection pool closed")


def get_redis() -> redis.Redis:
    """Get Redis client from the pool."""
    if _pool is None:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return redis.Redis(connection_pool=_pool)


async def cache_get(key: str) -> str | None:
    """Get value from cache."""
    client = get_redis()
    try:
        return await client.get(key)
    except Exception:
        logger.warning("Redis cache_get failed for key: %s", key)
        return None


async def cache_set(key: str, value: str, ttl_seconds: int = 20) -> bool:
    """Set value in cache with TTL."""
    client = get_redis()
    try:
        await client.setex(key, ttl_seconds, value)
        return True
    except Exception:
        logger.warning("Redis cache_set failed for key: %s", key)
        return False


async def cache_delete(key: str) -> bool:
    """Delete key from cache."""
    client = get_redis()
    try:
        await client.delete(key)
        return True
    except Exception:
        logger.warning("Redis cache_delete failed for key: %s", key)
        return False
