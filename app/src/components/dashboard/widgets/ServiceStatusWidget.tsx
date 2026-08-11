"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceStatus } from "@/types/dashboard";
import type { TimeRange, TimeRangePreset } from "@/types/span";
import { buildLiveUrl } from "@/lib/liveLinks";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DASHBOARD_METRIC_HELP } from "@/lib/dashboardMetricHelp";
import { DashboardWindowNudge } from "@/components/dashboard/DashboardWindowNudge";
import { STATUS_DOT, errorRateTextClass, latencyTextClass } from "@/lib/statusStyles";

interface ServiceStatusWidgetProps {
  services: ServiceStatus[];
  orgSlug?: string;
  projectSlug?: string;
  timeRange?: TimeRange;
  environment?: string | null;
  onExpandWindow?: (preset: TimeRangePreset) => void;
  className?: string;
}

function formatLatency(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ServiceStatusWidget({
  services,
  orgSlug,
  projectSlug,
  timeRange,
  environment,
  onExpandWindow,
  className,
}: ServiceStatusWidgetProps) {
  const drillDown = !!(orgSlug && projectSlug && timeRange);
  const issueCount = services.filter((s) => s.status !== "healthy").length;

  return (
    <DashboardPanel
      title="Services"
      description={DASHBOARD_METRIC_HELP.services}
      testId="service-status-widget"
      className={className}
      action={
        issueCount > 0 ? (
          <span className="text-xs text-muted-foreground">{issueCount} need attention</span>
        ) : undefined
      }
    >
      {services.length === 0 ? (
        <div className="space-y-3 py-4">
          <p className="text-center text-sm text-muted-foreground">No services detected</p>
          <DashboardWindowNudge
            subject="a service"
            timeRange={timeRange}
            onExpandWindow={onExpandWindow}
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {services.map((service) => {
            const row = (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[service.status])}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium">{service.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  <span className={errorRateTextClass(service.error_rate)}>
                    {service.error_rate.toFixed(1)}%
                  </span>
                  <span className={latencyTextClass(service.p95_latency)}>
                    {formatLatency(service.p95_latency)}
                  </span>
                  {drillDown && <ChevronRight className="size-3" aria-hidden />}
                </span>
              </>
            );

            return (
              <li key={service.name} data-testid={`service-${service.name}`}>
                {drillDown ? (
                  <Link
                    href={buildLiveUrl(orgSlug, projectSlug, {
                      timeRange,
                      service: service.name,
                      environment,
                      statusGroups: service.error_rate >= 1 ? ["4xx", "5xx"] : undefined,
                    })}
                    className="flex min-h-10 items-center justify-between gap-2 py-2 hover:opacity-80"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex min-h-10 items-center justify-between gap-2 py-2">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}

export default ServiceStatusWidget;
