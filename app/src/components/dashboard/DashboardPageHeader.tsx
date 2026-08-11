"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStatusSummary } from "@/lib/projectHealthStatus";
import { healthStatusLabel } from "@/lib/dashboardHealthScore";
import { STATUS_BADGE, STATUS_DOT } from "@/lib/statusStyles";

interface DashboardPageHeaderProps {
  summary: ProjectStatusSummary;
  healthScore: number;
  activeAlertCount: number;
  contextLabel: string;
  lastUpdatedLabel?: string;
  orgSlug: string;
  projectSlug: string;
  isLoading?: boolean;
  controls: React.ReactNode;
}

export function DashboardPageHeader({
  summary,
  healthScore,
  activeAlertCount,
  contextLabel,
  lastUpdatedLabel,
  orgSlug,
  projectSlug,
  isLoading,
  controls,
}: DashboardPageHeaderProps) {
  if (isLoading) {
    return (
      <header className="dashboard-page-header" data-testid="dashboard-page-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-full animate-pulse rounded bg-muted lg:w-80" />
        </div>
      </header>
    );
  }

  const { label, status } = healthStatusLabel(summary, healthScore);

  const issues: string[] = [];
  if (summary.errorCount > 0) issues.push(`${summary.errorCount} service${summary.errorCount > 1 ? "s" : ""} in error`);
  else if (summary.degradedCount > 0) {
    issues.push(`${summary.degradedCount} degraded`);
  }
  if (activeAlertCount > 0) {
    issues.push(`${activeAlertCount} alert${activeAlertCount > 1 ? "s" : ""}`);
  }

  return (
    <header className="dashboard-page-header" data-testid="dashboard-page-header">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
          <div className="mt-1.5 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium",
                STATUS_BADGE[status]
              )}
            >
              <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
              System status: {label}
            </span>
            <span className="text-xs text-muted-foreground">
              Health score {healthScore}/100
            </span>
            {issues.length > 0 ? (
              <span className="text-xs text-muted-foreground">{issues.join(" · ")}</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {contextLabel}
            {lastUpdatedLabel ? ` · updated ${lastUpdatedLabel}` : ""}
          </p>
          {activeAlertCount > 0 ? (
            <Link
              href={`/${orgSlug}/${projectSlug}/alerts`}
              className="mt-2 inline-flex min-h-9 items-center gap-0.5 text-xs font-medium text-foreground hover:underline"
            >
              View alerts
              <ChevronRight className="size-3" aria-hidden />
            </Link>
          ) : null}
        </div>
        <div className="min-h-[5.5rem] w-full lg:min-h-0 lg:w-auto">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
            {controls}
          </div>
        </div>
      </div>
    </header>
  );
}
