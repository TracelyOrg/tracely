from __future__ import annotations

from app.schemas.dashboard import EndpointStats
from datetime import datetime, timezone

from app.services.dashboard_service import (
    _apply_previous_time_filter,
    _apply_time_filter,
    _calculate_health_status,
    _merge_endpoint_stats,
    _normalize_http_method,
    _normalize_http_route,
    _window_minutes,
)
from app.schemas.dashboard import HealthStatus


def test_normalize_http_route_trailing_slash():
    assert _normalize_http_route("/docs/") == "/docs"
    assert _normalize_http_route("/") == "/"


def test_normalize_http_method_defaults_to_get():
    assert _normalize_http_method("") == "GET"
    assert _normalize_http_method("post") == "POST"


def test_merge_endpoint_stats_combines_duplicates():
    rows = [
        EndpointStats(route="/docs", method="GET", count=10, avg_latency=100.0, p95_latency=150.0, error_rate=1.0),
        EndpointStats(route="/docs/", method="GET", count=5, avg_latency=200.0, p95_latency=250.0, error_rate=3.0),
    ]
    merged = _merge_endpoint_stats(rows)
    assert len(merged) == 1
    assert merged[0].route == "/docs"
    assert merged[0].count == 15
    assert merged[0].avg_latency == 133.33
    assert merged[0].p95_latency == 250.0
    assert merged[0].error_rate == 1.67


def test_health_status_degraded_on_elevated_error_rate():
    assert _calculate_health_status(2.0, 200.0) == HealthStatus.degraded


def test_apply_time_filter_custom_uses_parameterized_bounds():
    params: dict = {}
    start = datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 7, 10, 23, 59, tzinfo=timezone.utc)

    sql = _apply_time_filter("custom", start, end, params)

    assert "range_start" in sql
    assert "range_end" in sql
    assert "%(range_start)s" in sql
    assert "%(range_end)s" in sql
    assert params["range_start"] == start
    assert params["range_end"] == end


def test_apply_previous_time_filter_custom_computes_prior_window():
    params: dict = {}
    start = datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 7, 10, 23, 59, tzinfo=timezone.utc)

    sql = _apply_previous_time_filter("custom", start, end, params)

    assert sql is not None
    assert "%(prev_range_start)s" in sql
    assert params["prev_range_end"] == start
    assert params["prev_range_start"] == start - (end - start)


def test_window_minutes_custom_range():
    start = datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 6, 1, 1, 0, tzinfo=timezone.utc)
    assert _window_minutes("custom", start, end) == 60.0


def test_window_minutes_preset():
    assert _window_minutes("24h", None, None) == 1440.0
