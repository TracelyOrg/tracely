"use client";

import { useCallback } from "react";
import { useTimelineBuckets } from "./useTimelineBuckets";
import { TimelineHistogram } from "./TimelineHistogram";

interface TimelineBarProps {
  onBrushSelection?: (start: string, end: string) => void;
}

/**
 * Live Request Timeline Bar - displays a time-bucketed histogram of requests
 * at the top of the log explorer with brush-to-select filtering.
 */
export function TimelineBar({ onBrushSelection }: TimelineBarProps) {
  const { buckets, rangeStart, rangeEnd, granularity, isLive } = useTimelineBuckets();

  const handleBrushChange = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!onBrushSelection || buckets.length === 0) return;

      const startBucket = buckets[startIndex];
      const endBucket = buckets[endIndex];

      if (startBucket && endBucket) {
        // Convert timestamps to ISO strings
        const start = new Date(startBucket.timestamp).toISOString();
        // End should be the end of the bucket, not the start
        const end = new Date(endBucket.timestamp + granularity).toISOString();
        onBrushSelection(start, end);
      }
    },
    [buckets, granularity, onBrushSelection]
  );

  return (
    <div className="h-20 shrink-0 border-b border-border bg-background/50 px-2">
      <TimelineHistogram
        buckets={buckets}
        granularity={granularity}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        isLive={isLive}
        onBrushChange={handleBrushChange}
      />
    </div>
  );
}
