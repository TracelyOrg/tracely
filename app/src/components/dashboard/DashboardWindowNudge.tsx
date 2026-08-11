"use client";

import {
  formatTryWiderLabel,
  formatViewingWindowLabel,
  getWiderDashboardPreset,
} from "@/lib/dashboardTimeNudges";
import type { TimeRange, TimeRangePreset } from "@/types/span";
import { cn } from "@/lib/utils";

interface DashboardWindowNudgeProps {
  /** e.g. "a service", "endpoint data", "error activity" */
  subject: string;
  timeRange?: TimeRange;
  onExpandWindow?: (preset: TimeRangePreset) => void;
  className?: string;
}

/**
 * Sentry-style hint when data may appear in a wider time window.
 * "Missing a service? You're viewing the last 15 minutes. Try the last hour instead."
 */
export function DashboardWindowNudge({
  subject,
  timeRange,
  onExpandWindow,
  className,
}: DashboardWindowNudgeProps) {
  if (!timeRange || !onExpandWindow) return null;

  const widerPreset = getWiderDashboardPreset(timeRange);
  const viewingLabel = formatViewingWindowLabel(timeRange);
  if (!widerPreset || !viewingLabel) return null;

  return (
    <p className={cn("px-1 text-center text-xs leading-relaxed text-muted-foreground", className)}>
      Missing {subject}? You&apos;re viewing {viewingLabel}.{" "}
      <button
        type="button"
        onClick={() => onExpandWindow(widerPreset)}
        className="inline min-h-11 min-w-11 px-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${formatTryWiderLabel(widerPreset)} instead`}
      >
        {formatTryWiderLabel(widerPreset)}
      </button>{" "}
      instead.
    </p>
  );
}
