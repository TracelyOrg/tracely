"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import type { AlertCategory } from "@/types/alert";

interface MetricBreachChartProps {
  orgSlug: string;
  projectSlug: string;
  triggeredAt: string;
  resolvedAt: string | null;
  threshold: number;
  category: AlertCategory;
}

interface MetricDataPoint {
  timestamp: string;
  value: number;
}

interface MetricResponse {
  data: MetricDataPoint[];
}

function formatXAxis(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatYAxis(value: number, category: AlertCategory): string {
  if (category === "availability") {
    return `${value}%`;
  }
  if (category === "performance") {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
  }
  return String(value);
}

// Loading skeleton for chart
function ChartSkeleton() {
  return (
    <div className="h-64 flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading chart data...</div>
    </div>
  );
}

// Empty state
function EmptyChart() {
  return (
    <div className="h-64 flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">No metric data available for this time range.</p>
        <p className="text-xs text-muted-foreground mt-1">Data may have been archived or not yet collected.</p>
      </div>
    </div>
  );
}

export default function MetricBreachChart({
  orgSlug,
  projectSlug,
  triggeredAt,
  resolvedAt,
  threshold,
  category,
}: MetricBreachChartProps) {
  // Calculate time range: 30 min before to 30 min after (or now if active)
  const triggerTime = new Date(triggeredAt);
  const startTime = new Date(triggerTime.getTime() - 30 * 60 * 1000);
  const endTime = resolvedAt
    ? new Date(new Date(resolvedAt).getTime() + 30 * 60 * 1000)
    : new Date();

  // Fetch metric data
  const { data, isLoading, error } = useQuery({
    queryKey: ["alertMetrics", projectSlug, triggeredAt, category],
    queryFn: async () => {
      // Determine which metric to query based on category
      let metric = "error_rate";
      if (category === "performance") metric = "p95_latency";
      if (category === "volume") metric = "request_count";

      const params = new URLSearchParams({
        metric,
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        granularity: "1m", // 1-minute intervals
      });

      const res = await apiFetch<DataEnvelope<MetricResponse>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/metrics/timeseries?${params.toString()}`
      );
      return res.data.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (error || !data || data.length === 0) {
    return <EmptyChart />;
  }

  // Determine breach area timestamps
  const breachStart = triggeredAt;
  const breachEnd = resolvedAt || new Date().toISOString();

  // Chart colors based on category
  const lineColor = category === "availability" ? "#ef4444" : category === "performance" ? "#f59e0b" : "#3b82f6";
  const breachColor = category === "availability" ? "rgba(239, 68, 68, 0.1)" : category === "performance" ? "rgba(245, 158, 11, 0.1)" : "rgba(59, 130, 246, 0.1)";

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            className="text-xs text-muted-foreground"
            tick={{ fill: "currentColor" }}
            axisLine={{ stroke: "currentColor" }}
          />
          <YAxis
            tickFormatter={(v) => formatYAxis(v, category)}
            className="text-xs text-muted-foreground"
            tick={{ fill: "currentColor" }}
            axisLine={{ stroke: "currentColor" }}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
            }}
            labelFormatter={(label) => formatXAxis(label as string)}
            formatter={(value) => value !== undefined ? [formatYAxis(value as number, category), "Value"] : ["", "Value"]}
          />

          {/* Threshold line */}
          <ReferenceLine
            y={threshold}
            stroke="#dc2626"
            strokeDasharray="5 5"
            label={{
              value: `Threshold: ${formatYAxis(threshold, category)}`,
              position: "right",
              fill: "#dc2626",
              fontSize: 11,
            }}
          />

          {/* Breach period shading */}
          <ReferenceArea
            x1={breachStart}
            x2={breachEnd}
            fill={breachColor}
            fillOpacity={1}
          />

          {/* Metric line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: lineColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
