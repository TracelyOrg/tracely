"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrevious } from "@/hooks/usePrevious";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const VARIANT_STYLES = {
  default: "bg-card",
  success: "bg-emerald-500/10 border-emerald-500/20",
  warning: "bg-amber-500/10 border-amber-500/20",
  danger: "bg-red-500/10 border-red-500/20",
};

const TREND_STYLES = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
};

/**
 * Compact metric card for displaying a single value with optional trend.
 * Perfect for KPIs and summary statistics.
 */
export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  variant = "default",
  className,
}: MetricCardProps) {
  const prevValue = usePrevious(value);
  const valueChanged = prevValue !== undefined && prevValue !== value;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <motion.div
      data-testid="metric-card"
      className={cn("rounded-xl border p-4", VARIANT_STYLES[variant], className)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <motion.p
            className="text-2xl font-bold mt-1 tabular-nums"
            animate={valueChanged ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.25 }}
          >
            {value}
          </motion.p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>

      {trend && trendValue && (
        <div className={cn("flex items-center gap-1 mt-2 text-xs", TREND_STYLES[trend])}>
          <TrendIcon className="size-3" />
          <span>{trendValue}</span>
        </div>
      )}
    </motion.div>
  );
}

export default MetricCard;
