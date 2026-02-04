import type { SpanEvent, StatusCodeGroup, StreamFilters } from "@/types/span";

/** Map an HTTP status code to its group (2xx, 3xx, 4xx, 5xx). */
export function getStatusCodeGroup(code: number): StatusCodeGroup | null {
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500 && code < 600) return "5xx";
  return null;
}

/**
 * Test whether a span matches all active filters.
 *
 * Used for client-side filtering of both the buffered span list
 * and incoming SSE events before rendering.
 *
 * Time range filtering is NOT applied here — it controls the
 * live-vs-historical mode at a higher level.
 */
export function matchesFilters(span: SpanEvent, filters: StreamFilters): boolean {
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
