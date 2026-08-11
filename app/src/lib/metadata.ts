import { cache } from "react";
import { cookies } from "next/headers";
import type { SpanEvent } from "@/types/span";
import type { DataEnvelope } from "@/types/api";
import type { DashboardMetricsResponse } from "@/types/dashboard";

/** Server-side only — use internal Docker hostname when available. */
const SERVER_API_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  org_id: string;
}

export interface InitialSpansResult {
  spans: SpanEvent[];
  hasMore: boolean;
}

async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await fetch(`${SERVER_API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const body = await res.json();
    return body as T;
  } catch {
    return null;
  }
}

export async function getOrgName(orgSlug: string): Promise<string> {
  const data = await serverFetch<DataEnvelope<OrgInfo>>(`/api/orgs/${orgSlug}`);
  return data?.data?.name ?? orgSlug;
}

export const getProject = cache(async (
  orgSlug: string,
  projectSlug: string
): Promise<ProjectInfo | null> => {
  const data = await serverFetch<DataEnvelope<ProjectInfo>>(
    `/api/orgs/${orgSlug}/projects/${projectSlug}`
  );
  return data?.data ?? null;
});

export const getInitialSpans = cache(async (
  orgSlug: string,
  projectSlug: string,
  limit = 50
): Promise<InitialSpansResult> => {
  const data = await serverFetch<DataEnvelope<SpanEvent[]>>(
    `/api/orgs/${orgSlug}/projects/${projectSlug}/spans?limit=${limit}`
  );

  if (!data?.data) {
    return { spans: [], hasMore: false };
  }

  const fetched = data.data;
  const spans = fetched.length > 0 ? [...fetched].reverse() : [];
  const hasMore =
    fetched.length > 0
      ? (data.meta as { has_more?: boolean }).has_more !== false
      : false;

  return { spans, hasMore };
});

export interface DashboardMetricsParams {
  time?: string;
  start?: string;
  end?: string;
  env?: string | null;
}

export const getDashboardMetrics = cache(async (
  orgSlug: string,
  projectSlug: string,
  params: DashboardMetricsParams = {}
): Promise<DashboardMetricsResponse | null> => {
  const search = new URLSearchParams();
  search.set("time", params.time ?? "15m");
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  if (params.env) search.set("env", params.env);

  const data = await serverFetch<DataEnvelope<DashboardMetricsResponse>>(
    `/api/orgs/${orgSlug}/projects/${projectSlug}/dashboard/metrics?${search.toString()}`
  );
  return data?.data ?? null;
});

export async function getProjectName(
  orgSlug: string,
  projectSlug: string
): Promise<{ orgName: string; projectName: string }> {
  const [orgData, project] = await Promise.all([
    serverFetch<DataEnvelope<OrgInfo>>(`/api/orgs/${orgSlug}`),
    getProject(orgSlug, projectSlug),
  ]);

  return {
    orgName: orgData?.data?.name ?? orgSlug,
    projectName: project?.name ?? projectSlug,
  };
}
