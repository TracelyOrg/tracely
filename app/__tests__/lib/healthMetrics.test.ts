import { aggregateProjectHealthMetrics } from "@/lib/healthMetrics";
import type { ServiceHealth } from "@/types/health";

function makeService(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    name: "api",
    status: "healthy",
    request_rate: 100,
    error_rate: 0.5,
    p95_latency: 120,
    ...overrides,
  };
}

describe("aggregateProjectHealthMetrics", () => {
  it("returns null for empty services", () => {
    expect(aggregateProjectHealthMetrics([])).toBeNull();
  });

  it("sums request rates and weights error rate by traffic", () => {
    const result = aggregateProjectHealthMetrics([
      makeService({ request_rate: 100, error_rate: 2, p95_latency: 200 }),
      makeService({ request_rate: 50, error_rate: 4, p95_latency: 800 }),
    ]);

    expect(result).toEqual({
      totalRequestRate: 150,
      avgErrorRate: (2 * 100 + 4 * 50) / 150,
      maxP95: 800,
    });
  });

  it("returns null when all services have zero traffic and latency", () => {
    expect(
      aggregateProjectHealthMetrics([
        makeService({ request_rate: 0, error_rate: 0, p95_latency: 0 }),
      ])
    ).toBeNull();
  });
});
