"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrevious } from "@/hooks/usePrevious";

interface ErrorRateWidgetProps {
  errorRate: number;
  className?: string;
}

function getStatusColor(rate: number): string {
  if (rate >= 5) return "text-red-500";
  if (rate >= 1) return "text-amber-500";
  return "text-emerald-500";
}

function getStatusBgColor(rate: number): string {
  if (rate >= 5) return "bg-red-500/10";
  if (rate >= 1) return "bg-amber-500/10";
  return "bg-emerald-500/10";
}

function getStatusLabel(rate: number): string {
  if (rate >= 5) return "Critical";
  if (rate >= 1) return "Warning";
  return "Healthy";
}

export function ErrorRateWidget({ errorRate, className }: ErrorRateWidgetProps) {
  const previousRate = usePrevious(errorRate);
  const [showFlash, setShowFlash] = useState(false);

  // Detect increasing error rate and trigger red flash (AC2)
  const isIncreasing = previousRate !== undefined && errorRate > previousRate;

  useEffect(() => {
    if (isIncreasing && errorRate >= 1) {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isIncreasing, errorRate]);

  const statusColor = getStatusColor(errorRate);
  const statusBgColor = getStatusBgColor(errorRate);
  const statusLabel = getStatusLabel(errorRate);
  const StatusIcon = errorRate >= 1 ? AlertTriangle : CheckCircle2;

  // Calculate gauge fill percentage (0-100% maps to 0-10% error rate for visual scale)
  const gaugePercent = Math.min(errorRate * 10, 100);

  return (
    <motion.div
      className={cn(
        "rounded-lg border bg-card p-4 min-h-[180px] flex flex-col relative overflow-hidden",
        className
      )}
      animate={{
        backgroundColor: showFlash ? "rgb(239 68 68 / 0.15)" : undefined,
      }}
      transition={{ duration: 0.25 }}
      data-testid="error-rate-widget"
    >
      {/* Flash overlay for increasing error rate */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-red-500/10 pointer-events-none"
            data-testid="error-rate-flash"
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-2 relative z-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="size-4" />
          <span>Error Rate</span>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            statusBgColor,
            statusColor
          )}
        >
          <StatusIcon className="size-3" />
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* Value with animation */}
      <motion.div
        key={errorRate.toFixed(2)}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mb-4 relative z-10"
      >
        <span className={cn("text-3xl font-bold tabular-nums", statusColor)}>
          {errorRate.toFixed(2)}%
        </span>
        {isIncreasing && (
          <span className="ml-2 text-sm text-red-500">↑</span>
        )}
      </motion.div>

      {/* Gauge visualization */}
      <div className="flex-1 flex flex-col justify-end relative z-10">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              errorRate >= 5 ? "bg-red-500" : errorRate >= 1 ? "bg-amber-500" : "bg-emerald-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${gaugePercent}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>0%</span>
          <span>1%</span>
          <span>5%</span>
          <span>10%+</span>
        </div>
      </div>
    </motion.div>
  );
}
