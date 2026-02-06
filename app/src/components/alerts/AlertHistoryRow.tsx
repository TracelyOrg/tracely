"use client";

import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, Clock, CheckCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertEvent, AlertCategory, AlertEventStatus } from "@/types/alert";

// Status colors per spec
const STATUS_COLORS: Record<AlertEventStatus, string> = {
  active: "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30",
  resolved: "border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30",
  acknowledged: "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
};

const STATUS_BADGE_COLORS: Record<AlertEventStatus, string> = {
  active: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
  acknowledged: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
};

// Category to severity mapping (availability = critical, performance = warning, volume = info)
const CATEGORY_SEVERITY: Record<AlertCategory, { icon: typeof AlertTriangle; colorClass: string }> = {
  availability: { icon: AlertTriangle, colorClass: "text-red-500" },
  performance: { icon: AlertCircle, colorClass: "text-amber-500" },
  volume: { icon: Info, colorClass: "text-blue-500" },
};

interface AlertHistoryRowProps {
  event: AlertEvent;
  orgSlug: string;
  projectSlug: string;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMetricValue(value: number, category: AlertCategory): string {
  // Format based on category/metric type
  if (category === "availability") {
    return `${value.toFixed(1)}%`; // Error rate
  }
  if (category === "performance") {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value.toFixed(0)}ms`;
  }
  return value.toFixed(0); // Count
}

export default function AlertHistoryRow({ event, orgSlug, projectSlug }: AlertHistoryRowProps) {
  const severity = CATEGORY_SEVERITY[event.rule_category];
  const SeverityIcon = severity.icon;
  const detailUrl = `/${orgSlug}/${projectSlug}/alerts/history/${event.id}`;

  return (
    <Link
      href={detailUrl}
      className={cn(
        "flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer",
        STATUS_COLORS[event.status]
      )}
    >
      {/* Severity icon */}
      <div className="flex-shrink-0">
        <SeverityIcon className={cn("size-5", severity.colorClass)} />
      </div>

      {/* Alert name and category */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{event.rule_name}</p>
        <p className="text-xs text-muted-foreground capitalize">{event.rule_category}</p>
      </div>

      {/* Triggered at */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground w-36">
        <Clock className="size-3.5" />
        <span>{formatTimestamp(event.triggered_at)}</span>
      </div>

      {/* Resolved at */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground w-36">
        {event.resolved_at ? (
          <>
            <CheckCircle className="size-3.5 text-green-500" />
            <span>{formatTimestamp(event.resolved_at)}</span>
          </>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </div>

      {/* Metric value */}
      <div className="w-20 text-sm text-right font-mono">
        {formatMetricValue(event.metric_value, event.rule_category)}
      </div>

      {/* Threshold */}
      <div className="w-20 text-sm text-right font-mono text-muted-foreground">
        / {formatMetricValue(event.threshold_value, event.rule_category)}
      </div>

      {/* Status badge */}
      <div className="w-24 flex justify-end">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
            STATUS_BADGE_COLORS[event.status]
          )}
        >
          {event.status === "active" && <Bell className="size-3" />}
          {event.status}
        </span>
      </div>
    </Link>
  );
}
