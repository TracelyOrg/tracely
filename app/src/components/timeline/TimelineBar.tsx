"use client";

import { memo, useCallback } from "react";
import { useTimelineBuckets } from "./useTimelineBuckets";
import { TimelineHistogram } from "./TimelineHistogram";
import { useFilterStore } from "@/stores/filterStore";

/**
 * Live Request Timeline Bar - displays a time-bucketed histogram of requests
 * at the top of the log explorer. Supports click-drag to select a custom
 * time range directly on the chart.
 */
export const TimelineBar = memo(function TimelineBar() {
  const { buckets, rangeStart, rangeEnd, granularity, isLive } = useTimelineBuckets();
  const setTimeRange = useFilterStore((s) => s.setTimeRange);

  const handleRangeSelect = useCallback(
    (start: number, end: number) => {
      setTimeRange({
        preset: "custom",
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      });
    },
    [setTimeRange]
  );

  return (
    <div className="h-20 shrink-0 border-b border-border bg-background/50 px-2">
      <TimelineHistogram
        buckets={buckets}
        granularity={granularity}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        isLive={isLive}
        onRangeSelect={handleRangeSelect}
      />
    </div>
  );
});
