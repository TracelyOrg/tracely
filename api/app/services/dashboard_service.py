from __future__ import annotations

import json
import logging
from datetime import datetime
from uuid import UUID

from app.db.clickhouse import ch_query
from app.db.redis import cache_get, cache_set
from app.schemas.dashboard import (
    DashboardMetricsResponse,
    DataPoint,
    EndpointStats,
    HealthResponse,
    HealthStatus,
    LatencyBucket,
    LiveDashboardResponse,
    PeriodSummary,
    ServiceHealth,
    ServiceStatus,
    StatusCodeStats,
)

logger = logging.getLogger(__name__)

# Cache TTL in seconds (AR5: 15-30s TTL for dashboard aggregations)
HEALTH_CACHE_TTL = 20

# Health status thresholds (AC1)
ERROR_RATE_GREEN = 1.0  # < 1% error rate = healthy
ERROR_RATE_YELLOW = 5.0  # < 5% error rate = degraded
P95_GREEN = 500.0  # < 500ms p95 = healthy
P95_YELLOW = 2000.0  # < 2000ms p95 = degraded

# HTTP 4xx/5xx count as errors for dashboard metrics (OTEL status alone misses them).
_HTTP_ERROR_SQL = "(status_code = 'ERROR' OR http_status_code >= 400)"

# Route/method fallbacks — mirrors Live StreamRow (span_name, strip method prefix).
_RESOLVED_HTTP_ROUTE_SQL = """
if(
    trim(http_route) != '',
    trim(http_route),
    if(
        trim(http_method) != ''
        AND startsWith(span_name, concat(trim(http_method), ' ')),
        substring(span_name, length(trim(http_method)) + 2),
        span_name
    )
)
"""

_RAW_HTTP_METHOD_SQL = """
if(
    empty(http_method),
    if(
        position(span_name, ' ') > 0,
        upperUTF8(arrayElement(splitByChar(' ', span_name), 1)),
        'GET'
    ),
    http_method
)
"""


def _http_route_norm_sql(route_expr: str) -> str:
    """Normalize a route expression for GROUP BY (trailing slashes, root)."""
    return f"""
multiIf(
    trim({route_expr}) = '' OR trim({route_expr}) = '/',
    '/',
    endsWith(trim({route_expr}), '/') AND length(trim({route_expr})) > 1,
    left(trim({route_expr}), length(trim({route_expr})) - 1),
    trim({route_expr})
)
"""


def _normalize_http_route(route: str | None) -> str:
    r = (route or "/").strip()
    if not r.startswith("/"):
        r = f"/{r}"
    if len(r) > 1 and r.endswith("/"):
        r = r.rstrip("/") or "/"
    return r or "/"


def _normalize_http_method(method: str | None) -> str:
    m = (method or "GET").strip().upper()
    return m or "GET"


def _merge_endpoint_stats(rows: list[EndpointStats]) -> list[EndpointStats]:
    """Merge rows that share normalized method + route."""
    merged: dict[tuple[str, str], EndpointStats] = {}
    for ep in rows:
        method = _normalize_http_method(ep.method)
        route = _normalize_http_route(ep.route)
        key = (method, route)
        prev = merged.get(key)
        if prev is None:
            merged[key] = ep.model_copy(update={"method": method, "route": route})
            continue
        total = prev.count + ep.count
        merged[key] = EndpointStats(
            route=route,
            method=method,
            count=total,
            avg_latency=round(
                (prev.avg_latency * prev.count + ep.avg_latency * ep.count) / total, 2
            )
            if total
            else 0.0,
            p95_latency=round(max(prev.p95_latency, ep.p95_latency), 2),
            error_rate=round(
                (prev.error_rate * prev.count + ep.error_rate * ep.count) / total, 2
            )
            if total
            else 0.0,
        )
    return sorted(merged.values(), key=lambda item: item.count, reverse=True)


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
        result = await ch_query(query, parameters=params)
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
        # Execute all queries
        sparkline_result = await ch_query(sparkline_query, parameters=params)
        aggregates_result = await ch_query(aggregates_query, parameters=params)
        services_result = await ch_query(services_query, parameters=params)

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


# --- Enhanced Dashboard Metrics (Bento Grid) ---

METRICS_CACHE_TTL = 10  # 10 second TTL for dashboard metrics


def _cache_time_part(value: datetime | str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _metrics_cache_key(
    project_id: UUID,
    preset: str,
    start: datetime | str | None,
    end: datetime | str | None,
    environment: str | None = None,
) -> str:
    """Generate Redis cache key for dashboard metrics."""
    key_parts = [f"dashboard:metrics:{project_id}:{preset}"]
    if environment:
        key_parts.append(f"env:{environment}")
    start_key = _cache_time_part(start)
    end_key = _cache_time_part(end)
    if start_key:
        key_parts.append(start_key[:16])  # Truncate for key size
    if end_key:
        key_parts.append(end_key[:16])
    return ":".join(key_parts)


def _env_clause(environment: str | None) -> str:
    """SQL fragment to filter spans by deployment environment."""
    if not environment:
        return ""
    if environment == "unknown":
        return "AND environment = ''"
    safe = environment.replace("'", "''")
    return f"AND environment = '{safe}'"


_SPANS_BASE_FILTER = "span_type = 'span'"


def _get_time_interval(preset: str) -> str:
    """Convert preset to ClickHouse interval string."""
    intervals = {
        "5m": "5 MINUTE",
        "15m": "15 MINUTE",
        "1h": "1 HOUR",
        "6h": "6 HOUR",
        "24h": "24 HOUR",
    }
    return intervals.get(preset, "15 MINUTE")


def _window_minutes(
    preset: str,
    start: datetime | None,
    end: datetime | None,
) -> float:
    """Duration of the active dashboard window in minutes (for req/min rates)."""
    if preset == "custom" and start is not None and end is not None:
        return max((end - start).total_seconds() / 60.0, 1.0)
    minutes_map = {
        "5m": 5,
        "15m": 15,
        "1h": 60,
        "6h": 360,
        "24h": 1440,
    }
    return float(minutes_map.get(preset, 15))


def _apply_time_filter(
    preset: str,
    start: datetime | None,
    end: datetime | None,
    params: dict,
) -> str:
    """Build a ClickHouse time filter using typed parameters (matches Live spans API)."""
    if preset == "custom" and start is not None and end is not None:
        params["range_start"] = start
        params["range_end"] = end
        return "start_time >= %(range_start)s AND start_time <= %(range_end)s"

    interval = _get_time_interval(preset)
    return f"start_time >= now() - INTERVAL {interval}"


def _apply_previous_time_filter(
    preset: str,
    start: datetime | None,
    end: datetime | None,
    params: dict,
) -> str | None:
    """Return time filter for the window immediately before the current range."""
    if preset == "custom" and start is not None and end is not None:
        duration = end - start
        params["prev_range_start"] = start - duration
        params["prev_range_end"] = start
        return "start_time >= %(prev_range_start)s AND start_time < %(prev_range_end)s"

    if preset == "custom":
        return None

    interval = _get_time_interval(preset)
    minutes_map = {
        "5 MINUTE": 5,
        "15 MINUTE": 15,
        "1 HOUR": 60,
        "6 HOUR": 360,
        "24 HOUR": 1440,
    }
    minutes = minutes_map.get(interval, 15)
    double_minutes = minutes * 2
    return (
        f"start_time >= now() - INTERVAL {double_minutes} MINUTE "
        f"AND start_time < now() - INTERVAL {minutes} MINUTE"
    )


async def _fetch_period_summary(
    org_id: UUID,
    project_id: UUID,
    time_filter: str,
    environment: str | None = None,
    extra_params: dict | None = None,
) -> PeriodSummary:
    """Run aggregate query for a single time window."""
    params: dict = {
        "org_id": str(org_id),
        "project_id": str(project_id),
    }
    if extra_params:
        params.update(extra_params)
    env_sql = _env_clause(environment)

    aggregates_query = f"""
    SELECT
        count() AS total_requests,
        countIf({_HTTP_ERROR_SQL}) AS total_errors,
        quantile(0.95)(duration_ms) AS p95_ms
    FROM spans
    WHERE org_id = %(org_id)s
      AND project_id = %(project_id)s
      AND {_SPANS_BASE_FILTER}
      AND {time_filter}
      {env_sql}
    """
    result = await ch_query(aggregates_query, parameters=params)
    if not result.result_rows:
        return PeriodSummary()

    total_requests, total_errors, p95_ms = result.result_rows[0]
    total_requests = int(total_requests or 0)
    total_errors = int(total_errors or 0)
    error_rate = (
        round((total_errors / total_requests) * 100, 2) if total_requests > 0 else 0.0
    )
    return PeriodSummary(
        total_requests=total_requests,
        total_errors=total_errors,
        error_rate=error_rate,
        p95_latency=round(p95_ms or 0.0, 2),
    )


def _build_latency_buckets() -> list[LatencyBucket]:
    """Build default latency distribution buckets."""
    return [
        LatencyBucket(range="0-50ms", label="<50", count=0),
        LatencyBucket(range="50-100ms", label="50-100", count=0),
        LatencyBucket(range="100-200ms", label="100-200", count=0),
        LatencyBucket(range="200-500ms", label="200-500", count=0),
        LatencyBucket(range="500ms-1s", label="500-1s", count=0),
        LatencyBucket(range="1s-2s", label="1-2s", count=0),
        LatencyBucket(range=">2s", label=">2s", count=0),
    ]


async def get_dashboard_metrics(
    org_id: UUID,
    project_id: UUID,
    preset: str = "15m",
    start: datetime | None = None,
    end: datetime | None = None,
    environment: str | None = None,
) -> DashboardMetricsResponse:
    """Get comprehensive dashboard metrics for bento grid layout.

    Supports both preset time ranges (5m, 15m, 1h, 6h, 24h) and custom
    date ranges. Returns time series, aggregates, distributions, and
    service health data.

    Args:
        org_id: Organization UUID
        project_id: Project UUID
        preset: Time preset (5m, 15m, 1h, 6h, 24h, custom)
        start: Custom range start (ISO string, only when preset=custom)
        end: Custom range end (ISO string, only when preset=custom)

    Returns:
        DashboardMetricsResponse with all bento grid data
    """
    cache_key = _metrics_cache_key(project_id, preset, start, end, environment)

    # Try cache first
    cached = await cache_get(cache_key)
    if cached:
        try:
            data = json.loads(cached)
            return DashboardMetricsResponse(**data)
        except (json.JSONDecodeError, ValueError):
            logger.warning("Invalid cached dashboard metrics, fetching fresh")

    params: dict = {
        "org_id": str(org_id),
        "project_id": str(project_id),
    }
    time_filter = _apply_time_filter(preset, start, end, params)

    env_sql = _env_clause(environment)
    route_norm = _http_route_norm_sql(_RESOLVED_HTTP_ROUTE_SQL)

    # Initialize response data
    requests_per_minute: list[DataPoint] = []
    errors_per_minute: list[DataPoint] = []
    total_requests = 0
    total_errors = 0
    error_rate = 0.0
    p50_latency = 0.0
    p95_latency = 0.0
    p99_latency = 0.0
    avg_latency = 0.0
    status_codes: list[StatusCodeStats] = []
    top_endpoints: list[EndpointStats] = []
    latency_distribution = _build_latency_buckets()
    services: list[ServiceStatus] = []
    available_environments: list[str] = []

    try:
        # Query 1: Time series requests per minute (always from spans for consistency)
        sparkline_query = f"""
        SELECT
            toStartOfMinute(start_time) AS time_bucket,
            count() AS requests,
            countIf({_HTTP_ERROR_SQL}) AS errors
        FROM spans
        WHERE org_id = %(org_id)s
          AND project_id = %(project_id)s
          AND {_SPANS_BASE_FILTER}
          AND {time_filter}
          {env_sql}
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
        """
        sparkline_result = await ch_query(sparkline_query, parameters=params)

        for row in sparkline_result.result_rows:
            time_bucket, requests, errors = row
            requests_per_minute.append(
                DataPoint(timestamp=time_bucket, value=float(requests))
            )
            errors_per_minute.append(
                DataPoint(timestamp=time_bucket, value=float(errors))
            )

        # Query 2: Aggregates (totals, percentiles)
        aggregates_query = f"""
        SELECT
            count() AS total_requests,
            countIf({_HTTP_ERROR_SQL}) AS total_errors,
            avg(duration_ms) AS avg_ms,
            quantile(0.5)(duration_ms) AS p50_ms,
            quantile(0.95)(duration_ms) AS p95_ms,
            quantile(0.99)(duration_ms) AS p99_ms
        FROM spans
        WHERE org_id = %(org_id)s
          AND project_id = %(project_id)s
          AND {_SPANS_BASE_FILTER}
          AND {time_filter}
          {env_sql}
        """
        agg_result = await ch_query(aggregates_query, parameters=params)

        if agg_result.result_rows:
            row = agg_result.result_rows[0]
            total_requests = int(row[0] or 0)
            total_errors = int(row[1] or 0)
            avg_latency = round(row[2] or 0.0, 2)
            p50_latency = round(row[3] or 0.0, 2)
            p95_latency = round(row[4] or 0.0, 2)
            p99_latency = round(row[5] or 0.0, 2)
            if total_requests > 0:
                error_rate = round((total_errors / total_requests) * 100, 2)

        # Query 3: Status code distribution
        try:
            status_query = f"""
            SELECT
                multiIf(
                    http_status_code >= 200 AND http_status_code < 300, '2xx',
                    http_status_code >= 300 AND http_status_code < 400, '3xx',
                    http_status_code >= 400 AND http_status_code < 500, '4xx',
                    http_status_code >= 500, '5xx',
                    'other'
                ) AS status_group,
                count() AS cnt
            FROM spans
            WHERE org_id = %(org_id)s
              AND project_id = %(project_id)s
              AND {_SPANS_BASE_FILTER}
              AND {time_filter}
              AND http_status_code > 0
              {env_sql}
            GROUP BY status_group
            ORDER BY status_group
            """
            status_result = await ch_query(status_query, parameters=params)

            for row in status_result.result_rows:
                code, count = row
                if code != "other":
                    status_codes.append(StatusCodeStats(code=code, count=int(count)))
        except Exception:
            logger.exception("Dashboard status code query failed")

        # Query 4: Top endpoints (same route resolution as Live)
        # Inner query avoids ClickHouse 24 GROUP BY alias strictness (code 215).
        try:
            endpoints_query = f"""
            SELECT
                http_route,
                http_method,
                count() AS cnt,
                avg(duration_ms) AS avg_ms,
                quantile(0.95)(duration_ms) AS p95_ms,
                countIf(is_error) / count() * 100 AS err_rate
            FROM (
                SELECT
                    {route_norm} AS http_route,
                    {_RAW_HTTP_METHOD_SQL} AS http_method,
                    duration_ms,
                    toUInt8({_HTTP_ERROR_SQL}) AS is_error
                FROM spans
                WHERE org_id = %(org_id)s
                  AND project_id = %(project_id)s
                  AND {_SPANS_BASE_FILTER}
                  AND {time_filter}
                  AND (
                    trim(http_route) != ''
                    OR trim(span_name) != ''
                    OR http_status_code > 0
                  )
                  {env_sql}
            )
            GROUP BY http_route, http_method
            ORDER BY cnt DESC
            LIMIT 10
            """
            endpoints_result = await ch_query(endpoints_query, parameters=params)

            for row in endpoints_result.result_rows:
                route, method, count, avg_ms, p95_ms, err_rate = row
                top_endpoints.append(
                    EndpointStats(
                        route=_normalize_http_route(route or "/"),
                        method=_normalize_http_method(method),
                        count=int(count),
                        avg_latency=round(avg_ms or 0.0, 2),
                        p95_latency=round(p95_ms or 0.0, 2),
                        error_rate=round(err_rate or 0.0, 2),
                    )
                )
            top_endpoints = _merge_endpoint_stats(top_endpoints)[:10]
        except Exception:
            logger.exception("Dashboard endpoints query failed")

        # Query 5: Latency distribution
        try:
            latency_query = f"""
            SELECT
                multiIf(
                    duration_ms < 50, 0,
                    duration_ms < 100, 1,
                    duration_ms < 200, 2,
                    duration_ms < 500, 3,
                    duration_ms < 1000, 4,
                    duration_ms < 2000, 5,
                    6
                ) AS bucket,
                count() AS cnt
            FROM spans
            WHERE org_id = %(org_id)s
              AND project_id = %(project_id)s
              AND {_SPANS_BASE_FILTER}
              AND {time_filter}
              AND duration_ms > 0
              {env_sql}
            GROUP BY bucket
            ORDER BY bucket
            """
            latency_result = await ch_query(latency_query, parameters=params)

            for row in latency_result.result_rows:
                bucket_idx, count = row
                idx = int(bucket_idx)
                if 0 <= idx < len(latency_distribution):
                    latency_distribution[idx] = LatencyBucket(
                        range=latency_distribution[idx].range,
                        label=latency_distribution[idx].label,
                        count=int(count),
                    )
        except Exception:
            logger.exception("Dashboard latency distribution query failed")

        # Query 6: Service status
        try:
            services_query = f"""
            SELECT
                service_key AS service_name,
                count() AS total_requests,
                countIf(is_error) AS total_errors,
                quantile(0.95)(duration_ms) AS p95_ms
            FROM (
                SELECT
                    if(service_name = '', 'unknown', service_name) AS service_key,
                    duration_ms,
                    toUInt8({_HTTP_ERROR_SQL}) AS is_error
                FROM spans
                WHERE org_id = %(org_id)s
                  AND project_id = %(project_id)s
                  AND {_SPANS_BASE_FILTER}
                  AND {time_filter}
                  {env_sql}
            )
            GROUP BY service_key
            ORDER BY total_requests DESC
            """
            services_result = await ch_query(services_query, parameters=params)

            window_minutes = _window_minutes(preset, start, end)

            for row in services_result.result_rows:
                service_name, svc_requests, svc_errors, svc_p95 = row
                svc_request_rate = (
                    svc_requests / window_minutes if svc_requests > 0 else 0.0
                )
                svc_error_rate = (
                    (svc_errors / svc_requests * 100) if svc_requests > 0 else 0.0
                )
                svc_status = _calculate_health_status(svc_error_rate, svc_p95 or 0.0)

                services.append(
                    ServiceStatus(
                        name=service_name,
                        status=svc_status,
                        request_rate=round(svc_request_rate, 2),
                        error_rate=round(svc_error_rate, 2),
                        p95_latency=round(svc_p95 or 0.0, 2),
                    )
                )
        except Exception:
            logger.exception("Dashboard services query failed")

        try:
            envs_query = f"""
            SELECT DISTINCT environment
            FROM spans
            WHERE org_id = %(org_id)s
              AND project_id = %(project_id)s
              AND start_time >= now() - INTERVAL 7 DAY
            ORDER BY environment ASC
            """
            envs_result = await ch_query(envs_query, parameters=params)
            for row in envs_result.result_rows:
                raw = row[0] or ""
                available_environments.append(raw if raw else "unknown")
        except Exception:
            logger.exception("Dashboard environments query failed")

    except RuntimeError:
        logger.warning("ClickHouse unavailable, returning empty dashboard metrics")
    except Exception:
        logger.exception("ClickHouse query failed for dashboard metrics")

    previous_period: PeriodSummary | None = None
    prev_params: dict = {}
    prev_time_filter = _apply_previous_time_filter(preset, start, end, prev_params)
    if prev_time_filter:
        try:
            previous_period = await _fetch_period_summary(
                org_id,
                project_id,
                prev_time_filter,
                environment,
                extra_params=prev_params,
            )
        except Exception:
            logger.exception("ClickHouse query failed for previous period comparison")

    response = DashboardMetricsResponse(
        requests_per_minute=requests_per_minute,
        errors_per_minute=errors_per_minute,
        total_requests=total_requests,
        total_errors=total_errors,
        error_rate=error_rate,
        p50_latency=p50_latency,
        p95_latency=p95_latency,
        p99_latency=p99_latency,
        avg_latency=avg_latency,
        status_codes=status_codes,
        top_endpoints=top_endpoints,
        latency_distribution=latency_distribution,
        services=services,
        previous_period=previous_period,
        available_environments=available_environments,
    )

    # Cache the result
    await cache_set(cache_key, response.model_dump_json(), METRICS_CACHE_TTL)

    return response
