import type { ServiceStatus, StatusCodeStats } from "@/types/dashboard";
import type { HealthStatus } from "@/types/health";
import type { ProjectStatusSummary } from "@/lib/projectHealthStatus";

const STATUS_SCORE: Record<HealthStatus, number> = {
  healthy: 100,
  degraded: 55,
  error: 15,
};

/** Weighted health score (0–100) from service statuses. */
export function computeHealthScore(services: ServiceStatus[]): number {
  if (services.length === 0) return 100;

  let totalWeight = 0;
  let weighted = 0;

  for (const service of services) {
    const weight = Math.max(service.request_rate, 1);
    weighted += STATUS_SCORE[service.status] * weight;
    totalWeight += weight;
  }

  return Math.round(weighted / totalWeight);
}

export interface StatusCodeSegment {
  code: string;
  count: number;
  pct: number;
}

export function buildStatusCodeSegments(
  statusCodes: StatusCodeStats[]
): StatusCodeSegment[] {
  const total = statusCodes.reduce((sum, sc) => sum + sc.count, 0);
  if (total === 0) {
    return ["2xx", "3xx", "4xx", "5xx"].map((code) => ({
      code,
      count: 0,
      pct: 0,
    }));
  }

  return statusCodes.map((sc) => ({
    code: sc.code,
    count: sc.count,
    pct: (sc.count / total) * 100,
  }));
}

export function healthStatusLabel(
  summary: ProjectStatusSummary,
  score: number
): { label: string; status: HealthStatus } {
  const status = summary.worst ?? (score >= 85 ? "healthy" : score >= 60 ? "degraded" : "error");
  const labels: Record<HealthStatus, string> = {
    healthy: "Operational",
    degraded: "Degraded",
    error: "Errors detected",
  };
  return { label: labels[status], status };
}
