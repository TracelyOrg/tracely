"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DataEnvelope } from "@/types/api";
import type { LiveDashboardResponse } from "@/types/dashboard";
import {
  RequestsWidget,
  ErrorRateWidget,
  LatencyWidget,
  ServiceStatusWidget,
  WidgetSkeleton,
} from "@/components/dashboard/widgets";

interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  org_id: string;
}

// Tab configuration for dashboard views
const DASHBOARD_TABS = [
  { key: "live", label: "Live", href: (org: string, proj: string) => `/${org}/${proj}/dashboard` },
  { key: "today", label: "Today", href: (org: string, proj: string) => `/${org}/${proj}/dashboard/today` },
  { key: "week", label: "Week", href: (org: string, proj: string) => `/${org}/${proj}/dashboard/week` },
] as const;

// Skeleton grid for loading state
function DashboardSkeleton() {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      }}
    >
      <WidgetSkeleton />
      <WidgetSkeleton />
      <WidgetSkeleton />
      <WidgetSkeleton />
    </div>
  );
}

// Empty state when no data
function EmptyDashboard() {
  return (
    <div className="flex h-[400px] items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-medium text-muted-foreground">No metrics available</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Start sending requests to see real-time dashboard metrics
        </p>
      </div>
    </div>
  );
}

// Tab navigation component (AC1, Task 1.3)
function DashboardTabs({ orgSlug, projectSlug, activeTab }: { orgSlug: string; projectSlug: string; activeTab: string }) {
  return (
    <div className="flex items-center gap-1 border-b mb-4">
      {DASHBOARD_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href(orgSlug, projectSlug)}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === tab.key
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}

function DashboardPageSkeleton() {
  return (
    <div className="p-4">
      <div className="h-10 mb-4" /> {/* Tabs placeholder */}
      <DashboardSkeleton />
    </div>
  );
}

function DashboardPageContent() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { orgSlug, projectSlug } = params;
  const pathname = usePathname();

  // Determine active tab from pathname
  const activeTab = pathname.includes("/today")
    ? "today"
    : pathname.includes("/week")
    ? "week"
    : "live";

  // Fetch project ID for API calls
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

  // React Query with 5s polling for live metrics (AC1, Task 4.1)
  const {
    data: dashboardData,
    isLoading,
    error,
  } = useQuery<LiveDashboardResponse>({
    queryKey: ["dashboard", "live", projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("No project ID");
      const res = await apiFetch<DataEnvelope<LiveDashboardResponse>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/dashboard/live`
      );
      return res.data;
    },
    enabled: !!projectId && activeTab === "live",
    refetchInterval: 5000, // 5 second polling (AC1)
    staleTime: 4000,
  });

  const showLoading = isLoading || !projectId;
  const showEmpty = !isLoading && projectId && (!dashboardData || dashboardData.services.length === 0);
  const showData = !isLoading && dashboardData && dashboardData.services.length > 0;

  return (
    <div className="p-4">
      {/* Tab navigation (Task 1.3, 1.4 - Live is default) */}
      <DashboardTabs orgSlug={orgSlug} projectSlug={projectSlug} activeTab={activeTab} />

      {/* Widget grid with CSS Grid layout (AC1, Task 1.2) */}
      {showLoading && <DashboardSkeleton />}
      {showEmpty && <EmptyDashboard />}
      {showData && (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          }}
          data-testid="dashboard-widget-grid"
        >
          {/* Requests per minute sparkline (Task 2.1) */}
          <RequestsWidget data={dashboardData.requests_per_minute} />

          {/* Error rate gauge (Task 2.2, 2.6) */}
          <ErrorRateWidget errorRate={dashboardData.error_rate} />

          {/* P95 latency display (Task 2.3) */}
          <LatencyWidget p95Latency={dashboardData.p95_latency} />

          {/* Service status indicators (Task 2.4) */}
          <ServiceStatusWidget services={dashboardData.services} />
        </div>
      )}
    </div>
  );
}
