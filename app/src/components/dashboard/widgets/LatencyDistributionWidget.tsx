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
  ReferenceLine,
} from "recharts";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DASHBOARD_CHART } from "@/lib/dashboardChartTheme";
import type { LatencyBucket } from "@/types/dashboard";
import type { TimeRange, TimeRangePreset } from "@/types/span";
import { DashboardWindowNudge } from "@/components/dashboard/DashboardWindowNudge";
import { DashboardChartTooltip } from "@/components/dashboard/charts/DashboardChartTooltip";
import { latencyMsToBucketLabel, formatCompactNumber } from "@/lib/dashboardChartAggregation";
import { DASHBOARD_METRIC_HELP } from "@/lib/dashboardMetricHelp";

interface LatencyDistributionWidgetProps {
  data: LatencyBucket[];
  p50?: number;
  p95?: number;
  p99?: number;
  timeRange?: TimeRange;
  onExpandWindow?: (preset: TimeRangePreset) => void;
  className?: string;
}

function LatencyDistributionWidgetInner({
  data,
  p50,
  p95,
  timeRange,
  onExpandWindow,
  className,
}: LatencyDistributionWidgetProps) {
  const formatLatency = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
  };

  const chartData = useMemo(
    () =>
      data.map((bucket) => ({
        ...bucket,
        count: Number(bucket.count) || 0,
      })),
    [data]
  );

  const total = useMemo(
    () => chartData.reduce((sum, bucket) => sum + bucket.count, 0),
    [chartData]
  );

  const hasDistribution = total > 0;

  const p50Bucket = p50 != null ? latencyMsToBucketLabel(p50) : null;
  const p95Bucket = p95 != null ? latencyMsToBucketLabel(p95) : null;

  const summary =
    p50 !== undefined && p95 !== undefined
      ? `p50 ${formatLatency(p50)} · p95 ${formatLatency(p95)}`
      : undefined;

  return (
    <DashboardPanel
      title="Latency"
      description={DASHBOARD_METRIC_HELP.latencyDistribution}
      testId="latency-distribution-widget"
      className={className}
      action={
        summary ? (
          <span className="max-w-[12rem] truncate text-xs tabular-nums text-muted-foreground sm:max-w-none">
            {summary}
          </span>
        ) : undefined
      }
    >
      <div className={DASHBOARD_CHART.heightClass}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ ...DASHBOARD_CHART.margin, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={DASHBOARD_CHART.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: DASHBOARD_CHART.axis }}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={44}
            />
            <YAxis
              tick={{ fontSize: 10, fill: DASHBOARD_CHART.axis }}
              tickLine={false}
              axisLine={false}
              width={44}
              allowDecimals={false}
              tickFormatter={(v) => formatCompactNumber(Number(v))}
            />
            {p50Bucket && (
              <ReferenceLine
                x={p50Bucket}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{
                  value: "p50",
                  position: "insideTopLeft",
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
              />
            )}
            {p95Bucket && p95Bucket !== p50Bucket && (
              <ReferenceLine
                x={p95Bucket}
                stroke="var(--warning)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{
                  value: "p95",
                  position: "insideTopRight",
                  fill: "var(--warning)",
                  fontSize: 10,
                }}
              />
            )}
            <Tooltip
              cursor={DASHBOARD_CHART.tooltipCursor}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const value = Number(payload[0]?.value ?? 0);
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                return (
                  <DashboardChartTooltip label={`${label} ms`}>
                    {value.toLocaleString()} requests ({pct}%)
                  </DashboardChartTooltip>
                );
              }}
            />
            <Bar
              dataKey="count"
              fill={DASHBOARD_CHART.bar}
              activeBar={DASHBOARD_CHART.activeBar}
              radius={[2, 2, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!hasDistribution && (
        <DashboardWindowNudge
          subject="latency data"
          timeRange={timeRange}
          onExpandWindow={onExpandWindow}
          className="mt-2"
        />
      )}
    </DashboardPanel>
  );
}

export const LatencyDistributionWidget = memo(LatencyDistributionWidgetInner);
export default LatencyDistributionWidget;
