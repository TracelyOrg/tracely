/**
 * React Query key factories for consistent cache key management.
 *
 * Pattern: [resource, ...identifiers, ...filters]
 *
 * Usage:
 *   queryKey: queryKeys.health(projectId)
 *   queryKey: queryKeys.spans(projectId, { status: 'error' })
 */

export const queryKeys = {
  // Health aggregations for dashboard
  health: (projectId: string) => ["health", projectId] as const,

  // Spans list (future use)
  spans: (projectId: string, filters?: Record<string, unknown>) =>
    filters
      ? (["spans", projectId, filters] as const)
      : (["spans", projectId] as const),

  // Single span detail (future use)
  span: (projectId: string, spanId: string) =>
    ["span", projectId, spanId] as const,

  // Alert templates for project
  alertTemplates: (projectId: string) =>
    ["alerts", "templates", projectId] as const,

  // Alert history for project
  alertHistory: (projectId: string) =>
    ["alerts", "history", projectId] as const,

  // Single alert event detail
  alertEvent: (projectId: string, eventId: string) =>
    ["alerts", "event", projectId, eventId] as const,
};
