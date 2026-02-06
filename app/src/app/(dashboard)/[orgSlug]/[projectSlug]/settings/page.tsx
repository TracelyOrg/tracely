import type { Metadata } from "next";
import ProjectSettingsClient from "./ProjectSettingsContent";
import { getProjectName } from "@/lib/metadata";

interface PageProps {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug, projectSlug } = await params;
  const { projectName } = await getProjectName(orgSlug, projectSlug);
  return {
    title: `${projectName} Settings`,
  };
}

export default function ProjectSettingsPage() {
  return <ProjectSettingsClient />;
}
