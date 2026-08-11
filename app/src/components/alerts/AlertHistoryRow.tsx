"use client";

import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, Clock, CheckCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALERT_CATEGORY_TEXT, ALERT_EVENT_BADGE, ALERT_EVENT_ROW } from "@/lib/statusStyles";
import type { AlertEvent, AlertCategory, AlertEventStatus } from "@/types/alert";

const CATEGORY_ICON: Record<AlertCategory, typeof AlertTriangle> = {
  availability: AlertTriangle,
  performance: AlertCircle,
  volume: Info,
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
  if (category === "availability") {
    return `${value.toFixed(1)}%`;
  }
  if (category === "performance") {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value.toFixed(0)}ms`;
  }
  return value.toFixed(0);
}

export default function AlertHistoryRow({ event, orgSlug, projectSlug }: AlertHistoryRowProps) {
  const SeverityIcon = CATEGORY_ICON[event.rule_category];
  const detailUrl = `/${orgSlug}/${projectSlug}/alerts/history/${event.id}`;

  return (
    <Link
      href={detailUrl}
      className={cn(
        "flex items-center gap-4 border-b border-border p-4 transition-colors hover:bg-muted/50",
        ALERT_EVENT_ROW[event.status as AlertEventStatus]
      )}
    >
      <div className="shrink-0">
        <SeverityIcon className={cn("size-5", ALERT_CATEGORY_TEXT[event.rule_category])} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{event.rule_name}</p>
        <p className="text-xs capitalize text-muted-foreground">{event.rule_category}</p>
      </div>

      <div className="flex w-36 items-center gap-1 text-sm text-muted-foreground">
        <Clock className="size-3.5" />
        <span>{formatTimestamp(event.triggered_at)}</span>
      </div>

      <div className="flex w-36 items-center gap-1 text-sm text-muted-foreground">
        {event.resolved_at ? (
          <>
            <CheckCircle className="size-3.5 text-success" />
            <span>{formatTimestamp(event.resolved_at)}</span>
          </>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </div>

      <div className="w-20 text-right font-mono text-sm">
        {formatMetricValue(event.metric_value, event.rule_category)}
      </div>

      <div className="w-20 text-right font-mono text-sm text-muted-foreground">
        / {formatMetricValue(event.threshold_value, event.rule_category)}
      </div>

      <div className="flex w-24 justify-end">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
            ALERT_EVENT_BADGE[event.status as AlertEventStatus]
          )}
        >
          {event.status === "active" && <Bell className="size-3" />}
          {event.status}
        </span>
      </div>
    </Link>
  );
}
