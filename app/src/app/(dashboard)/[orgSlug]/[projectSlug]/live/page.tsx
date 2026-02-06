import type { Metadata } from "next";
import LivePageClient from "./LivePageContent";
import { getProjectName } from "@/lib/metadata";

interface PageProps {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug, projectSlug } = await params;
  const { projectName } = await getProjectName(orgSlug, projectSlug);
  return {
    title: `${projectName} Live`,
  };
}

export default function LivePage() {
  return <LivePageClient />;
}
