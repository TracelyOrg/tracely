"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrevious } from "@/hooks/usePrevious";

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  invertTrendColors?: boolean;
  /** Highlight value text only — no card tint */
  tone?: "default" | "warning" | "critical";
  className?: string;
}

const TONE_VALUE: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "text-foreground",
  warning: "text-warning",
  critical: "text-destructive",
};

export function MetricCard({
  title,
  value,
  trend,
  trendValue,
  invertTrendColors = false,
  tone = "default",
  className,
}: MetricCardProps) {
  const prevValue = usePrevious(value);
  const valueChanged = prevValue !== undefined && prevValue !== value;

  const trendClass =
    trend === "neutral"
      ? "text-muted-foreground"
      : trend === "up"
        ? invertTrendColors
          ? "text-destructive"
          : "text-success"
        : invertTrendColors
          ? "text-success"
          : "text-destructive";

  return (
    <motion.div
      data-testid="metric-card"
      className={cn("rounded-lg border border-border bg-card px-4 py-3", className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <motion.p
          className={cn("text-2xl font-semibold tabular-nums tracking-tight", TONE_VALUE[tone])}
          animate={valueChanged ? { opacity: [1, 0.7, 1] } : {}}
          transition={{ duration: 0.2 }}
        >
          {value}
        </motion.p>
        {trend && trendValue && (
          <span className={cn("shrink-0 text-[11px] tabular-nums", trendClass)}>{trendValue}</span>
        )}
      </div>
    </motion.div>
  );
}

export default MetricCard;
