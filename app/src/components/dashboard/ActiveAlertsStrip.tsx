"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertEvent } from "@/types/alert";
import { formatAlertBreachSummary } from "@/lib/alertMetricFormat";
import { formatRelativeTime } from "@/lib/projectHealthStatus";

interface ActiveAlertsStripProps {
  events: AlertEvent[];
  orgSlug: string;
  projectSlug: string;
  className?: string;
}

export function ActiveAlertsStrip({
  events,
  orgSlug,
  projectSlug,
  className,
}: ActiveAlertsStripProps) {
  if (events.length === 0) return null;

  return (
    <section
      className={cn("border-b border-border pb-3", className)}
      data-testid="active-alerts-strip"
      aria-label="Active alerts"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-medium text-foreground">
          Active alerts ({events.length})
        </h2>
        <Link
          href={`/${orgSlug}/${projectSlug}/alerts/history?status=active`}
          className="inline-flex min-h-9 items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          All
          <ChevronRight className="size-3" aria-hidden />
        </Link>
      </div>

      <ul className="divide-y divide-border">
        {events.map((event) => {
          const detailUrl = `/${orgSlug}/${projectSlug}/alerts/history/${event.id}`;
          return (
            <li key={event.id}>
              <Link
                href={detailUrl}
                className="flex min-h-10 flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="truncate font-medium">{event.rule_name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatAlertBreachSummary(event)} · {formatRelativeTime(event.triggered_at)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
