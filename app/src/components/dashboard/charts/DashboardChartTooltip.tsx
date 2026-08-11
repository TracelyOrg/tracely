"use client";

import type { ReactNode } from "react";

interface DashboardChartTooltipProps {
  label: string;
  children: ReactNode;
}

/** Shared Recharts tooltip shell — consistent styling, readable on mobile. */
export function DashboardChartTooltip({ label, children }: DashboardChartTooltipProps) {
  return (
    <div className="max-w-[220px] rounded-md border border-border bg-card px-2.5 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium tabular-nums">{children}</div>
    </div>
  );
}
