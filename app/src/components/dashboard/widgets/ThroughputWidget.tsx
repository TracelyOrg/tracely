"use client";

import { memo, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { DataPoint } from "@/types/dashboard";
import type { TimeRange } from "@/types/span";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardChartTooltip } from "@/components/dashboard/charts/DashboardChartTooltip";
import { DASHBOARD_CHART, formatAggregatedAxisTick } from "@/lib/dashboardChartTheme";
import {
  aggregateTimeSeries,
  computeThroughputStats,
  formatCompactNumber,
  getBucketMsForTimeRange,
} from "@/lib/dashboardChartAggregation";
import { DASHBOARD_METRIC_HELP } from "@/lib/dashboardMetricHelp";

interface ThroughputWidgetProps {
  data: DataPoint[];
  timeRange: TimeRange;
  className?: string;
}

function timeRangeKey(timeRange: TimeRange): string {
  return `${timeRange.preset}|${timeRange.start ?? ""}|${timeRange.end ?? ""}`;
}

function ThroughputWidgetInner({ data, timeRange, className }: ThroughputWidgetProps) {
  const stats = useMemo(() => computeThroughputStats(data), [data]);
  const rangeKey = timeRangeKey(timeRange);

  const chartData = useMemo(() => {
    const bucketMs = getBucketMsForTimeRange(timeRange);
    return aggregateTimeSeries(data, bucketMs, "avg");
  }, [data, rangeKey, timeRange]);

  return (
    <DashboardPanel
      title="Throughput"
      description={DASHBOARD_METRIC_HELP.throughput}
      testId="throughput-widget"
      className={className}
      action={
        <span className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
          <span>
            avg {formatCompactNumber(stats.avg)}
            <span className="ml-1">/min</span>
          </span>
          <span className="hidden text-border sm:inline" aria-hidden>
            ·
          </span>
          <span className="hidden sm:inline">
            peak {formatCompactNumber(stats.peak)}
            <span className="ml-1">/min</span>
          </span>
        </span>
      }
    >
      <div
        className={DASHBOARD_CHART.heightClass}
        aria-label={`Throughput chart, average ${Math.round(stats.avg)} per minute, peak ${Math.round(stats.peak)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={DASHBOARD_CHART.margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={DASHBOARD_CHART.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: DASHBOARD_CHART.axis }}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickFormatter={(label, index) => formatAggregatedAxisTick(chartData, String(label), index)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: DASHBOARD_CHART.axis }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => formatCompactNumber(Number(v))}
              allowDecimals={false}
            />
            <Tooltip
              cursor={DASHBOARD_CHART.tooltipCursor}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as (typeof chartData)[0];
                return (
                  <DashboardChartTooltip label={point.label}>
                    <p>{Math.round(point.value).toLocaleString()} req/min avg</p>
                    {point.peakInBucket != null && point.peakInBucket !== point.value && (
                      <p className="mt-0.5 font-normal text-muted-foreground">
                        peak {Math.round(point.peakInBucket).toLocaleString()} req/min
                      </p>
                    )}
                  </DashboardChartTooltip>
                );
              }}
            />
            <Bar
              dataKey="value"
              fill={DASHBOARD_CHART.bar}
              activeBar={DASHBOARD_CHART.activeBar}
              radius={[2, 2, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardPanel>
  );
}

export const ThroughputWidget = memo(ThroughputWidgetInner);
export default ThroughputWidget;
