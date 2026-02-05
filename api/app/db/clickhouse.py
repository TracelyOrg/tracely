from __future__ import annotations

import asyncio
import logging

import clickhouse_connect
from clickhouse_connect.driver import Client

from app.config import settings

logger = logging.getLogger(__name__)

_client: Client | None = None

SPANS_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS spans (
    org_id          UUID,
    project_id      UUID,
    trace_id        String,
    span_id         String,
    parent_span_id  String,
    span_name       String,
    span_type       Enum8('span'=1, 'pending_span'=2, 'log'=3),
    service_name    String,
    framework       String,
    environment     String,
    kind            Enum8('INTERNAL'=0, 'SERVER'=1, 'CLIENT'=2, 'PRODUCER'=3, 'CONSUMER'=4),
    start_time      DateTime64(9),
    end_time        DateTime64(9),
    duration_ms     Float64,
    status_code     Enum8('UNSET'=0, 'OK'=1, 'ERROR'=2),
    status_message  String,
    http_method     LowCardinality(String),
    http_route      String,
    http_status_code UInt16,
    request_body    String,
    response_body   String,
    request_headers String,
    response_headers String,
    attributes      Map(String, String),
    row_size_bytes  UInt32
)
ENGINE = MergeTree()
PARTITION BY (org_id, toYYYYMMDD(start_time))
ORDER BY (org_id, project_id, service_name, start_time, trace_id, span_id)
TTL toDateTime(start_time) + INTERVAL 90 DAY DELETE
"""

METRICS_1M_VIEW_DDL = """
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1m
ENGINE = AggregatingMergeTree()
PARTITION BY (org_id, toYYYYMMDD(time_bucket))
ORDER BY (org_id, project_id, service_name, http_route, time_bucket)
AS SELECT
    org_id, project_id, service_name, http_route,
    toStartOfMinute(start_time) AS time_bucket,
    countState() AS request_count,
    countIfState(status_code = 'ERROR') AS error_count,
    avgState(duration_ms) AS avg_duration,
    quantileState(0.5)(duration_ms) AS p50_duration,
    quantileState(0.95)(duration_ms) AS p95_duration,
    maxState(duration_ms) AS max_duration
FROM spans
WHERE span_type = 'span' AND kind IN ('SERVER', 'INTERNAL')
GROUP BY org_id, project_id, service_name, http_route, time_bucket
"""

# Migration DDL to recreate the materialized view with updated filter
METRICS_1M_MIGRATE_DDL = """
DROP VIEW IF EXISTS metrics_1m
"""


def _parse_clickhouse_url(url: str) -> dict[str, str | int]:
    """Parse ClickHouse HTTP URL into connection kwargs."""
    from urllib.parse import urlparse

    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 8123,
        "username": parsed.username or "default",
        "password": parsed.password or "",
    }


def get_clickhouse_client() -> Client:
    """Return the module-level ClickHouse client. Must call init_clickhouse() first."""
    if _client is None:
        raise RuntimeError("ClickHouse client not initialized. Call init_clickhouse() first.")
    return _client


async def init_clickhouse() -> None:
    """Initialize ClickHouse client and create schema if not exists.

    Handles connection failures gracefully — logs a warning instead of
    crashing the app. Endpoints requiring ClickHouse will fail at request
    time if the client is unavailable.
    """
    global _client
    conn_kwargs = _parse_clickhouse_url(settings.clickhouse_url)
    try:
        _client = await asyncio.to_thread(
            clickhouse_connect.get_client, **conn_kwargs
        )
    except Exception:
        logger.warning(
            "ClickHouse unavailable at %s:%s — ingestion will not work",
            conn_kwargs["host"],
            conn_kwargs["port"],
        )
        return

    logger.info("ClickHouse client connected to %s:%s", conn_kwargs["host"], conn_kwargs["port"])

    # Create spans table
    await asyncio.to_thread(_client.command, SPANS_TABLE_DDL)
    logger.info("ClickHouse: spans table ready")

    # Recreate metrics_1m materialized view (drop first to apply filter changes)
    # This ensures the view includes both SERVER and INTERNAL spans
    await asyncio.to_thread(_client.command, METRICS_1M_MIGRATE_DDL)
    await asyncio.to_thread(_client.command, METRICS_1M_VIEW_DDL)
    logger.info("ClickHouse: metrics_1m materialized view ready")


async def close_clickhouse() -> None:
    """Close the ClickHouse client connection."""
    global _client
    if _client is not None:
        await asyncio.to_thread(_client.close)
        _client = None
        logger.info("ClickHouse client closed")
