"use client";

import { memo, useMemo } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export type SparklineVariant = "neutral" | "positive" | "negative";

interface SparklineProps {
  data: number[];
  variant?: SparklineVariant;
  className?: string;
  height?: number;
}

const STROKE: Record<SparklineVariant, string> = {
  neutral: "var(--dash-sparkline-neutral)",
  positive: "var(--dash-sparkline-positive)",
  negative: "var(--dash-sparkline-negative)",
};

export const Sparkline = memo(function Sparkline({
  data,
  variant = "neutral",
  className,
  height = 40,
}: SparklineProps) {
  const chartData = useMemo(
    () => data.map((value, index) => ({ index, value: Number.isFinite(value) ? value : 0 })),
    [data]
  );

  if (chartData.length === 0) {
    return (
      <div
        className={cn("rounded-sm bg-muted/30", className)}
        style={{ height }}
        aria-hidden
      />
    );
  }

  const stroke = STROKE[variant];
  const isFlat = chartData.every((p) => p.value === chartData[0].value);

  return (
    <div className={cn("min-w-[72px]", className)} style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
          <Line
            type={isFlat ? "linear" : "monotone"}
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
