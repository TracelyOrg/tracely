import type { DataPoint } from "@/types/dashboard";
import type { TimeRange } from "@/types/span";
import { aggregateTimeSeries, getBucketMsForTimeRange } from "@/lib/dashboardChartAggregation";

const SPARKLINE_MAX_POINTS = 32;

function downsampleValues(values: number[], maxPoints = SPARKLINE_MAX_POINTS): number[] {
  if (values.length <= maxPoints) return values;
  const result: number[] = [];
  const chunkSize = values.length / maxPoints;
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * chunkSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * chunkSize));
    const slice = values.slice(start, end);
    result.push(slice.reduce((sum, v) => sum + v, 0) / slice.length);
  }
  return result;
}

function bucketSeries(
  data: DataPoint[],
  timeRange: TimeRange,
  mode: "avg" | "sum"
): number[] {
  if (data.length === 0) return [];
  const bucketMs = getBucketMsForTimeRange(timeRange);
  const aggregated = aggregateTimeSeries(data, bucketMs, mode);
  return downsampleValues(aggregated.map((p) => p.value));
}

function alignBucketedSeries(
  requests: DataPoint[],
  errors: DataPoint[],
  timeRange: TimeRange
): { req: number; err: number }[] {
  const bucketMs = getBucketMsForTimeRange(timeRange);
  const reqPoints = aggregateTimeSeries(requests, bucketMs, "sum");
  const errPoints = aggregateTimeSeries(errors, bucketMs, "sum");
  const errByTs = new Map(errPoints.map((p) => [p.timestamp, p.value]));
  return reqPoints.map((p) => ({
    req: p.value,
    err: errByTs.get(p.timestamp) ?? 0,
  }));
}

export function requestsSparkline(requests: DataPoint[], timeRange: TimeRange): number[] {
  return bucketSeries(requests, timeRange, "avg");
}

export function errorsSparkline(errors: DataPoint[], timeRange: TimeRange): number[] {
  return bucketSeries(errors, timeRange, "sum");
}

export function errorRateSparkline(
  requests: DataPoint[],
  errors: DataPoint[],
  timeRange: TimeRange
): number[] {
  const aligned = alignBucketedSeries(requests, errors, timeRange);
  return downsampleValues(
    aligned.map(({ req, err }) => (req > 0 ? (err / req) * 100 : 0))
  );
}

export function successRateSparkline(
  requests: DataPoint[],
  errors: DataPoint[],
  timeRange: TimeRange
): number[] {
  return errorRateSparkline(requests, errors, timeRange).map((rate) =>
    Math.max(0, 100 - rate)
  );
}

/** Flat line when no p95 time series — rendered as stroke-only, not a filled block. */
export function flatSparkline(value: number, points = SPARKLINE_MAX_POINTS): number[] {
  const safe = Number.isFinite(value) ? value : 0;
  return Array.from({ length: points }, () => safe);
}
