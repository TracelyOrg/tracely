import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { orgSlug, projectSlug } = await params;
  redirect(`/${orgSlug}/${projectSlug}/live`);
}
