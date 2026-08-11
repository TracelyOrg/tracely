import type { DataPoint } from "@/types/dashboard";
import type { TimeRange, TimeRangePreset } from "@/types/span";

/** Target number of bars on the chart for readability. */
const TARGET_BARS = 72;

const PRESET_BUCKET_MS: Record<Exclude<TimeRangePreset, "custom">, number> = {
  "5m": 60_000,
  "15m": 60_000,
  "1h": 60_000,
  "6h": 5 * 60_000,
  "24h": 15 * 60_000,
};

export interface AggregatedChartPoint {
  timestamp: string;
  label: string;
  value: number;
  /** Peak value inside the bucket (throughput). */
  peakInBucket?: number;
  showTick: boolean;
}

export function getBucketMsForTimeRange(timeRange: TimeRange): number {
  if (timeRange.preset !== "custom") {
    return PRESET_BUCKET_MS[timeRange.preset];
  }
  if (!timeRange.start || !timeRange.end) {
    return 60_000;
  }
  const spanMs =
    new Date(timeRange.end).getTime() - new Date(timeRange.start).getTime();
  if (spanMs <= 0) return 60_000;
  const raw = spanMs / TARGET_BARS;
  // Round up to whole minutes
  return Math.max(60_000, Math.ceil(raw / 60_000) * 60_000);
}

function bucketStartMs(timestamp: string, bucketMs: number): number {
  return Math.floor(new Date(timestamp).getTime() / bucketMs) * bucketMs;
}

function formatBucketLabel(date: Date, spanMs: number): string {
  if (spanMs >= 20 * 60 * 60 * 1000) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
    });
  }
  if (spanMs >= 4 * 60 * 60 * 1000) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function assignAxisTicks(points: AggregatedChartPoint[], maxTicks = 7): void {
  if (points.length === 0) return;
  if (points.length <= maxTicks) {
    points.forEach((p) => {
      p.showTick = true;
    });
    return;
  }
  const step = Math.max(1, Math.floor(points.length / (maxTicks - 1)));
  points.forEach((p, i) => {
    p.showTick = i === 0 || i === points.length - 1 || i % step === 0;
  });
}

/**
 * Bucket minute-level time series for dashboard charts.
 * - `avg`: mean req/min per bucket (throughput)
 * - `sum`: total count per bucket (errors)
 */
export function aggregateTimeSeries(
  data: DataPoint[],
  bucketMs: number,
  mode: "avg" | "sum"
): AggregatedChartPoint[] {
  if (data.length === 0) return [];

  const sorted = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstMs = bucketStartMs(sorted[0].timestamp, bucketMs);
  const lastMs = bucketStartMs(sorted[sorted.length - 1].timestamp, bucketMs);
  const spanMs = lastMs - firstMs + bucketMs;

  type Acc = { sum: number; count: number; max: number };
  const buckets = new Map<number, Acc>();

  for (const point of sorted) {
    const key = bucketStartMs(point.timestamp, bucketMs);
    const acc = buckets.get(key) ?? { sum: 0, count: 0, max: 0 };
    acc.sum += point.value;
    acc.count += 1;
    acc.max = Math.max(acc.max, point.value);
    buckets.set(key, acc);
  }

  const points: AggregatedChartPoint[] = [];
  for (let t = firstMs; t <= lastMs; t += bucketMs) {
    const acc = buckets.get(t);
    const date = new Date(t);
    const value =
      acc == null
        ? 0
        : mode === "sum"
          ? acc.sum
          : acc.count > 0
            ? acc.sum / acc.count
            : 0;

    points.push({
      timestamp: date.toISOString(),
      label: formatBucketLabel(date, spanMs),
      value,
      peakInBucket: acc?.max,
      showTick: false,
    });
  }

  assignAxisTicks(points);
  return points;
}

export function computeThroughputStats(data: DataPoint[]): {
  avg: number;
  peak: number;
} {
  if (data.length === 0) return { avg: 0, peak: 0 };
  const values = data.map((d) => d.value);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avg: sum / values.length,
    peak: Math.max(...values),
  };
}

/** Format Y-axis and tooltip numbers compactly (1.2k, 3.4M). */
export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

/** Map latency ms to histogram bucket label (matches API buckets). */
export function latencyMsToBucketLabel(ms: number): string {
  if (ms < 50) return "<50";
  if (ms < 100) return "50-100";
  if (ms < 200) return "100-200";
  if (ms < 500) return "200-500";
  if (ms < 1000) return "500-1s";
  if (ms < 2000) return "1-2s";
  return ">2s";
}

export function axisTickFormatter(showTick: boolean, label: string): string {
  return showTick ? label : "";
}
