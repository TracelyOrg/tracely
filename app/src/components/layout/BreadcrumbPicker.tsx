"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import { useFilterStore } from "@/stores/filterStore";
import { useLiveStreamStore } from "@/stores/liveStreamStore";
import { useHealthData } from "@/hooks/useHealthData";
import type { HealthStatus } from "@/types/health";
import { cn } from "@/lib/utils";

// Time window for real-time health calculation (30 seconds)
const REALTIME_WINDOW_MS = 30_000;

// Thresholds for health status (matching backend)
const ERROR_THRESHOLD_HEALTHY = 1; // < 1% = healthy
const ERROR_THRESHOLD_DEGRADED = 5; // < 5% = degraded, >= 5% = error
const P95_THRESHOLD_HEALTHY = 500; // < 500ms = healthy
const P95_THRESHOLD_DEGRADED = 2000; // < 2000ms = degraded, >= 2000ms = error

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_at: string;
}

interface BreadcrumbPickerProps {
  currentOrgSlug?: string;
  currentProjectSlug?: string;
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function getWorstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

function calculateStatusFromMetrics(errorRate: number, p95: number): HealthStatus {
  // Error status: both metrics exceed degraded thresholds
  if (errorRate >= ERROR_THRESHOLD_DEGRADED && p95 >= P95_THRESHOLD_DEGRADED) {
    return "error";
  }
  // Degraded status: either metric is above healthy threshold
  if (errorRate >= ERROR_THRESHOLD_HEALTHY || p95 >= P95_THRESHOLD_HEALTHY) {
    return "degraded";
  }
  return "healthy";
}

const statusConfig = {
  healthy: { color: "text-emerald-500", bgColor: "bg-emerald-500/10", Icon: CheckCircle2, label: "Healthy" },
  degraded: { color: "text-amber-500", bgColor: "bg-amber-500/10", Icon: AlertTriangle, label: "Degraded" },
  error: { color: "text-red-500", bgColor: "bg-red-500/10", Icon: XCircle, label: "Error" },
};

export default function BreadcrumbPicker({
  currentOrgSlug,
  currentProjectSlug,
}: BreadcrumbPickerProps) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [orgOpen, setOrgOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);

  const availableEnvironments = useFilterStore((s) => s.availableEnvironments);
  const currentEnvironment = useFilterStore((s) => s.filters.environment);
  const setEnvironment = useFilterStore((s) => s.setEnvironment);

  const currentOrg = orgs.find((o) => o.slug === currentOrgSlug);
  const currentProject = projects.find((p) => p.slug === currentProjectSlug);

  // Health data from API (fallback with caching)
  const { data: healthData, isLoading: healthLoading } = useHealthData({
    orgSlug: currentOrgSlug ?? "",
    projectSlug: currentProjectSlug ?? "",
    enabled: !!currentOrgSlug && !!currentProjectSlug,
  });

  // Real-time health from live span stream (instant reactivity)
  const spans = useLiveStreamStore((s) => s.spans);
  const childrenMap = useLiveStreamStore((s) => s.childrenMap);

  // Compute real-time health status from recent spans
  const realtimeStatus = useMemo((): HealthStatus | null => {
    const now = Date.now();
    const cutoff = now - REALTIME_WINDOW_MS;

    // Collect all spans (roots + children) that are completed (not pending)
    const allSpans = [
      ...spans,
      ...Object.values(childrenMap).flat(),
    ].filter((s) => {
      if (s.span_type === "pending_span") return false;
      const spanTime = new Date(s.start_time).getTime();
      return spanTime >= cutoff;
    });

    // Need at least a few spans to compute meaningful metrics
    if (allSpans.length < 3) return null;

    // Calculate error rate
    const errorCount = allSpans.filter((s) => s.http_status_code >= 400).length;
    const errorRate = (errorCount / allSpans.length) * 100;

    // Calculate p95 latency
    const durations = allSpans
      .map((s) => s.duration_ms)
      .filter((d) => d > 0)
      .sort((a, b) => a - b);

    if (durations.length === 0) return null;

    const p95Index = Math.floor(durations.length * 0.95);
    const p95 = durations[Math.min(p95Index, durations.length - 1)];

    return calculateStatusFromMetrics(errorRate, p95);
  }, [spans, childrenMap]);

  // Use real-time status if available, otherwise fall back to API data
  const worstStatus = useMemo(() => {
    // Prefer real-time status for instant reactivity
    if (realtimeStatus) return realtimeStatus;
    // Fall back to API data
    if (!healthData?.services.length) return null;
    return getWorstStatus(healthData.services.map((s) => s.status));
  }, [realtimeStatus, healthData]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrgs() {
      try {
        const res = await apiFetch<DataEnvelope<OrgItem[]>>("/api/orgs");
        if (!cancelled) setOrgs(res.data);
      } catch {
        // Silently fail — orgs list is non-critical
      }
    }

    loadOrgs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentOrgSlug) return;

    let cancelled = false;

    async function loadProjects() {
      setProjects([]);
      try {
        const res = await apiFetch<DataEnvelope<ProjectItem[]>>(
          `/api/orgs/${currentOrgSlug}/projects`
        );
        if (!cancelled) setProjects(res.data);
      } catch {
        // Silently fail
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [currentOrgSlug]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) {
        setOrgOpen(false);
      }
      if (
        projectRef.current &&
        !projectRef.current.contains(e.target as Node)
      ) {
        setProjectOpen(false);
      }
      if (envRef.current && !envRef.current.contains(e.target as Node)) {
        setEnvOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSwitchOrg(slug: string) {
    setOrgOpen(false);
    router.push(`/${slug}`);
  }

  function handleSwitchProject(slug: string) {
    setProjectOpen(false);
    router.push(`/${currentOrgSlug}/${slug}`);
  }

  return (
    <div className="flex items-center gap-1">
      {/* Home link */}
      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
        aria-label="Home"
      >
        <Home className="size-4" />
      </button>

      {currentOrgSlug && <span className="text-muted-foreground">/</span>}

      {/* Org picker */}
      {currentOrgSlug && (
        <div className="relative" ref={orgRef}>
          <button
            type="button"
            onClick={() => setOrgOpen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
          >
            <span className="max-w-[160px] truncate">
              {currentOrg?.name ?? "Select organization"}
            </span>
            <ChevronDown open={orgOpen} />
          </button>

          {orgOpen && orgs.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSwitchOrg(org.slug)}
                  className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                    org.slug === currentOrgSlug ? "bg-accent font-medium" : ""
                  }`}
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Separator + Project picker (only when org is selected and projects exist) */}
      {currentOrgSlug && (
        <>
          <span className="text-muted-foreground">/</span>
          <div className="relative" ref={projectRef}>
            <button
              type="button"
              onClick={() => setProjectOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
            >
              <span className="max-w-[160px] truncate">
                {currentProject?.name ?? "Select project"}
              </span>
              <ChevronDown open={projectOpen} />
            </button>

            {projectOpen && projects.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => handleSwitchProject(proj.slug)}
                    className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                      proj.slug === currentProjectSlug
                        ? "bg-accent font-medium"
                        : ""
                    }`}
                  >
                    {proj.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Separator + Environment picker (only when project is selected and envs exist) */}
      {currentProjectSlug && availableEnvironments.length > 0 && (
        <>
          <span className="text-muted-foreground">/</span>
          <div className="relative" ref={envRef}>
            <button
              type="button"
              onClick={() => setEnvOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
            >
              <span className="max-w-[160px] truncate">
                {currentEnvironment ?? "All Envs"}
              </span>
              <ChevronDown open={envOpen} />
            </button>

            {envOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
                <button
                  type="button"
                  onClick={() => {
                    setEnvironment(null);
                    setEnvOpen(false);
                  }}
                  className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                    currentEnvironment === null ? "bg-accent font-medium" : ""
                  }`}
                >
                  All Envs
                </button>
                {availableEnvironments.map((env) => (
                  <button
                    key={env}
                    type="button"
                    onClick={() => {
                      setEnvironment(env);
                      setEnvOpen(false);
                    }}
                    className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                      currentEnvironment === env ? "bg-accent font-medium" : ""
                    }`}
                  >
                    {env}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Health badge (Story 4.1) - right after environment */}
      {currentProjectSlug && worstStatus && !healthLoading && (
        <div
          className={cn(
            "ml-2 flex items-center gap-1.5 rounded-md px-2 py-1",
            statusConfig[worstStatus].bgColor
          )}
          data-testid="breadcrumb-health-badge"
        >
          {(() => {
            const { Icon, color, label } = statusConfig[worstStatus];
            return (
              <>
                <Icon className={cn("size-3.5", color)} />
                <span className={cn("text-xs font-medium", color)}>{label}</span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
