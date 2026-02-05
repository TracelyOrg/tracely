import { useMemo } from "react";
import { useLiveStreamStore } from "@/stores/liveStreamStore";
import { useFilterStore } from "@/stores/filterStore";
import {
  computeBuckets,
  getGranularity,
  presetToRangeMs,
  type TimeBucket,
} from "@/lib/timelineUtils";
import type { SpanEvent } from "@/types/span";

interface UseTimelineBucketsResult {
  buckets: TimeBucket[];
  rangeStart: number;
  rangeEnd: number;
  granularity: number;
  isLive: boolean;
}

/**
 * Hook that computes time-bucketed histogram data from the live stream.
 * Subscribes to both the span store and filter store to recompute when data changes.
 */
export function useTimelineBuckets(): UseTimelineBucketsResult {
  const spans = useLiveStreamStore((state) => state.spans);
  const childrenMap = useLiveStreamStore((state) => state.childrenMap);
  const timeRange = useFilterStore((state) => state.filters.timeRange);

  // Flatten all spans (roots + children) for bucketing
  const allSpans = useMemo<SpanEvent[]>(() => {
    const result: SpanEvent[] = [...spans];
    for (const children of Object.values(childrenMap)) {
      result.push(...children);
    }
    return result;
  }, [spans, childrenMap]);

  // Compute time range bounds
  const { rangeStart, rangeEnd, isLive } = useMemo(() => {
    const now = Date.now();

    if (timeRange.preset === "custom" && timeRange.start && timeRange.end) {
      return {
        rangeStart: new Date(timeRange.start).getTime(),
        rangeEnd: new Date(timeRange.end).getTime(),
        isLive: false,
      };
    }

    const rangeMs = presetToRangeMs(timeRange.preset);
    return {
      rangeStart: now - rangeMs,
      rangeEnd: now,
      isLive: true,
    };
  }, [timeRange]);

  // Compute granularity based on range
  const granularity = useMemo(() => {
    const rangeMs = rangeEnd - rangeStart;
    return getGranularity(rangeMs);
  }, [rangeStart, rangeEnd]);

  // Compute buckets
  const buckets = useMemo(() => {
    return computeBuckets(allSpans, rangeStart, rangeEnd, granularity);
  }, [allSpans, rangeStart, rangeEnd, granularity]);

  return {
    buckets,
    rangeStart,
    rangeEnd,
    granularity,
    isLive,
  };
}
