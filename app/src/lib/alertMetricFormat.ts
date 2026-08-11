import type { AlertCategory, AlertEvent } from "@/types/alert";

const PERCENT_PRESETS = new Set([
  "high_error_rate",
  "latency_spike",
  "traffic_drop",
  "traffic_surge",
]);

const LATENCY_PRESETS = new Set(["slow_responses"]);

/** Format alert metric/threshold values with the correct unit. */
export function formatAlertMetricValue(
  value: number,
  presetKey: string,
  category?: AlertCategory
): string {
  if (PERCENT_PRESETS.has(presetKey)) {
    return `${value.toFixed(1)}%`;
  }
  if (LATENCY_PRESETS.has(presetKey)) {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
  }
  if (presetKey === "service_down") {
    return `${Math.round(value)} req/min`;
  }

  // Fallback by category when preset is unknown
  if (category === "availability") return `${value.toFixed(1)}%`;
  if (category === "performance") {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
  }
  return `${Math.round(value)}%`;
}

/** Human-readable breach summary for alert list items. */
export function formatAlertBreachSummary(event: AlertEvent): string {
  const metric = formatAlertMetricValue(
    event.metric_value,
    event.rule_preset_key,
    event.rule_category
  );
  const threshold = formatAlertMetricValue(
    event.threshold_value,
    event.rule_preset_key,
    event.rule_category
  );
  return `${metric} (threshold ${threshold})`;
}
