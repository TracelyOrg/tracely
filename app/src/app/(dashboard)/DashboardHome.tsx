"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import { Button } from "@/components/ui/button";
import OrgCard from "@/components/home/OrgCard";
import CreateOrgDialog from "@/components/home/CreateOrgDialog";

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  member_count: number;
  project_count: number;
  user_role: string;
  created_at: string;
}

export default function DashboardHome() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["orgs"],
    queryFn: () => apiFetch<DataEnvelope<OrgItem[]>>("/api/orgs"),
  });

  const orgs = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-10 w-44 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {orgs.length > 0 ? (
        <>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">
              Organizations
            </h1>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create Organization
            </Button>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {orgs.map((org) => (
              <OrgCard
                key={org.id}
                name={org.name}
                slug={org.slug}
                userRole={org.user_role}
                memberCount={org.member_count}
                projectCount={org.project_count}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-4">
            <Building2 className="size-8 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">
            No organizations yet
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Organizations group your projects and team members. Create your
            first one to get started.
          </p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create your first organization
          </Button>
        </div>
      )}

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
