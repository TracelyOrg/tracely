"use client";

import { Suspense, useCallback, useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Clock, Zap, TrendingUp, TrendingDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DataEnvelope } from "@/types/api";
import type { DashboardMetricsResponse } from "@/types/dashboard";
import type { TimeRange, TimeRangePreset } from "@/types/span";
import { useFilterStore } from "@/stores/filterStore";
import { TimeframeSelector } from "@/components/shared/TimeframeSelector";
import {
  RequestsWidget,
  ErrorRateWidget,
  LatencyWidget,
  ServiceStatusWidget,
  WidgetSkeleton,
  ThroughputWidget,
  StatusCodeWidget,
  TopEndpointsWidget,
  LatencyDistributionWidget,
  ErrorsTimelineWidget,
  MetricCard,
} from "@/components/dashboard/widgets";

interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  org_id: string;
}

// Skeleton grid for loading state
function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Top row - metric cards */}
      <div className="col-span-3"><WidgetSkeleton /></div>
      <div className="col-span-3"><WidgetSkeleton /></div>
      <div className="col-span-3"><WidgetSkeleton /></div>
      <div className="col-span-3"><WidgetSkeleton /></div>

      {/* Second row - charts */}
      <div className="col-span-8 h-[200px]"><WidgetSkeleton /></div>
      <div className="col-span-4 h-[200px]"><WidgetSkeleton /></div>

      {/* Third row */}
      <div className="col-span-6 h-[240px]"><WidgetSkeleton /></div>
      <div className="col-span-6 h-[240px]"><WidgetSkeleton /></div>

      {/* Fourth row */}
      <div className="col-span-4 h-[280px]"><WidgetSkeleton /></div>
      <div className="col-span-8 h-[280px]"><WidgetSkeleton /></div>
    </div>
  );
}

// Empty state when no data
function EmptyDashboard() {
  return (
    <div className="flex h-[400px] items-center justify-center">
      <div className="text-center">
        <Activity className="mx-auto size-12 text-muted-foreground/50 mb-4" />
        <p className="text-lg font-medium text-muted-foreground">No metrics available</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Start sending requests to see dashboard metrics
        </p>
      </div>
    </div>
  );
}

export default function DashboardPageClient() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageSkeleton() {
  return (
    <div className="p-4">
      <div className="h-12 mb-4" />
      <DashboardSkeleton />
    </div>
  );
}

function DashboardPageInner() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { orgSlug, projectSlug } = params;
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get timeRange from filter store (shared with Pulse View)
  const { filters, setTimeRange } = useFilterStore();
  const timeRange = filters.timeRange;

  // Hydrate from URL on mount
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const time = searchParams.get("time");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (time) {
      const validPresets = new Set(["5m", "15m", "1h", "6h", "24h", "custom"]);
      if (validPresets.has(time)) {
        setTimeRange({
          preset: time as TimeRangePreset,
          start: start ?? undefined,
          end: end ?? undefined,
        });
      }
    }
  }, [searchParams, setTimeRange]);

  // Sync timeRange to URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (timeRange.preset !== "5m") {
      params.set("time", timeRange.preset);
    }
    if (timeRange.preset === "custom") {
      if (timeRange.start) params.set("start", timeRange.start);
      if (timeRange.end) params.set("end", timeRange.end);
    }

    const search = params.toString();
    const newUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  }, [timeRange]);

  // Handle timeframe change
  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      setTimeRange(range);
    },
    [setTimeRange]
  );

  // Fetch project ID
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        const res = await apiFetch<DataEnvelope<ProjectInfo>>(
          `/api/orgs/${orgSlug}/projects/${projectSlug}`
        );
        if (!cancelled) setProjectId(res.data.id);
      } catch {
        // Non-blocking
      }
    }

    loadProject();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, projectSlug]);

  // React Query for dashboard metrics
  const {
    data: dashboardData,
    isLoading,
    error,
  } = useQuery<DashboardMetricsResponse>({
    queryKey: ["dashboard", "metrics", projectId, timeRange.preset, timeRange.start, timeRange.end],
    queryFn: async () => {
      if (!projectId) throw new Error("No project ID");
      // Build API query params inside queryFn to avoid stale closure
      const params = new URLSearchParams();
      params.set("time", timeRange.preset);
      if (timeRange.preset === "custom") {
        if (timeRange.start) params.set("start", timeRange.start);
        if (timeRange.end) params.set("end", timeRange.end);
      }
      const res = await apiFetch<DataEnvelope<DashboardMetricsResponse>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/dashboard/metrics?${params.toString()}`
      );
      return res.data;
    },
    enabled: !!projectId,
    refetchInterval: timeRange.preset !== "custom" ? 10000 : false, // 10s polling for live presets
    staleTime: 8000,
  });

  // Log error for debugging
  if (error) {
    console.error("Dashboard metrics fetch error:", error);
  }

  const showLoading = isLoading || !projectId;
  // Show data if we have any metrics (total_requests, services, endpoints, or time series)
  const hasData = dashboardData && (
    dashboardData.total_requests > 0 ||
    dashboardData.services.length > 0 ||
    dashboardData.top_endpoints.length > 0 ||
    dashboardData.requests_per_minute.length > 0 ||
    dashboardData.status_codes.length > 0
  );
  const showEmpty = !isLoading && projectId && !hasData;
  const showData = !isLoading && dashboardData && hasData;

  // Prepare data for widgets
  const statusCodeData = dashboardData?.status_codes.map((sc) => ({
    code: sc.code,
    count: sc.count,
    color:
      sc.code === "2xx"
        ? "hsl(142, 76%, 36%)"
        : sc.code === "3xx"
        ? "hsl(221, 83%, 53%)"
        : sc.code === "4xx"
        ? "hsl(38, 92%, 50%)"
        : "hsl(0, 84%, 60%)",
  })) || [];

  const endpointData = dashboardData?.top_endpoints.map((ep) => ({
    route: ep.route,
    method: ep.method,
    count: ep.count,
    avgLatency: ep.avg_latency,
    errorRate: ep.error_rate,
  })) || [];

  // Calculate trends (mock for now - would compare to previous period)
  const errorTrend = dashboardData && dashboardData.error_rate > 1 ? "up" : "down";

  return (
    <div className="p-4 space-y-4">
      {/* Header with timeframe selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <TimeframeSelector
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          variant="inline"
        />
      </div>

      {/* Content */}
      {showLoading && <DashboardSkeleton />}
      {showEmpty && <EmptyDashboard />}
      {showData && dashboardData && (
        <div className="grid grid-cols-12 gap-4">
          {/* Row 1: Metric Cards */}
          <MetricCard
            title="Total Requests"
            value={dashboardData.total_requests.toLocaleString()}
            icon={<Activity className="size-5" />}
            className="col-span-12 sm:col-span-6 lg:col-span-3"
          />
          <MetricCard
            title="Error Rate"
            value={`${dashboardData.error_rate.toFixed(2)}%`}
            subtitle={`${dashboardData.total_errors} errors`}
            trend={errorTrend}
            trendValue={errorTrend === "up" ? "Increasing" : "Normal"}
            icon={<AlertTriangle className="size-5" />}
            variant={dashboardData.error_rate > 5 ? "danger" : dashboardData.error_rate > 1 ? "warning" : "default"}
            className="col-span-12 sm:col-span-6 lg:col-span-3"
          />
          <MetricCard
            title="P95 Latency"
            value={dashboardData.p95_latency >= 1000 ? `${(dashboardData.p95_latency / 1000).toFixed(2)}s` : `${Math.round(dashboardData.p95_latency)}ms`}
            subtitle={`Avg: ${Math.round(dashboardData.avg_latency)}ms`}
            icon={<Clock className="size-5" />}
            variant={dashboardData.p95_latency > 2000 ? "danger" : dashboardData.p95_latency > 500 ? "warning" : "default"}
            className="col-span-12 sm:col-span-6 lg:col-span-3"
          />
          <MetricCard
            title="P50 Latency"
            value={dashboardData.p50_latency >= 1000 ? `${(dashboardData.p50_latency / 1000).toFixed(2)}s` : `${Math.round(dashboardData.p50_latency)}ms`}
            subtitle={`P99: ${Math.round(dashboardData.p99_latency)}ms`}
            icon={<Zap className="size-5" />}
            className="col-span-12 sm:col-span-6 lg:col-span-3"
          />

          {/* Row 2: Main charts */}
          <ThroughputWidget
            data={dashboardData.requests_per_minute}
            className="col-span-12 lg:col-span-8"
          />
          <StatusCodeWidget
            data={statusCodeData}
            className="col-span-12 sm:col-span-6 lg:col-span-4"
          />

          {/* Row 3: Secondary charts */}
          <ErrorsTimelineWidget
            data={dashboardData.errors_per_minute}
            className="col-span-12 lg:col-span-6"
          />
          <LatencyDistributionWidget
            data={dashboardData.latency_distribution}
            p50={dashboardData.p50_latency}
            p95={dashboardData.p95_latency}
            p99={dashboardData.p99_latency}
            className="col-span-12 lg:col-span-6"
          />

          {/* Row 4: Lists and service status */}
          <TopEndpointsWidget
            endpoints={endpointData}
            className="col-span-12 lg:col-span-7"
          />
          <ServiceStatusWidget
            services={dashboardData.services}
            className="col-span-12 lg:col-span-5"
          />
        </div>
      )}
    </div>
  );
}
