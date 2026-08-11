"use client";

import { memo, useCallback, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import type { DataPoint } from "@/types/dashboard";
import type { TimeRange, TimeRangePreset } from "@/types/span";
import { useRouter } from "next/navigation";
import { buildLiveUrl } from "@/lib/liveLinks";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardWindowNudge } from "@/components/dashboard/DashboardWindowNudge";
import { DashboardChartTooltip } from "@/components/dashboard/charts/DashboardChartTooltip";
import { DASHBOARD_CHART, formatAggregatedAxisTick } from "@/lib/dashboardChartTheme";
import {
  aggregateTimeSeries,
  formatCompactNumber,
  getBucketMsForTimeRange,
} from "@/lib/dashboardChartAggregation";
import { DASHBOARD_METRIC_HELP } from "@/lib/dashboardMetricHelp";

interface ErrorsTimelineWidgetProps {
  data: DataPoint[];
  timeRange: TimeRange;
  orgSlug?: string;
  projectSlug?: string;
  environment?: string | null;
  onExpandWindow?: (preset: TimeRangePreset) => void;
  className?: string;
}

function timeRangeKey(timeRange: TimeRange): string {
  return `${timeRange.preset}|${timeRange.start ?? ""}|${timeRange.end ?? ""}`;
}

function ErrorsTimelineWidgetInner({
  data,
  timeRange,
  orgSlug,
  projectSlug,
  environment,
  onExpandWindow,
  className,
}: ErrorsTimelineWidgetProps) {
  const router = useRouter();
  const drillDown = !!(orgSlug && projectSlug);
  const rangeKey = timeRangeKey(timeRange);

  const chartData = useMemo(() => {
    const bucketMs = getBucketMsForTimeRange(timeRange);
    return aggregateTimeSeries(data, bucketMs, "sum");
  }, [data, rangeKey, timeRange]);

  const totalErrors = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  const navigateToErrorBucket = useCallback(
    (timestamp: string, errors: number) => {
      if (!drillDown || errors <= 0) return;

      const bucketMs = getBucketMsForTimeRange(timeRange);
      const start = timestamp;
      const end = new Date(new Date(timestamp).getTime() + bucketMs).toISOString();
      router.push(
        buildLiveUrl(orgSlug!, projectSlug!, {
          timeRange: { preset: "custom", start, end },
          environment,
          statusGroups: ["4xx", "5xx"],
        })
      );
    },
    [drillDown, timeRange, orgSlug, projectSlug, environment, router]
  );

  const resolveClickedIndex = (
    state: { activeTooltipIndex?: string | number | null; activeIndex?: string | number | null }
  ): number | null => {
    const rawIndex = state.activeTooltipIndex ?? state.activeIndex;
    if (rawIndex == null || rawIndex === "") return null;
    return Number(rawIndex);
  };

  return (
    <DashboardPanel
      title="Errors"
      description={DASHBOARD_METRIC_HELP.errorsTimeline}
      testId="errors-timeline-widget"
      className={className}
      action={
        <span className="text-xs tabular-nums text-muted-foreground">
          {totalErrors.toLocaleString()} total
        </span>
      }
    >
      <div
        className={`${DASHBOARD_CHART.heightClass} ${drillDown ? "cursor-pointer touch-manipulation" : ""}`}
        aria-label={`Errors over time, ${totalErrors} total`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={DASHBOARD_CHART.margin}
            onClick={
              drillDown
                ? (state) => {
                    const index = resolveClickedIndex(state);
                    if (index == null) return;
                    const point = chartData[index];
                    if (point) navigateToErrorBucket(point.timestamp, point.value);
                  }
                : undefined
            }
          >
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
              width={36}
              allowDecimals={false}
              tickFormatter={(v) => formatCompactNumber(Number(v))}
            />
            <Tooltip
              cursor={DASHBOARD_CHART.tooltipCursor}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as (typeof chartData)[0];
                return (
                  <DashboardChartTooltip label={point.label}>
                    <span className="text-destructive">
                      {Math.round(point.value).toLocaleString()} errors
                    </span>
                  </DashboardChartTooltip>
                );
              }}
            />
            <Bar
              dataKey="value"
              activeBar={DASHBOARD_CHART.activeBarError}
              radius={[2, 2, 0, 0]}
              maxBarSize={28}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.value > 0 ? "var(--dash-status-5xx)" : "transparent"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {totalErrors === 0 && (
        <DashboardWindowNudge
          subject="error activity"
          timeRange={timeRange}
          onExpandWindow={onExpandWindow}
          className="mt-2"
        />
      )}
    </DashboardPanel>
  );
}

export const ErrorsTimelineWidget = memo(ErrorsTimelineWidgetInner);
export default ErrorsTimelineWidget;
