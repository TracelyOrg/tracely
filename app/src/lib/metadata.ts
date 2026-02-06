import { cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  org_id: string;
}

interface DataEnvelope<T> {
  data: T;
}

async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await fetch(`${API_BASE}${path}`, {
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

export async function getProjectName(
  orgSlug: string,
  projectSlug: string
): Promise<{ orgName: string; projectName: string }> {
  const [orgData, projectData] = await Promise.all([
    serverFetch<DataEnvelope<OrgInfo>>(`/api/orgs/${orgSlug}`),
    serverFetch<DataEnvelope<ProjectInfo>>(
      `/api/orgs/${orgSlug}/projects/${projectSlug}`
    ),
  ]);

  return {
    orgName: orgData?.data?.name ?? orgSlug,
    projectName: projectData?.data?.name ?? projectSlug,
  };
}
