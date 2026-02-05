"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { DataPoint } from "@/types/dashboard";
import { usePrevious } from "@/hooks/usePrevious";

interface RequestsWidgetProps {
  data: DataPoint[];
  className?: string;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatValue(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (value >= 100) return Math.round(value).toString();
  return value.toFixed(1);
}

export function RequestsWidget({ data, className }: RequestsWidgetProps) {
  // Calculate current requests per minute (last data point)
  const currentValue = useMemo(() => {
    if (data.length === 0) return 0;
    return data[data.length - 1].value;
  }, [data]);

  const previousValue = usePrevious(currentValue);
  const isIncreasing = previousValue !== undefined && currentValue > previousValue;
  const isDecreasing = previousValue !== undefined && currentValue < previousValue;

  // Prepare chart data
  const chartData = useMemo(() => {
    return data.map((point) => ({
      time: formatTime(point.timestamp),
      value: point.value,
    }));
  }, [data]);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 min-h-[180px] flex flex-col",
        className
      )}
      data-testid="requests-widget"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="size-4" />
          <span>Requests/min</span>
        </div>
      </div>

      {/* Value with animation */}
      <motion.div
        key={currentValue}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mb-3"
      >
        <span
          className={cn(
            "text-3xl font-bold tabular-nums",
            isIncreasing && "text-emerald-500",
            isDecreasing && "text-amber-500"
          )}
        >
          {formatValue(currentValue)}
        </span>
        {(isIncreasing || isDecreasing) && (
          <span className={cn(
            "ml-2 text-sm",
            isIncreasing ? "text-emerald-500" : "text-amber-500"
          )}>
            {isIncreasing ? "↑" : "↓"}
          </span>
        )}
      </motion.div>

      {/* Sparkline chart */}
      <div className="flex-1 min-h-[60px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [formatValue(value), "req/min"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#requestsGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
