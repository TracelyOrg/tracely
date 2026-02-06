"use client";

import { motion } from "framer-motion";
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

export interface LatencyBucket {
  range: string;
  count: number;
  label: string;
}

interface LatencyDistributionWidgetProps {
  data: LatencyBucket[];
  p50?: number;
  p95?: number;
  p99?: number;
  className?: string;
}

/**
 * Latency distribution histogram showing response time distribution.
 * Includes percentile reference lines for p50, p95, p99.
 */
export function LatencyDistributionWidget({
  data,
  p50,
  p95,
  p99,
  className,
}: LatencyDistributionWidgetProps) {
  const formatLatency = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
  };

  return (
    <motion.div
      data-testid="latency-distribution-widget"
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="rounded-xl border bg-card p-4 h-full">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">Latency Distribution</h3>
          <div className="flex items-center gap-3 text-xs">
            {p50 !== undefined && (
              <span className="text-muted-foreground">
                p50: <span className="font-medium text-foreground">{formatLatency(p50)}</span>
              </span>
            )}
            {p95 !== undefined && (
              <span className="text-muted-foreground">
                p95: <span className="font-medium text-foreground">{formatLatency(p95)}</span>
              </span>
            )}
            {p99 !== undefined && (
              <span className="text-muted-foreground">
                p99: <span className="font-medium text-foreground">{formatLatency(p99)}</span>
              </span>
            )}
          </div>
        </div>

        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [`${Number(value).toLocaleString()} requests`, "Count"]}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

export default LatencyDistributionWidget;
