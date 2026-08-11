"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStatusSummary } from "@/lib/projectHealthStatus";
import { STATUS_BADGE, STATUS_DOT } from "@/lib/statusStyles";

interface DashboardStatusBannerProps {
  summary: ProjectStatusSummary;
  activeAlertCount: number;
  orgSlug: string;
  projectSlug: string;
  isLoading?: boolean;
}

const STATUS_LABEL = {
  healthy: "Operational",
  degraded: "Degraded",
  error: "Errors",
} as const;

export function DashboardStatusBanner({
  summary,
  activeAlertCount,
  orgSlug,
  projectSlug,
  isLoading,
}: DashboardStatusBannerProps) {
  if (isLoading) {
    return (
      <div
        className="flex h-8 items-center gap-2 border-b border-border pb-3"
        data-testid="dashboard-status-banner"
      >
        <div className="size-2 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const status = summary.worst ?? "healthy";

  const issues: string[] = [];
  if (summary.errorCount > 0) issues.push(`${summary.errorCount} in error`);
  else if (summary.degradedCount > 0) issues.push(`${summary.degradedCount} degraded`);
  if (activeAlertCount > 0) issues.push(`${activeAlertCount} alert${activeAlertCount > 1 ? "s" : ""}`);

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-3"
      data-testid="dashboard-status-banner"
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium",
          STATUS_BADGE[status]
        )}
      >
        <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
        {STATUS_LABEL[status]}
      </span>

      {issues.length > 0 && (
        <span className="text-xs text-muted-foreground">{issues.join(" · ")}</span>
      )}

      {activeAlertCount > 0 && (
        <Link
          href={`/${orgSlug}/${projectSlug}/alerts`}
          className="ml-auto inline-flex min-h-9 items-center gap-0.5 text-xs text-foreground hover:underline"
        >
          Alerts
          <ChevronRight className="size-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}
