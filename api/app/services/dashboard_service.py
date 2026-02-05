from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

from app.db.clickhouse import get_clickhouse_client
from app.db.redis import cache_get, cache_set
from app.schemas.dashboard import (
    DataPoint,
    HealthResponse,
    HealthStatus,
    LiveDashboardResponse,
    ServiceHealth,
    ServiceStatus,
)

logger = logging.getLogger(__name__)

# Cache TTL in seconds (AR5: 15-30s TTL for dashboard aggregations)
HEALTH_CACHE_TTL = 20

# Health status thresholds (AC1)
ERROR_RATE_GREEN = 1.0  # < 1% error rate = healthy
ERROR_RATE_YELLOW = 5.0  # < 5% error rate = degraded
P95_GREEN = 500.0  # < 500ms p95 = healthy
P95_YELLOW = 2000.0  # < 2000ms p95 = degraded


def _calculate_health_status(error_rate: float, p95_latency: float) -> HealthStatus:
    """Calculate health status based on thresholds.

    Thresholds (AC1):
    - Green (healthy): error rate < 1% AND p95 < 500ms
    - Yellow (degraded): error rate < 5% OR p95 < 2s
    - Red (error): otherwise
    """
    # Error state takes precedence
    if error_rate >= ERROR_RATE_YELLOW and p95_latency >= P95_YELLOW:
        return HealthStatus.error

    # Healthy: both metrics are within green thresholds
    if error_rate < ERROR_RATE_GREEN and p95_latency < P95_GREEN:
        return HealthStatus.healthy

    # Degraded: one or both metrics are in yellow range but not both in red
    if error_rate < ERROR_RATE_YELLOW or p95_latency < P95_YELLOW:
        return HealthStatus.degraded

    return HealthStatus.error


def _cache_key(org_id: UUID, project_id: UUID) -> str:
    """Generate Redis cache key for health data."""
    return f"health:{project_id}"


async def get_project_health(
    org_id: UUID,
    project_id: UUID,
) -> HealthResponse:
    """Get health metrics for all services in a project.

    Queries ClickHouse metrics_1m view for service-level aggregations
    over the last 5 minutes. Results are cached in Redis with 20s TTL.

    Args:
        org_id: Organization UUID (for multi-tenant isolation)
        project_id: Project UUID

    Returns:
        HealthResponse with list of ServiceHealth objects
    """
    cache_key = _cache_key(org_id, project_id)

    # Try cache first
    cached = await cache_get(cache_key)
    if cached:
        try:
            data = json.loads(cached)
            return HealthResponse(**data)
        except (json.JSONDecodeError, ValueError):
            logger.warning("Invalid cached health data, fetching fresh")

    # Query ClickHouse metrics_1m view
    # Aggregate by service_name over last 5 minutes
    query = """
    SELECT
        service_name,
        countMerge(request_count) AS total_requests,
        countMerge(error_count) AS total_errors,
        quantileMerge(0.95)(p95_duration) AS p95_ms
    FROM metrics_1m
    WHERE org_id = %(org_id)s
      AND project_id = %(project_id)s
      AND time_bucket >= now() - INTERVAL 5 MINUTE
    GROUP BY service_name
    ORDER BY total_requests DESC
    """

    params = {
        "org_id": str(org_id),
        "project_id": str(project_id),
    }

    try:
        client = get_clickhouse_client()
        result = await asyncio.to_thread(
            client.query,
            query,
            parameters=params,
        )
        rows = result.result_rows
    except RuntimeError:
        # ClickHouse not initialized
        logger.warning("ClickHouse unavailable, returning empty health response")
        return HealthResponse(services=[])
    except Exception:
        logger.exception("ClickHouse query failed for health aggregations")
        return HealthResponse(services=[])

    services: list[ServiceHealth] = []

    for row in rows:
        service_name, total_requests, total_errors, p95_ms = row

        # Calculate request rate (requests per minute over 5 min window)
        request_rate = total_requests / 5.0 if total_requests > 0 else 0.0

        # Calculate error rate as percentage
        error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0.0

        # Calculate health status
        status = _calculate_health_status(error_rate, p95_ms or 0.0)

        services.append(
            ServiceHealth(
                name=service_name,
                status=status,
                request_rate=round(request_rate, 2),
                error_rate=round(error_rate, 2),
                p95_latency=round(p95_ms or 0.0, 2),
            )
        )

    response = HealthResponse(services=services)

    # Cache the result
    await cache_set(cache_key, response.model_dump_json(), HEALTH_CACHE_TTL)

    return response


# --- Live Dashboard (Story 4.2) ---

LIVE_CACHE_TTL = 5  # 5 second TTL for live dashboard


def _live_cache_key(project_id: UUID) -> str:
    """Generate Redis cache key for live dashboard data."""
    return f"dashboard:live:{project_id}"


async def get_live_dashboard(
    org_id: UUID,
    project_id: UUID,
) -> LiveDashboardResponse:
    """Get live dashboard metrics for a project (Story 4.2).

    Queries ClickHouse metrics_1m view for:
    - Sparkline data: last 15 minutes of requests/minute (1-min granularity)
    - Current aggregates: error_rate, p95_latency
    - Service status: per-service health indicators

    Results are cached in Redis with 5s TTL (AC1: widgets update via 5s polling).

    Args:
        org_id: Organization UUID (for multi-tenant isolation)
        project_id: Project UUID

    Returns:
        LiveDashboardResponse with sparkline data and current metrics
    """
    cache_key = _live_cache_key(project_id)

    # Try cache first
    cached = await cache_get(cache_key)
    if cached:
        try:
            data = json.loads(cached)
            return LiveDashboardResponse(**data)
        except (json.JSONDecodeError, ValueError):
            logger.warning("Invalid cached live dashboard data, fetching fresh")

    # Query 1: Sparkline data - requests per minute for last 15 minutes (Task 3.2)
    sparkline_query = """
    SELECT
        time_bucket,
        countMerge(request_count) AS requests
    FROM metrics_1m
    WHERE org_id = %(org_id)s
      AND project_id = %(project_id)s
      AND time_bucket >= now() - INTERVAL 15 MINUTE
    GROUP BY time_bucket
    ORDER BY time_bucket ASC
    """

    # Query 2: Current aggregates over last 5 minutes
    aggregates_query = """
    SELECT
        countMerge(request_count) AS total_requests,
        countMerge(error_count) AS total_errors,
        quantileMerge(0.95)(p95_duration) AS p95_ms
    FROM metrics_1m
    WHERE org_id = %(org_id)s
      AND project_id = %(project_id)s
      AND time_bucket >= now() - INTERVAL 5 MINUTE
    """

    # Query 3: Service status (reuse the health query pattern)
    services_query = """
    SELECT
        service_name,
        countMerge(request_count) AS total_requests,
        countMerge(error_count) AS total_errors,
        quantileMerge(0.95)(p95_duration) AS p95_ms
    FROM metrics_1m
    WHERE org_id = %(org_id)s
      AND project_id = %(project_id)s
      AND time_bucket >= now() - INTERVAL 5 MINUTE
    GROUP BY service_name
    ORDER BY total_requests DESC
    """

    params = {
        "org_id": str(org_id),
        "project_id": str(project_id),
    }

    requests_per_minute: list[DataPoint] = []
    error_rate = 0.0
    p95_latency = 0.0
    services: list[ServiceStatus] = []

    try:
        client = get_clickhouse_client()

        # Execute all queries
        sparkline_result = await asyncio.to_thread(
            client.query, sparkline_query, parameters=params
        )
        aggregates_result = await asyncio.to_thread(
            client.query, aggregates_query, parameters=params
        )
        services_result = await asyncio.to_thread(
            client.query, services_query, parameters=params
        )

        # Process sparkline data (Task 3.2)
        for row in sparkline_result.result_rows:
            time_bucket, requests = row
            requests_per_minute.append(
                DataPoint(timestamp=time_bucket, value=float(requests))
            )

        # Process current aggregates (Task 3.3)
        if aggregates_result.result_rows:
            total_requests, total_errors, p95_ms = aggregates_result.result_rows[0]
            if total_requests and total_requests > 0:
                error_rate = round((total_errors / total_requests) * 100, 2)
            p95_latency = round(p95_ms or 0.0, 2)

        # Process services (Task 3.4)
        for row in services_result.result_rows:
            service_name, total_requests, total_errors, p95_ms = row
            service_request_rate = total_requests / 5.0 if total_requests > 0 else 0.0
            service_error_rate = (
                (total_errors / total_requests * 100) if total_requests > 0 else 0.0
            )
            service_status = _calculate_health_status(
                service_error_rate, p95_ms or 0.0
            )

            services.append(
                ServiceStatus(
                    name=service_name,
                    status=service_status,
                    request_rate=round(service_request_rate, 2),
                    error_rate=round(service_error_rate, 2),
                    p95_latency=round(p95_ms or 0.0, 2),
                )
            )

    except RuntimeError:
        logger.warning("ClickHouse unavailable, returning empty live dashboard")
    except Exception:
        logger.exception("ClickHouse query failed for live dashboard")

    response = LiveDashboardResponse(
        requests_per_minute=requests_per_minute,
        error_rate=error_rate,
        p95_latency=p95_latency,
        services=services,
    )

    # Cache the result (Task 3.3 - Redis cache)
    await cache_set(cache_key, response.model_dump_json(), LIVE_CACHE_TTL)

    return response
