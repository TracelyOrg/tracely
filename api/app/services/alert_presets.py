"""Preset alert template definitions.

These presets define the available alert templates that users can activate.
The presets are constants - user customizations are stored in the alert_rules table.

Categories:
- availability: Service health and error monitoring
- performance: Latency and response time monitoring
- volume: Traffic and throughput monitoring
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


AlertCategory = Literal["availability", "performance", "volume"]
ComparisonOperator = Literal["gt", "lt", "eq", "gte", "lte", "pct_increase", "pct_decrease"]
MetricType = Literal["error_rate", "request_count", "p95_latency"]


@dataclass(frozen=True)
class AlertPreset:
    """Immutable alert template definition."""
    key: str
    name: str
    category: AlertCategory
    description: str
    default_threshold: float
    default_duration: int  # seconds
    comparison: ComparisonOperator
    metric: MetricType


# Availability presets - monitor service health
HIGH_ERROR_RATE = AlertPreset(
    key="high_error_rate",
    name="High Error Rate",
    category="availability",
    description="Fires when error rate exceeds threshold",
    default_threshold=5.0,  # 5%
    default_duration=300,   # 5 minutes
    comparison="gt",
    metric="error_rate",
)

SERVICE_DOWN = AlertPreset(
    key="service_down",
    name="Service Down",
    category="availability",
    description="Fires when no requests received",
    default_threshold=0,
    default_duration=180,   # 3 minutes
    comparison="eq",
    metric="request_count",
)

# Performance presets - monitor latency
SLOW_RESPONSES = AlertPreset(
    key="slow_responses",
    name="Slow Responses",
    category="performance",
    description="Fires when p95 latency exceeds threshold",
    default_threshold=2000,  # 2 seconds in ms
    default_duration=300,
    comparison="gt",
    metric="p95_latency",
)

LATENCY_SPIKE = AlertPreset(
    key="latency_spike",
    name="Latency Spike",
    category="performance",
    description="Fires when p95 increases 200%+ vs previous hour",
    default_threshold=200,  # 200% increase
    default_duration=60,
    comparison="pct_increase",
    metric="p95_latency",
)

# Volume presets - monitor traffic patterns
TRAFFIC_DROP = AlertPreset(
    key="traffic_drop",
    name="Traffic Drop",
    category="volume",
    description="Fires when request volume drops 50%+ vs previous hour",
    default_threshold=50,
    default_duration=300,
    comparison="pct_decrease",
    metric="request_count",
)

TRAFFIC_SURGE = AlertPreset(
    key="traffic_surge",
    name="Traffic Surge",
    category="volume",
    description="Fires when request volume increases 300%+",
    default_threshold=300,
    default_duration=300,
    comparison="pct_increase",
    metric="request_count",
)


# All presets indexed by key for easy lookup
ALERT_PRESETS: dict[str, AlertPreset] = {
    HIGH_ERROR_RATE.key: HIGH_ERROR_RATE,
    SERVICE_DOWN.key: SERVICE_DOWN,
    SLOW_RESPONSES.key: SLOW_RESPONSES,
    LATENCY_SPIKE.key: LATENCY_SPIKE,
    TRAFFIC_DROP.key: TRAFFIC_DROP,
    TRAFFIC_SURGE.key: TRAFFIC_SURGE,
}


def get_preset(key: str) -> AlertPreset | None:
    """Get a preset by its key."""
    return ALERT_PRESETS.get(key)


def get_all_presets() -> list[AlertPreset]:
    """Get all available presets."""
    return list(ALERT_PRESETS.values())


def get_presets_by_category(category: AlertCategory) -> list[AlertPreset]:
    """Get all presets for a specific category."""
    return [p for p in ALERT_PRESETS.values() if p.category == category]
