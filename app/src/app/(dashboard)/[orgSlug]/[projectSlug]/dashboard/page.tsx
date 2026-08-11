import type { Metadata } from "next";
import DashboardPageClient from "./DashboardPageContent";
import { getDashboardMetrics, getProject, getProjectName } from "@/lib/metadata";

interface PageProps {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug, projectSlug } = await params;
  const { projectName } = await getProjectName(orgSlug, projectSlug);
  return {
    title: `${projectName} Dashboard`,
  };
}

export default async function DashboardPage({ params }: PageProps) {
  const { orgSlug, projectSlug } = await params;

  const [project, initialMetrics] = await Promise.all([
    getProject(orgSlug, projectSlug),
    getDashboardMetrics(orgSlug, projectSlug, { time: "15m" }),
  ]);

  return (
    <DashboardPageClient
      orgSlug={orgSlug}
      projectSlug={projectSlug}
      projectId={project?.id ?? null}
      initialMetrics={project ? initialMetrics : null}
    />
  );
}
