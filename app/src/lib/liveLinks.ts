import type { StatusCodeGroup, TimeRange, TimeRangePreset } from "@/types/span";

export interface LiveLinkOptions {
  timeRange?: TimeRange;
  service?: string;
  /** Endpoint path substring filter */
  search?: string;
  statusGroups?: StatusCodeGroup[];
  environment?: string | null;
}

/** Build a Live page URL with filter query params for dashboard drill-down. */
export function buildLiveUrl(
  orgSlug: string,
  projectSlug: string,
  options: LiveLinkOptions = {}
): string {
  const params = new URLSearchParams();
  const range = options.timeRange;

  if (range) {
    if (range.preset !== "5m") params.set("time", range.preset);
    if (range.preset === "custom") {
      if (range.start) params.set("start", range.start);
      if (range.end) params.set("end", range.end);
    }
  }

  if (options.service) params.set("service", options.service);
  if (options.search) params.set("search", options.search);
  if (options.environment) params.set("env", options.environment);
  if (options.statusGroups?.length) {
    params.set("status", options.statusGroups.join(","));
  }

  const qs = params.toString();
  return `/${orgSlug}/${projectSlug}/live${qs ? `?${qs}` : ""}`;
}

const PRESET_LABELS: Record<Exclude<TimeRangePreset, "custom">, string> = {
  "5m": "Last 5 minutes",
  "15m": "Last 15 minutes",
  "1h": "Last hour",
  "6h": "Last 6 hours",
  "24h": "Last 24 hours",
};

/** Plain-language label for the dashboard time window. */
export function formatTimeRangeLabel(timeRange: TimeRange): string {
  if (timeRange.preset === "custom") {
    if (timeRange.start && timeRange.end) {
      const fmt = (iso: string) =>
        new Date(iso).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      return `${fmt(timeRange.start)} – ${fmt(timeRange.end)}`;
    }
    return "Custom range";
  }
  return PRESET_LABELS[timeRange.preset];
}

const VALID_PRESETS = new Set<string>(["5m", "15m", "1h", "6h", "24h", "custom"]);

/** Dashboard default — 15m is the shortest window (5m is Live-only). */
export const DASHBOARD_DEFAULT_PRESET: TimeRangePreset = "15m";

const DASHBOARD_VALID_PRESETS = new Set<string>([
  "15m",
  "1h",
  "6h",
  "24h",
  "custom",
]);

/** Clamp Live/legacy presets to a dashboard-supported window. */
export function normalizeDashboardTimeRange(timeRange: TimeRange): TimeRange {
  if (timeRange.preset === "5m") {
    return { preset: DASHBOARD_DEFAULT_PRESET };
  }
  if (DASHBOARD_VALID_PRESETS.has(timeRange.preset)) {
    return timeRange;
  }
  return { preset: DASHBOARD_DEFAULT_PRESET };
}

/** Read timeframe from URL search params (sync, for first-paint query keys). */
export function parseTimeRangeFromSearchParams(
  params: Pick<URLSearchParams, "get">
): TimeRange | null {
  const time = params.get("time");
  if (!time || !VALID_PRESETS.has(time)) return null;

  return {
    preset: time as TimeRangePreset,
    start: params.get("start") ?? undefined,
    end: params.get("end") ?? undefined,
  };
}

/** True when client query params match the SSR dashboard prefetch (15m, no env). */
export function matchesDashboardSsrPrefetch(
  timeRange: TimeRange,
  environment: string | null | undefined
): boolean {
  return (
    timeRange.preset === DASHBOARD_DEFAULT_PRESET &&
    !timeRange.start &&
    !timeRange.end &&
    !environment
  );
}

const PREVIOUS_PERIOD_LABELS: Record<Exclude<TimeRangePreset, "custom">, string> = {
  "5m": "previous 5 min",
  "15m": "previous 15 min",
  "1h": "previous hour",
  "6h": "previous 6 hours",
  "24h": "previous 24 hours",
};

const TREND_BASELINE_LABELS: Record<Exclude<TimeRangePreset, "custom">, string> = {
  "5m": "last 5 minutes",
  "15m": "last 15 minutes",
  "1h": "last hour",
  "6h": "last 6 hours",
  "24h": "last 24 hours",
};

/** Short label for trend comparisons tied to the selected timeframe. */
export function formatPreviousPeriodLabel(timeRange: TimeRange): string {
  if (timeRange.preset === "custom") return "previous period";
  return PREVIOUS_PERIOD_LABELS[timeRange.preset];
}

/** Baseline window for KPI trends — use after "than" (e.g. "+12% than last 15 minutes"). */
export function formatTrendBaselineLabel(timeRange: TimeRange): string {
  if (timeRange.preset === "custom") return "previous period";
  return TREND_BASELINE_LABELS[timeRange.preset];
}
