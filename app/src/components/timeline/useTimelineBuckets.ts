import { useMemo, useState, useEffect, useRef } from "react";
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

  // Determine if we're in live mode
  const isLive = !(timeRange.preset === "custom" && timeRange.start && timeRange.end);

  // Compute range duration for live mode
  const rangeMs = useMemo(() => {
    if (!isLive) return 0;
    return presetToRangeMs(timeRange.preset);
  }, [isLive, timeRange.preset]);

  // Compute granularity
  const granularity = useMemo(() => {
    if (!isLive) {
      if (timeRange.start && timeRange.end) {
        const customRangeMs = new Date(timeRange.end).getTime() - new Date(timeRange.start).getTime();
        return getGranularity(customRangeMs);
      }
      return 5000;
    }
    return getGranularity(rangeMs);
  }, [isLive, rangeMs, timeRange.start, timeRange.end]);

  // Smooth "now" timestamp - updates every frame for smooth scrolling
  const [now, setNow] = useState(() => Date.now());
  const rafRef = useRef<number>(0);

  // Update "now" every frame when in live mode
  useEffect(() => {
    if (!isLive) return;

    const animate = () => {
      setNow(Date.now());
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isLive]);

  // Compute time range bounds for display (smooth)
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (!isLive && timeRange.start && timeRange.end) {
      return {
        rangeStart: new Date(timeRange.start).getTime(),
        rangeEnd: new Date(timeRange.end).getTime(),
      };
    }

    return {
      rangeStart: now - rangeMs,
      rangeEnd: now,
    };
  }, [isLive, timeRange.start, timeRange.end, now, rangeMs]);

  // Aligned "now" for bucket computation - only changes at bucket boundaries
  // This prevents bucket recalculation every frame
  const alignedNow = useMemo(() => {
    return Math.ceil(now / granularity) * granularity;
  }, [Math.floor(now / granularity), granularity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bucket computation range (wider than display for buffer)
  const { bucketRangeStart, bucketRangeEnd } = useMemo(() => {
    if (!isLive && timeRange.start && timeRange.end) {
      return {
        bucketRangeStart: new Date(timeRange.start).getTime(),
        bucketRangeEnd: new Date(timeRange.end).getTime(),
      };
    }

    // Add buffer of 5 buckets on each side
    const buffer = granularity * 5;
    return {
      bucketRangeStart: alignedNow - rangeMs - buffer,
      bucketRangeEnd: alignedNow + buffer,
    };
  }, [isLive, timeRange.start, timeRange.end, alignedNow, rangeMs, granularity]);

  // Compute buckets (only recalculates when alignedNow changes, not every frame)
  const buckets = useMemo(() => {
    return computeBuckets(allSpans, bucketRangeStart, bucketRangeEnd, granularity);
  }, [allSpans, bucketRangeStart, bucketRangeEnd, granularity]);

  return {
    buckets,
    rangeStart,
    rangeEnd,
    granularity,
    isLive,
  };
}
