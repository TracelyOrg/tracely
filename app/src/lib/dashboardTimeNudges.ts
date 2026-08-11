import type { TimeRange, TimeRangePreset } from "@/types/span";

/** Dashboard preset order from narrowest to widest. */
export const DASHBOARD_PRESET_ORDER: TimeRangePreset[] = ["15m", "1h", "6h", "24h"];

const VIEWING_LABELS: Record<Exclude<TimeRangePreset, "custom" | "5m">, string> = {
  "15m": "the last 15 minutes",
  "1h": "the last hour",
  "6h": "the last 6 hours",
  "24h": "the last 24 hours",
};

const TRY_LABELS: Record<Exclude<TimeRangePreset, "custom" | "5m">, string> = {
  "15m": "Try the last 15 minutes",
  "1h": "Try the last hour",
  "6h": "Try the last 6 hours",
  "24h": "Try the last 24 hours",
};

/** Next wider dashboard window, or null if already at max / custom range. */
export function getWiderDashboardPreset(timeRange: TimeRange): TimeRangePreset | null {
  if (timeRange.preset === "custom" || timeRange.preset === "5m") {
    return null;
  }
  const idx = DASHBOARD_PRESET_ORDER.indexOf(timeRange.preset);
  if (idx < 0 || idx >= DASHBOARD_PRESET_ORDER.length - 1) {
    return null;
  }
  return DASHBOARD_PRESET_ORDER[idx + 1];
}

export function formatViewingWindowLabel(timeRange: TimeRange): string | null {
  if (timeRange.preset === "custom") return "this custom range";
  if (timeRange.preset === "5m") return VIEWING_LABELS["15m"];
  return VIEWING_LABELS[timeRange.preset] ?? null;
}

export function formatTryWiderLabel(preset: TimeRangePreset): string {
  if (preset === "5m") return TRY_LABELS["15m"];
  return TRY_LABELS[preset as keyof typeof TRY_LABELS] ?? `Try ${preset}`;
}
