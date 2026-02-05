import type { SpanEvent, StatusCodeGroup, StreamFilters, TimeRangePreset } from "@/types/span";

/** Map an HTTP status code to its group (2xx, 3xx, 4xx, 5xx). */
export function getStatusCodeGroup(code: number): StatusCodeGroup | null {
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500 && code < 600) return "5xx";
  return null;
}

/** Convert a time range preset to milliseconds. */
function presetToMs(preset: TimeRangePreset): number {
  switch (preset) {
    case "5m": return 5 * 60 * 1000;
    case "15m": return 15 * 60 * 1000;
    case "1h": return 60 * 60 * 1000;
    case "6h": return 6 * 60 * 60 * 1000;
    case "24h": return 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

/**
 * Test whether a span matches all active filters including time range.
 *
 * Used for client-side filtering of both the buffered span list
 * and incoming SSE events before rendering.
 */
export function matchesFilters(span: SpanEvent, filters: StreamFilters): boolean {
  // Time range filter
  const spanTime = new Date(span.start_time).getTime();
  const now = Date.now();

  if (filters.timeRange.preset === "custom") {
    // Custom range: filter by start/end if provided
    if (filters.timeRange.start) {
      const rangeStart = new Date(filters.timeRange.start).getTime();
      if (spanTime < rangeStart) return false;
    }
    if (filters.timeRange.end) {
      const rangeEnd = new Date(filters.timeRange.end).getTime();
      if (spanTime > rangeEnd) return false;
    }
  } else {
    // Preset range: filter to last N minutes/hours
    const rangeMs = presetToMs(filters.timeRange.preset);
    if (rangeMs > 0) {
      const rangeStart = now - rangeMs;
      if (spanTime < rangeStart) return false;
    }
  }

  // Service filter
  if (filters.service !== null && span.service_name !== filters.service) {
    return false;
  }

  // Status code group filter
  if (filters.statusGroups.length > 0) {
    const group = getStatusCodeGroup(span.http_status_code);
    if (group === null || !filters.statusGroups.includes(group)) {
      return false;
    }
  }

  // Endpoint path search (case-insensitive substring match)
  if (filters.endpointSearch !== "") {
    const route = (span.http_route || span.span_name).toLowerCase();
    if (!route.includes(filters.endpointSearch.toLowerCase())) {
      return false;
    }
  }

  // Environment filter
  if (filters.environment !== null && span.environment !== filters.environment) {
    return false;
  }

  return true;
}
