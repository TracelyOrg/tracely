"use client";

import { cn } from "@/lib/utils";
import type { StatusCodeStats } from "@/types/dashboard";
import {
  buildStatusCodeSegments,
  computeHealthScore,
} from "@/lib/dashboardHealthScore";
import type { ServiceStatus } from "@/types/dashboard";
import { statusCodeChartColor } from "@/lib/dashboardChartTheme";
import { DASHBOARD_METRIC_HELP } from "@/lib/dashboardMetricHelp";
import { DashboardInfoTip } from "@/components/dashboard/DashboardInfoTip";

interface HealthOverviewPanelProps {
  services: ServiceStatus[];
  statusCodes: StatusCodeStats[];
  className?: string;
}

const CODE_ORDER = ["5xx", "4xx", "3xx", "2xx"];

export function HealthOverviewPanel({
  services,
  statusCodes,
  className,
}: HealthOverviewPanelProps) {
  const score = computeHealthScore(services);
  const segments = buildStatusCodeSegments(statusCodes);
  const ordered = [...segments].sort(
    (a, b) => CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code)
  );

  return (
    <section
      className={cn("dashboard-panel flex h-full flex-col p-4 sm:p-5", className)}
      data-testid="health-overview-panel"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-sm font-medium text-foreground">Health overview</h2>
            <DashboardInfoTip label="About health overview">
              {DASHBOARD_METRIC_HELP.healthOverview}
            </DashboardInfoTip>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Service-weighted score and response mix
          </p>
        </div>
      </div>

      <div className="mb-4 flex min-h-[3.5rem] items-end gap-2 sm:min-h-[4rem]">
        <span className="text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
          {score}
        </span>
        <span className="pb-1 text-sm text-muted-foreground">/100 overall</span>
      </div>

      <div
        className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted/50"
        role="img"
        aria-label="Status code distribution"
      >
        {ordered.map((seg) =>
          seg.pct > 0 ? (
            <div
              key={seg.code}
              className="h-full transition-[width] duration-300"
              style={{
                width: `${seg.pct}%`,
                backgroundColor: statusCodeChartColor(seg.code),
              }}
              title={`${seg.code}: ${seg.pct.toFixed(1)}%`}
            />
          ) : null
        )}
      </div>

      <ul className="mt-auto space-y-2">
        {ordered.map((seg) => (
          <li
            key={seg.code}
            className="flex min-h-9 items-center justify-between gap-3 text-xs"
          >
            <span className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ backgroundColor: statusCodeChartColor(seg.code) }}
                aria-hidden
              />
              <span className="font-medium text-foreground">{seg.code}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">
              {seg.pct.toFixed(1)}%
              <span className="ml-2 hidden text-foreground sm:inline">
                {seg.count.toLocaleString()}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
