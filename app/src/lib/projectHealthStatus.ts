import type { EndpointStats, ServiceStatus } from "@/types/dashboard";
import type { HealthStatus } from "@/types/health";
import { endpointIdentity, resolveEndpointP95 } from "@/lib/endpointStats";

/** Minimum error rate to surface an endpoint in Needs attention. */
export const ATTENTION_ERROR_RATE_MIN = 0.5;

/** Average latency at or above this threshold marks an endpoint as slow. */
export const ATTENTION_SLOW_LATENCY_MS = 500;

export type AttentionKind = "error" | "slow";

export interface AttentionEndpoint extends EndpointStats {
  kind: AttentionKind;
}

export interface ProjectStatusSummary {
  worst: HealthStatus | null;
  healthyCount: number;
  degradedCount: number;
  errorCount: number;
}

export function getWorstStatus(statuses: HealthStatus[]): HealthStatus | null {
  if (statuses.length === 0) return null;
  if (statuses.includes("error")) return "error";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

export function summarizeProjectStatus(
  services: ServiceStatus[]
): ProjectStatusSummary {
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const errorCount = services.filter((s) => s.status === "error").length;
  const worst = getWorstStatus(services.map((s) => s.status));

  return { worst, healthyCount, degradedCount, errorCount };
}

/** Services that need investigation, worst first. */
export function getAttentionServices(services: ServiceStatus[]): ServiceStatus[] {
  const rank = { error: 0, degraded: 1, healthy: 2 };
  return [...services]
    .filter((s) => s.status !== "healthy")
    .sort((a, b) => rank[a.status] - rank[b.status] || b.error_rate - a.error_rate);
}

/** Endpoints failing or running slow — deduped, errors prioritized. */
export function getAttentionEndpoints(
  endpoints: EndpointStats[],
  limit = 5
): AttentionEndpoint[] {
  const errors: AttentionEndpoint[] = [...endpoints]
    .filter((ep) => ep.error_rate >= ATTENTION_ERROR_RATE_MIN)
    .sort(
      (a, b) =>
        b.error_rate - a.error_rate || b.count - a.count
    )
    .map((ep) => ({ ...ep, kind: "error" as const }));

  const errorKeys = new Set(
    errors.map((ep) => endpointIdentity(ep.method, ep.route))
  );

  const slow: AttentionEndpoint[] = [...endpoints]
    .filter(
      (ep) =>
        ep.error_rate < ATTENTION_ERROR_RATE_MIN &&
        resolveEndpointP95(ep) >= ATTENTION_SLOW_LATENCY_MS
    )
    .filter((ep) => !errorKeys.has(endpointIdentity(ep.method, ep.route)))
    .sort(
      (a, b) =>
        resolveEndpointP95(b) - resolveEndpointP95(a) || b.count - a.count
    )
    .map((ep) => ({ ...ep, kind: "slow" as const }));

  const errorSlots = Math.min(errors.length, limit);
  const slowSlots = Math.min(slow.length, Math.max(0, limit - errorSlots));

  return [...errors.slice(0, errorSlots), ...slow.slice(0, slowSlots)];
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
