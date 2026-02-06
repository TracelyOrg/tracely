import type { Metadata } from "next";
import OrgPageContent from "./OrgPageContent";
import { getOrgName } from "@/lib/metadata";

interface PageProps {
  params: Promise<{ orgSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const orgName = await getOrgName(orgSlug);
  return {
    title: orgName,
  };
}

export default function OrgPage() {
  return <OrgPageContent />;
}
