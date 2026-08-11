"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetricTrend } from "@/lib/metricTrends";
import type { MetricTierInfo } from "@/lib/dashboardMetricTiers";
import { tierBadgeClass } from "@/lib/dashboardMetricTiers";
import type { SparklineVariant } from "@/components/dashboard/charts/Sparkline";
import { DashboardInfoTip } from "@/components/dashboard/DashboardInfoTip";

const Sparkline = dynamic(
  () => import("@/components/dashboard/charts/Sparkline").then((m) => m.Sparkline),
  {
    ssr: false,
    loading: () => <div className="h-[44px] w-[88px] shrink-0 sm:w-[100px]" aria-hidden />,
  }
);

interface MetricSparklineCardProps {
  title: string;
  value: string | number;
  trend?: MetricTrend | null;
  tier?: MetricTierInfo;
  sparklineData?: number[];
  sparklineVariant?: SparklineVariant;
  tone?: "default" | "warning" | "critical";
  comparisonLabel?: string;
  description?: string;
  className?: string;
}

const TONE_VALUE: Record<NonNullable<MetricSparklineCardProps["tone"]>, string> = {
  default: "text-foreground",
  warning: "text-warning",
  critical: "text-destructive",
};

function trendSparklineVariant(
  trend: MetricTrend | null | undefined,
  override?: SparklineVariant
): SparklineVariant {
  if (override) return override;
  if (!trend || trend.neutralColor || trend.direction === "neutral") return "neutral";
  const good =
    trend.direction === "up" ? !trend.invertColors : trend.invertColors;
  return good ? "positive" : "negative";
}

function trendTextClass(trend: MetricTrend | null | undefined): string {
  if (!trend || trend.neutralColor || trend.direction === "neutral") {
    return "text-muted-foreground";
  }
  if (trend.direction === "up") {
    return trend.invertColors ? "text-destructive" : "text-success";
  }
  return trend.invertColors ? "text-success" : "text-destructive";
}

function MetricSparklineCardInner({
  title,
  value,
  trend,
  tier,
  sparklineData = [],
  sparklineVariant,
  tone = "default",
  comparisonLabel,
  description,
  className,
}: MetricSparklineCardProps) {
  const variant = trendSparklineVariant(trend, sparklineVariant);
  const trendClass = trendTextClass(trend);

  return (
    <div
      data-testid="metric-sparkline-card"
      className={cn("dashboard-metric-card flex min-h-[132px] flex-col gap-3 p-4", className)}
    >
      <div className="flex min-h-5 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{title}</p>
          {description ? (
            <DashboardInfoTip label={`About ${title}`}>{description}</DashboardInfoTip>
          ) : null}
        </div>
        {tier ? (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              tierBadgeClass(tier.tier)
            )}
          >
            {tier.label}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "min-h-[2rem] text-2xl font-semibold tabular-nums tracking-tight sm:min-h-[2.25rem] sm:text-3xl",
              TONE_VALUE[tone]
            )}
          >
            {value}
          </p>
          <p className="mt-1 min-h-[1rem] text-[11px] tabular-nums">
            {trend?.label ? (
              <span className={cn("inline-flex items-center gap-1", trendClass)}>
                {trend.direction === "up" ? (
                  <TrendingUp className="size-3 shrink-0" aria-hidden />
                ) : trend.direction === "down" ? (
                  <TrendingDown className="size-3 shrink-0" aria-hidden />
                ) : null}
                {trend.label} than {comparisonLabel ?? "previous period"}
              </span>
            ) : (
              <span className="text-muted-foreground">
                No data for {comparisonLabel ?? "previous period"}
              </span>
            )}
          </p>
        </div>
        <div className="hidden h-[44px] w-[88px] shrink-0 sm:block sm:w-[100px]">
          <Sparkline data={sparklineData} variant={variant} height={44} />
        </div>
      </div>
    </div>
  );
}

export const MetricSparklineCard = memo(MetricSparklineCardInner);
export default MetricSparklineCard;
