import {
  aggregateTimeSeries,
  computeThroughputStats,
  formatCompactNumber,
  getBucketMsForTimeRange,
  latencyMsToBucketLabel,
} from "@/lib/dashboardChartAggregation";
import type { DataPoint } from "@/types/dashboard";

function minuteSeries(count: number, startMs: number, valueFn: (i: number) => number): DataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(startMs + i * 60_000).toISOString(),
    value: valueFn(i),
  }));
}

describe("dashboardChartAggregation", () => {
  it("uses 15-minute buckets for 24h preset", () => {
    expect(getBucketMsForTimeRange({ preset: "24h" })).toBe(15 * 60_000);
  });

  it("aggregates throughput as average per bucket", () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    const data = minuteSeries(15, start, (i) => (i === 0 ? 200 : i === 1 ? 400 : 100));

    const buckets = aggregateTimeSeries(data, 15 * 60_000, "avg");
    expect(buckets).toHaveLength(1);
    expect(buckets[0].peakInBucket).toBe(400);
    expect(buckets[0].value).toBeCloseTo((200 + 400 + 13 * 100) / 15, 5);
  });

  it("aggregates errors as sum per bucket", () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    const data = minuteSeries(3, start, (i) => (i === 1 ? 5 : 0));

    const buckets = aggregateTimeSeries(data, 60_000, "sum");
    expect(buckets[1].value).toBe(5);
  });

  it("formats compact numbers", () => {
    expect(formatCompactNumber(1287)).toBe("1.3k");
    expect(formatCompactNumber(42)).toBe("42");
  });

  it("maps latency to bucket labels", () => {
    expect(latencyMsToBucketLabel(34)).toBe("<50");
    expect(latencyMsToBucketLabel(737)).toBe("500-1s");
  });

  it("computes throughput avg and peak", () => {
    const stats = computeThroughputStats([
      { timestamp: "2026-01-01T00:00:00Z", value: 100 },
      { timestamp: "2026-01-01T00:01:00Z", value: 300 },
    ]);
    expect(stats.avg).toBe(200);
    expect(stats.peak).toBe(300);
  });
});
