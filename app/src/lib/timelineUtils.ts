import type { SpanEvent, TimeRangePreset } from "@/types/span";

export interface TimeBucket {
  timestamp: number;      // Bucket start time (Unix ms)
  successCount: number;   // 2xx status codes
  errorCount: number;     // 4xx + 5xx status codes
}

/**
 * Convert a time range preset to milliseconds.
 */
export function presetToRangeMs(preset: TimeRangePreset): number {
  switch (preset) {
    case "5m":
      return 5 * 60 * 1000;
    case "15m":
      return 15 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "custom":
      return 0; // Caller must compute from start/end
    default:
      return 5 * 60 * 1000;
  }
}

/**
 * Auto-adjust bucket granularity to maintain ~60 bars per range.
 * Returns bucket size in milliseconds.
 */
export function getGranularity(rangeMs: number): number {
  if (rangeMs <= 5 * 60 * 1000) return 5_000;           // 5min → 5s buckets (60 bars)
  if (rangeMs <= 15 * 60 * 1000) return 15_000;         // 15min → 15s buckets (60 bars)
  if (rangeMs <= 60 * 60 * 1000) return 60_000;         // 1hr → 1min buckets (60 bars)
  if (rangeMs <= 6 * 60 * 60 * 1000) return 6 * 60_000; // 6hr → 6min buckets (60 bars)
  return 24 * 60_000;                                    // 24hr → 24min buckets (60 bars)
}

/**
 * Compute time buckets from spans for histogram display.
 * Returns array of buckets sorted by timestamp ascending.
 *
 * IMPORTANT: Bucket timestamps are clock-aligned (e.g., 10:00:00, 10:00:05)
 * not relative to rangeStart. This prevents visual glitches when the range shifts.
 */
export function computeBuckets(
  spans: SpanEvent[],
  rangeStart: number,
  rangeEnd: number,
  granularity: number
): TimeBucket[] {
  // Align first bucket to clock time (floor to granularity boundary)
  const alignedStart = Math.floor(rangeStart / granularity) * granularity;
  // Extend end to include partial bucket
  const alignedEnd = Math.ceil(rangeEnd / granularity) * granularity;

  const bucketCount = Math.round((alignedEnd - alignedStart) / granularity);
  const buckets: TimeBucket[] = [];

  // Create buckets at clock-aligned timestamps
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      timestamp: alignedStart + i * granularity,
      successCount: 0,
      errorCount: 0,
    });
  }

  // Create a map for O(1) bucket lookup
  const bucketMap = new Map<number, TimeBucket>();
  for (const bucket of buckets) {
    bucketMap.set(bucket.timestamp, bucket);
  }

  // Distribute spans into buckets
  for (const span of spans) {
    const spanTime = new Date(span.start_time).getTime();

    // Skip spans outside the range
    if (spanTime < alignedStart || spanTime >= alignedEnd) continue;

    // Find the bucket for this span (clock-aligned)
    const bucketTimestamp = Math.floor(spanTime / granularity) * granularity;
    const bucket = bucketMap.get(bucketTimestamp);
    if (!bucket) continue;

    // Categorize by status code
    const status = span.http_status_code;
    if (status >= 200 && status < 400) {
      bucket.successCount++;
    } else if (status >= 400) {
      bucket.errorCount++;
    } else {
      // Unknown or pending — count as success for now
      bucket.successCount++;
    }
  }

  return buckets;
}

/**
 * Format a timestamp for display on the timeline X-axis.
 * Adapts format based on granularity.
 */
export function formatBucketTimestamp(
  timestamp: number,
  granularity: number
): string {
  const date = new Date(timestamp);

  // For sub-minute granularity, show HH:MM:SS
  if (granularity < 60_000) {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  // For minute+ granularity, show HH:MM
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
