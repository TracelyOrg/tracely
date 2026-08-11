"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { mergeDuplicateWidgetEndpoints, endpointReactKey, formatEndpointLatency, resolveEndpointP95 } from "@/lib/endpointStats";
import { cn } from "@/lib/utils";
import type { TimeRange, TimeRangePreset } from "@/types/span";
import { buildLiveUrl } from "@/lib/liveLinks";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DASHBOARD_METRIC_HELP } from "@/lib/dashboardMetricHelp";
import { DashboardWindowNudge } from "@/components/dashboard/DashboardWindowNudge";

export interface EndpointStats {
  route: string;
  method: string;
  count: number;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
}

type SortMode = "volume" | "errors" | "latency";

interface TopEndpointsWidgetProps {
  endpoints: EndpointStats[];
  orgSlug?: string;
  projectSlug?: string;
  timeRange?: TimeRange;
  environment?: string | null;
  onExpandWindow?: (preset: TimeRangePreset) => void;
  className?: string;
}

const SORT_TABS: { key: SortMode; label: string }[] = [
  { key: "volume", label: "Vol" },
  { key: "errors", label: "Err" },
  { key: "latency", label: "P95" },
];

function sortEndpoints(endpoints: EndpointStats[], mode: SortMode): EndpointStats[] {
  const sorted = [...endpoints];
  if (mode === "errors") {
    sorted.sort((a, b) => b.errorRate - a.errorRate || b.count - a.count);
  } else if (mode === "latency") {
    sorted.sort((a, b) => b.p95Latency - a.p95Latency || b.count - a.count);
  } else {
    sorted.sort((a, b) => b.count - a.count);
  }
  return sorted;
}

export function TopEndpointsWidget({
  endpoints,
  orgSlug,
  projectSlug,
  timeRange,
  environment,
  onExpandWindow,
  className,
}: TopEndpointsWidgetProps) {
  const [sortMode, setSortMode] = useState<SortMode>("volume");
  const drillDown = !!(orgSlug && projectSlug && timeRange);

  const sortedEndpoints = useMemo(() => {
    const deduped = mergeDuplicateWidgetEndpoints(
      endpoints.map((ep) => ({
        ...ep,
        p95Latency: resolveEndpointP95({
          p95_latency: ep.p95Latency,
          avg_latency: ep.avgLatency,
        }),
      }))
    );
    return sortEndpoints(deduped, sortMode);
  }, [endpoints, sortMode]);

  const maxCount = Math.max(...sortedEndpoints.map((e) => e.count), 1);

  return (
    <DashboardPanel
      title="Endpoints"
      description={DASHBOARD_METRIC_HELP.endpoints}
      testId="top-endpoints-widget"
      className={className}
    >
      <div
        className="mb-3 inline-flex rounded-md border border-border p-0.5"
        role="tablist"
        aria-label="Sort endpoints"
      >
        {SORT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={sortMode === tab.key}
            onClick={() => setSortMode(tab.key)}
            className={cn(
              "min-h-8 rounded-sm px-2 text-[11px] font-medium transition-colors",
              sortMode === tab.key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {sortedEndpoints.length === 0 ? (
        <div className="space-y-3 py-4">
          <p className="text-center text-sm text-muted-foreground">No endpoint data</p>
          <DashboardWindowNudge
            subject="endpoint data"
            timeRange={timeRange}
            onExpandWindow={onExpandWindow}
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {sortedEndpoints.slice(0, 5).map((endpoint) => (
            <li key={endpointReactKey(endpoint.method, endpoint.route)}>
              {drillDown ? (
                <Link
                  href={buildLiveUrl(orgSlug, projectSlug, {
                    timeRange,
                    search: endpoint.route || endpoint.method,
                    environment,
                    statusGroups:
                      endpoint.errorRate > 0 || sortMode === "errors"
                        ? ["4xx", "5xx"]
                        : undefined,
                  })}
                  className="flex min-h-10 items-center justify-between gap-2 py-2 text-sm hover:opacity-80"
                >
                  <EndpointRow
                    endpoint={endpoint}
                    sortMode={sortMode}
                    maxCount={maxCount}
                    showChevron
                  />
                </Link>
              ) : (
                <div className="flex min-h-10 items-center justify-between gap-2 py-2 text-sm">
                  <EndpointRow endpoint={endpoint} sortMode={sortMode} maxCount={maxCount} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

function EndpointRow({
  endpoint,
  sortMode,
  maxCount,
  showChevron,
}: {
  endpoint: EndpointStats;
  sortMode: SortMode;
  maxCount: number;
  showChevron?: boolean;
}) {
  return (
    <>
      <span className="min-w-0 truncate font-mono text-xs">
        <span className="mr-1.5 text-muted-foreground">{endpoint.method}</span>
        {endpoint.route || "/"}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
        {sortMode === "volume" && (
          <span className="relative">
            <span
              className="absolute inset-y-0 right-full mr-1 hidden h-1 w-12 rounded-sm bg-muted sm:block"
              style={{ width: `${Math.max(8, (endpoint.count / maxCount) * 48)}px` }}
              aria-hidden
            />
            {endpoint.count.toLocaleString()}
          </span>
        )}
        {sortMode === "errors" && (
          <span
            className={cn(
              endpoint.errorRate >= 5 && "text-destructive",
              endpoint.errorRate >= 1 && endpoint.errorRate < 5 && "text-warning"
            )}
          >
            {endpoint.errorRate.toFixed(1)}%
          </span>
        )}
        {sortMode === "latency" && (
          <span>{formatEndpointLatency(endpoint.p95Latency)}</span>
        )}
        {showChevron && <ChevronRight className="size-3" aria-hidden />}
      </span>
    </>
  );
}

export default TopEndpointsWidget;
