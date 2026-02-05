"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrevious } from "@/hooks/usePrevious";

interface LatencyWidgetProps {
  p95Latency: number;
  className?: string;
}

function formatLatency(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getStatusColor(latency: number): string {
  if (latency >= 2000) return "text-red-500";
  if (latency >= 500) return "text-amber-500";
  return "text-emerald-500";
}

function getStatusBgColor(latency: number): string {
  if (latency >= 2000) return "bg-red-500/10";
  if (latency >= 500) return "bg-amber-500/10";
  return "bg-emerald-500/10";
}

function getStatusLabel(latency: number): string {
  if (latency >= 2000) return "Slow";
  if (latency >= 500) return "Moderate";
  return "Fast";
}

export function LatencyWidget({ p95Latency, className }: LatencyWidgetProps) {
  const previousLatency = usePrevious(p95Latency);
  const isIncreasing = previousLatency !== undefined && p95Latency > previousLatency;
  const isDecreasing = previousLatency !== undefined && p95Latency < previousLatency;

  const statusColor = getStatusColor(p95Latency);
  const statusBgColor = getStatusBgColor(p95Latency);
  const statusLabel = getStatusLabel(p95Latency);

  // Gauge visualization (0-3000ms scale)
  const gaugePercent = Math.min((p95Latency / 3000) * 100, 100);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 min-h-[180px] flex flex-col",
        className
      )}
      data-testid="latency-widget"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" />
          <span>P95 Latency</span>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            statusBgColor,
            statusColor
          )}
        >
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* Value with animation */}
      <motion.div
        key={p95Latency}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mb-4"
      >
        <span className={cn("text-3xl font-bold tabular-nums", statusColor)}>
          {formatLatency(p95Latency)}
        </span>
        {(isIncreasing || isDecreasing) && (
          <span className={cn(
            "ml-2 text-sm",
            isIncreasing ? "text-red-500" : "text-emerald-500"
          )}>
            {isIncreasing ? "↑" : "↓"}
          </span>
        )}
      </motion.div>

      {/* Gauge visualization */}
      <div className="flex-1 flex flex-col justify-end">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              p95Latency >= 2000 ? "bg-red-500" : p95Latency >= 500 ? "bg-amber-500" : "bg-emerald-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${gaugePercent}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>0</span>
          <span>500ms</span>
          <span>2s</span>
          <span>3s+</span>
        </div>
      </div>
    </div>
  );
}
