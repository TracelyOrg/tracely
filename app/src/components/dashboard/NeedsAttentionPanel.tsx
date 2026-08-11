"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceStatus } from "@/types/dashboard";
import type { AttentionEndpoint } from "@/lib/projectHealthStatus";
import type { TimeRange } from "@/types/span";
import { buildLiveUrl } from "@/lib/liveLinks";
import { endpointReactKey, resolveEndpointP95 } from "@/lib/endpointStats";
import { DASHBOARD_METRIC_HELP } from "@/lib/dashboardMetricHelp";
import { DashboardInfoTip } from "@/components/dashboard/DashboardInfoTip";
import {
  STATUS_DOT,
  errorRateTextClass,
  latencyTextClass,
} from "@/lib/statusStyles";

interface NeedsAttentionPanelProps {
  services: ServiceStatus[];
  endpoints: AttentionEndpoint[];
  orgSlug: string;
  projectSlug: string;
  timeRange: TimeRange;
  environment?: string | null;
  className?: string;
}

function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const ENDPOINT_ROW =
  "grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 py-2.5 text-xs hover:opacity-80 sm:grid-cols-[minmax(0,1fr)_4rem_3.5rem_3.5rem_auto]";

const SERVICE_ROW =
  "grid min-h-11 grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_auto] items-center gap-x-3 py-2.5 text-xs hover:opacity-80";

export function NeedsAttentionPanel({
  services,
  endpoints,
  orgSlug,
  projectSlug,
  timeRange,
  environment,
  className,
}: NeedsAttentionPanelProps) {
  const hasRows = services.length > 0 || endpoints.length > 0;

  return (
    <section
      className={cn("dashboard-panel flex h-full flex-col p-4 sm:p-5", className)}
      data-testid="needs-attention-panel"
      aria-label="Needs attention"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-sm font-medium text-foreground">Needs attention</h2>
            <DashboardInfoTip label="About needs attention">
              {DASHBOARD_METRIC_HELP.needsAttention}
            </DashboardInfoTip>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Worst endpoints by error rate or p95 latency
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">Click a row for Live</p>
      </div>

      {!hasRows ? (
        <p className="flex flex-1 items-center text-sm text-muted-foreground">
          No services or endpoints need attention in this window.
        </p>
      ) : (
        <div className="flex-1 space-y-4">
          {endpoints.length > 0 && (
            <div>
              <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_4rem_3.5rem_3.5rem_auto]">
                <span>Endpoint</span>
                <span className="hidden sm:inline">Req</span>
                <span>Err</span>
                <span>P95</span>
                <span className="sr-only">Open</span>
              </div>
              <ul className="divide-y divide-border">
                {endpoints.map((ep) => (
                  <li key={endpointReactKey(ep.method, ep.route)}>
                    <Link
                      href={buildLiveUrl(orgSlug, projectSlug, {
                        timeRange,
                        search: ep.route || ep.method,
                        environment,
                        statusGroups:
                          ep.kind === "error" ? ["4xx", "5xx"] : undefined,
                      })}
                      className={ENDPOINT_ROW}
                    >
                      <span className="truncate font-mono">
                        <span className="mr-1.5 text-muted-foreground">{ep.method}</span>
                        {ep.route || "/"}
                      </span>
                      <span className="hidden tabular-nums text-muted-foreground sm:inline">
                        {ep.count.toLocaleString()}
                      </span>
                      <span
                        className={cn(
                          "tabular-nums",
                          ep.kind === "error"
                            ? errorRateTextClass(ep.error_rate)
                            : "text-muted-foreground"
                        )}
                      >
                        {ep.error_rate.toFixed(1)}%
                      </span>
                      <span
                        className={cn(
                          "tabular-nums",
                          ep.kind === "slow"
                            ? latencyTextClass(resolveEndpointP95(ep))
                            : "text-muted-foreground"
                        )}
                      >
                        {formatLatency(resolveEndpointP95(ep))}
                      </span>
                      <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {services.length > 0 && (
            <div>
              <div className="mb-1 grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_auto] gap-x-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Service</span>
                <span>Err</span>
                <span>P95</span>
                <span className="sr-only">Open</span>
              </div>
              <ul className="divide-y divide-border">
                {services.map((service) => (
                  <li key={service.name}>
                    <Link
                      href={buildLiveUrl(orgSlug, projectSlug, {
                        timeRange,
                        service: service.name,
                        environment,
                        statusGroups:
                          service.error_rate >= 1 ? ["4xx", "5xx"] : undefined,
                      })}
                      className={SERVICE_ROW}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            STATUS_DOT[service.status]
                          )}
                          aria-hidden
                        />
                        <span className="truncate font-medium">{service.name}</span>
                      </span>
                      <span
                        className={cn(
                          "tabular-nums",
                          errorRateTextClass(service.error_rate)
                        )}
                      >
                        {service.error_rate.toFixed(1)}%
                      </span>
                      <span
                        className={cn(
                          "tabular-nums",
                          latencyTextClass(service.p95_latency)
                        )}
                      >
                        {formatLatency(service.p95_latency)}
                      </span>
                      <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
