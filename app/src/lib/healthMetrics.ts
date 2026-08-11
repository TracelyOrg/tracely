import type { ServiceHealth } from "@/types/health";

export interface ProjectHealthMetrics {
  totalRequestRate: number;
  avgErrorRate: number;
  maxP95: number;
}

/** Roll up per-service /health metrics into project-level header values. */
export function aggregateProjectHealthMetrics(
  services: ServiceHealth[]
): ProjectHealthMetrics | null {
  if (services.length === 0) return null;

  const totalRequestRate = services.reduce((sum, s) => sum + s.request_rate, 0);
  const weightedErrorSum = services.reduce(
    (sum, s) => sum + s.error_rate * s.request_rate,
    0
  );
  const avgErrorRate =
    totalRequestRate > 0 ? weightedErrorSum / totalRequestRate : 0;
  const maxP95 = Math.max(...services.map((s) => s.p95_latency));

  if (totalRequestRate <= 0 && maxP95 <= 0) return null;

  return { totalRequestRate, avgErrorRate, maxP95 };
}
