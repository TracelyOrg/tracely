"use client";

import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { DataPoint } from "@/types/dashboard";

interface ErrorsTimelineWidgetProps {
  data: DataPoint[];
  className?: string;
}

/**
 * Errors timeline area chart showing error count over time.
 * Uses a gradient fill to emphasize error spikes.
 */
export function ErrorsTimelineWidget({ data, className }: ErrorsTimelineWidgetProps) {
  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    errors: point.value,
  }));

  const totalErrors = data.reduce((sum, d) => sum + d.value, 0);
  const maxErrors = Math.max(...data.map((d) => d.value), 0);

  return (
    <motion.div
      data-testid="errors-timeline-widget"
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="rounded-xl border bg-card p-4 h-full">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">Errors Over Time</h3>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              Total: <span className="font-medium text-destructive">{totalErrors}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Peak: <span className="font-medium text-destructive">{maxErrors}</span>
            </span>
          </div>
        </div>

        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [`${value} errors`, "Errors"]}
              />
              <Area
                type="monotone"
                dataKey="errors"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                fill="url(#errorGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

export default ErrorsTimelineWidget;
