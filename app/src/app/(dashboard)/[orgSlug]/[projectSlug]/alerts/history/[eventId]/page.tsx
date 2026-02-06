import type { Metadata } from "next";
import AlertEventDetailContent from "./AlertEventDetailContent";
import { getProjectName } from "@/lib/metadata";

interface PageProps {
  params: Promise<{ orgSlug: string; projectSlug: string; eventId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug, projectSlug } = await params;
  const { projectName } = await getProjectName(orgSlug, projectSlug);
  return {
    title: `Alert Event Detail - ${projectName}`,
  };
}

export default function AlertEventDetailPage() {
  return <AlertEventDetailContent />;
}
