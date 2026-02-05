"use client";

import { useTimelineBuckets } from "./useTimelineBuckets";
import { TimelineHistogram } from "./TimelineHistogram";

/**
 * Live Request Timeline Bar - displays a time-bucketed histogram of requests
 * at the top of the log explorer.
 */
export function TimelineBar() {
  const { buckets, rangeStart, rangeEnd, granularity, isLive } = useTimelineBuckets();

  return (
    <div className="h-20 shrink-0 border-b border-border bg-background/50 px-2">
      <TimelineHistogram
        buckets={buckets}
        granularity={granularity}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        isLive={isLive}
      />
    </div>
  );
}
