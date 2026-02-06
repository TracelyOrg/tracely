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
} from "recharts";
import type { DataPoint } from "@/types/dashboard";

interface ThroughputWidgetProps {
  data: DataPoint[];
  className?: string;
}

/**
 * Throughput bar chart showing requests per minute over time.
 * Displays data as vertical bars for easy volume comparison.
 */
export function ThroughputWidget({ data, className }: ThroughputWidgetProps) {
  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    value: point.value,
  }));

  // Calculate total requests
  const totalRequests = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <motion.div
      data-testid="throughput-widget"
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="rounded-xl border bg-card p-4 h-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">Throughput</h3>
          <span className="text-2xl font-bold tabular-nums">
            {totalRequests.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Total requests in period</p>

        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [`${Number(value).toLocaleString()} req`, "Requests"]}
              />
              <Bar
                dataKey="value"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

export default ThroughputWidget;
