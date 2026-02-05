"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Cell,
  ReferenceLine,
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
  onBrushChange?: (startIndex: number, endIndex: number) => void;
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

function CustomTooltip({ active, payload, label, granularity }: CustomTooltipProps) {
  if (!active || !payload || !label) return null;

  const timestamp = formatBucketTimestamp(label, granularity);
  const success = payload.find((p) => p.name === "successCount")?.value ?? 0;
  const errors = payload.find((p) => p.name === "errorCount")?.value ?? 0;
  const total = success + errors;

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="font-medium text-foreground">{timestamp}</div>
      <div className="mt-1 space-y-0.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">Success:</span>
          <span className="font-medium text-foreground">{success}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-muted-foreground">Errors:</span>
          <span className="font-medium text-foreground">{errors}</span>
        </div>
        <div className="mt-1 border-t border-border pt-1">
          <span className="text-muted-foreground">Total:</span>
          <span className="ml-1 font-medium text-foreground">{total}</span>
        </div>
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
  onBrushChange,
}: TimelineHistogramProps) {
  const [brushIndices, setBrushIndices] = useState<{ start: number; end: number } | null>(null);

  // Format ticks for X-axis (show ~5-7 ticks)
  const xAxisTicks = useMemo(() => {
    if (buckets.length === 0) return [];
    const step = Math.max(1, Math.floor(buckets.length / 6));
    const ticks: number[] = [];
    for (let i = 0; i < buckets.length; i += step) {
      ticks.push(buckets[i].timestamp);
    }
    // Always include last tick
    if (ticks[ticks.length - 1] !== buckets[buckets.length - 1].timestamp) {
      ticks.push(buckets[buckets.length - 1].timestamp);
    }
    return ticks;
  }, [buckets]);

  const handleBrushChange = useCallback(
    (brushData: { startIndex?: number; endIndex?: number }) => {
      if (brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
        setBrushIndices({ start: brushData.startIndex, end: brushData.endIndex });
        onBrushChange?.(brushData.startIndex, brushData.endIndex);
      }
    },
    [onBrushChange]
  );

  if (buckets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data in selected time range
      </div>
    );
  }

  return (
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
          cursor={{ fill: "#27272a", opacity: 0.5 }}
        />
        <Bar
          dataKey="successCount"
          stackId="requests"
          fill="#10b981"
          radius={[0, 0, 0, 0]}
          isAnimationActive={false}
        >
          {buckets.map((_, index) => (
            <Cell
              key={index}
              fillOpacity={
                brushIndices
                  ? index >= brushIndices.start && index <= brushIndices.end
                    ? 1
                    : 0.3
                  : 1
              }
            />
          ))}
        </Bar>
        <Bar
          dataKey="errorCount"
          stackId="requests"
          fill="#ef4444"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        >
          {buckets.map((_, index) => (
            <Cell
              key={index}
              fillOpacity={
                brushIndices
                  ? index >= brushIndices.start && index <= brushIndices.end
                    ? 1
                    : 0.3
                  : 1
              }
            />
          ))}
        </Bar>
        {isLive && (
          <ReferenceLine
            x={Date.now()}
            stroke="#22c55e"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
