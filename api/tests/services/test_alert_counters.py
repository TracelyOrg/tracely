"""Tests for Redis-based alert counters (Story 5.3)."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import alert_counters


# ─── increment_error_count tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_increment_error_count_returns_new_value():
    """Incrementing error count returns new counter value."""
    project_id = uuid.uuid4()
    mock_redis = MagicMock()
    mock_pipe = MagicMock()
    mock_pipe.incr = MagicMock(return_value=mock_pipe)
    mock_pipe.expire = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(return_value=[5, True])  # [new_value, expire_result]
    mock_redis.pipeline.return_value = mock_pipe

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.increment_error_count(project_id)

    assert result == 5
    mock_pipe.incr.assert_called_once()
    mock_pipe.expire.assert_called_once()


@pytest.mark.asyncio
async def test_increment_error_count_handles_redis_error():
    """Incrementing error count returns 0 on Redis error."""
    project_id = uuid.uuid4()
    mock_redis = MagicMock()
    mock_pipe = MagicMock()
    mock_pipe.incr = MagicMock(return_value=mock_pipe)
    mock_pipe.expire = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(side_effect=Exception("Redis error"))
    mock_redis.pipeline.return_value = mock_pipe

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.increment_error_count(project_id)

    assert result == 0


# ─── increment_request_count tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_increment_request_count_returns_new_value():
    """Incrementing request count returns new counter value."""
    project_id = uuid.uuid4()
    mock_redis = MagicMock()
    mock_pipe = MagicMock()
    mock_pipe.incr = MagicMock(return_value=mock_pipe)
    mock_pipe.expire = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(return_value=[10, True])
    mock_redis.pipeline.return_value = mock_pipe

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.increment_request_count(project_id)

    assert result == 10


# ─── get_error_count tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_get_error_count_sums_window_values():
    """Getting error count sums values across sliding window."""
    project_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.mget = AsyncMock(return_value=[b"10", b"5", b"3", None, b"2"])

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.get_error_count(project_id, window_minutes=5)

    assert result == 20  # 10 + 5 + 3 + 0 + 2


@pytest.mark.asyncio
async def test_get_error_count_handles_empty_window():
    """Getting error count returns 0 for empty window."""
    project_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.mget = AsyncMock(return_value=[None, None, None])

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.get_error_count(project_id, window_minutes=3)

    assert result == 0


# ─── get_request_count tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_get_request_count_sums_window_values():
    """Getting request count sums values across sliding window."""
    project_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.mget = AsyncMock(return_value=[b"100", b"200", b"150"])

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.get_request_count(project_id, window_minutes=3)

    assert result == 450


# ─── get_error_rate tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_get_error_rate_calculates_percentage():
    """Error rate is calculated as percentage of errors to requests."""
    project_id = uuid.uuid4()
    mock_redis = AsyncMock()

    # First call for errors, second for requests
    async def mock_mget(keys):
        if "errors" in keys[0]:
            return [b"10", b"5"]  # 15 errors
        else:
            return [b"100", b"200"]  # 300 requests

    mock_redis.mget = mock_mget

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.get_error_rate(project_id, window_minutes=2)

    assert result == 5.0  # 15/300 * 100 = 5%


@pytest.mark.asyncio
async def test_get_error_rate_returns_zero_for_no_requests():
    """Error rate returns 0 when there are no requests."""
    project_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.mget = AsyncMock(return_value=[None, None])

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.get_error_rate(project_id, window_minutes=2)

    assert result == 0.0


# ─── cooldown management tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_is_in_cooldown_returns_true_when_exists():
    """is_in_cooldown returns True when cooldown key exists."""
    rule_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.exists = AsyncMock(return_value=1)

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.is_in_cooldown(rule_id)

    assert result is True


@pytest.mark.asyncio
async def test_is_in_cooldown_returns_false_when_not_exists():
    """is_in_cooldown returns False when cooldown key doesn't exist."""
    rule_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.exists = AsyncMock(return_value=0)

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.is_in_cooldown(rule_id)

    assert result is False


@pytest.mark.asyncio
async def test_set_cooldown_sets_key_with_ttl():
    """set_cooldown sets key with specified TTL."""
    rule_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.setex = AsyncMock()

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.set_cooldown(rule_id, ttl_seconds=300)

    assert result is True
    mock_redis.setex.assert_called_once()
    # Verify TTL was 300 seconds
    call_args = mock_redis.setex.call_args
    assert call_args[0][1] == 300


@pytest.mark.asyncio
async def test_clear_cooldown_deletes_key():
    """clear_cooldown deletes the cooldown key."""
    rule_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.delete = AsyncMock()

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.clear_cooldown(rule_id)

    assert result is True
    mock_redis.delete.assert_called_once()


@pytest.mark.asyncio
async def test_get_cooldown_remaining_returns_ttl():
    """get_cooldown_remaining returns remaining TTL."""
    rule_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.ttl = AsyncMock(return_value=120)

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.get_cooldown_remaining(rule_id)

    assert result == 120


@pytest.mark.asyncio
async def test_get_cooldown_remaining_returns_zero_for_expired():
    """get_cooldown_remaining returns 0 for expired key."""
    rule_id = uuid.uuid4()
    mock_redis = AsyncMock()
    mock_redis.ttl = AsyncMock(return_value=-2)  # Key doesn't exist

    with patch("app.services.alert_counters.get_redis", return_value=mock_redis):
        result = await alert_counters.get_cooldown_remaining(rule_id)

    assert result == 0
