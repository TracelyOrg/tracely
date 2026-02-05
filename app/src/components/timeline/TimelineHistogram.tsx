"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatBucketTimestamp, type TimeBucket } from "@/lib/timelineUtils";

/** Format Y-axis values: 1000 -> "1k", 2500 -> "2.5k" */
function formatYAxis(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(value);
}

interface TimelineHistogramProps {
  buckets: TimeBucket[];
  granularity: number;
  rangeStart: number;
  rangeEnd: number;
  isLive: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: number;
  granularity: number;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload) return null;

  const success = payload.find((p) => p.name === "successCount")?.value ?? 0;
  const errors = payload.find((p) => p.name === "errorCount")?.value ?? 0;

  return (
    <div className="rounded border border-border bg-popover px-2 py-1 text-xs shadow-md">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-foreground">{success}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span className="text-foreground">{errors}</span>
        </span>
      </div>
    </div>
  );
}

export function TimelineHistogram({
  buckets,
  granularity,
  rangeStart,
  rangeEnd,
  isLive,
}: TimelineHistogramProps) {
  // Format ticks for X-axis based on display range (not bucket array)
  // This ensures ticks slide smoothly with the domain
  const xAxisTicks = useMemo(() => {
    const rangeMs = rangeEnd - rangeStart;
    if (rangeMs <= 0) return [];

    // Compute tick interval to get ~6 ticks
    const tickCount = 6;
    const rawInterval = rangeMs / tickCount;

    // Round interval to nice values (align to granularity multiples)
    const tickInterval = Math.ceil(rawInterval / granularity) * granularity;

    // Align first tick to granularity boundary
    const firstTick = Math.ceil(rangeStart / tickInterval) * tickInterval;

    const ticks: number[] = [];
    for (let t = firstTick; t <= rangeEnd; t += tickInterval) {
      ticks.push(t);
    }

    return ticks;
  }, [rangeStart, rangeEnd, granularity]);

  if (buckets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data in selected time range
      </div>
    );
  }

  return (
    <div className="h-full w-full [&_.recharts-wrapper]:!outline-none [&_.recharts-surface]:!outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={buckets}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          barGap={0}
          barCategoryGap={1}
        >
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={[rangeStart, rangeEnd]}
            ticks={xAxisTicks}
            tickFormatter={(ts) => formatBucketTimestamp(ts, granularity)}
            tick={{ fontSize: 10, fill: "#a1a1aa" }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={{ stroke: "#3f3f46" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, "auto"]}
            tickFormatter={formatYAxis}
            tick={{ fontSize: 10, fill: "#a1a1aa" }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={{ stroke: "#3f3f46" }}
            width={30}
            allowDecimals={false}
          />
          <Tooltip
            content={<CustomTooltip granularity={granularity} />}
            cursor={false}
          />
          <Bar
            dataKey="successCount"
            stackId="requests"
            fill="#10b981"
            radius={[0, 0, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="errorCount"
            stackId="requests"
            fill="#ef4444"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
