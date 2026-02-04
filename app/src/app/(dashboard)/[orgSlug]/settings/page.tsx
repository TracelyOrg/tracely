"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GeneralTab from "@/components/settings/GeneralTab";
import TeamTab from "@/components/settings/TeamTab";
import { useEffect } from "react";

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  user_role: string;
  created_at: string;
}

export default function OrgSettingsPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const router = useRouter();

  const { data: orgData, isLoading } = useQuery({
    queryKey: ["orgs", orgSlug],
    queryFn: () =>
      apiFetch<DataEnvelope<OrgDetail>>(`/api/orgs/${orgSlug}`),
  });

  const org = orgData?.data;
  const isAdmin = org?.user_role === "admin";

  useEffect(() => {
    if (!isLoading && org && !isAdmin) {
      router.replace(`/${orgSlug}`);
    }
  }, [isLoading, org, isAdmin, orgSlug, router]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-64 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/${orgSlug}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to {org?.name ?? orgSlug}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          Organization Settings
        </h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          {org && (
            <GeneralTab
              orgSlug={orgSlug}
              orgName={org.name}
              orgSlugValue={org.slug}
              createdAt={org.created_at}
            />
          )}
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <TeamTab orgSlug={orgSlug} isAdmin={isAdmin} orgName={org?.name ?? orgSlug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
