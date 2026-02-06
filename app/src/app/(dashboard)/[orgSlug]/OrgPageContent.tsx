"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Settings, FolderOpen } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import { Button } from "@/components/ui/button";
import ProjectCard from "@/components/org/ProjectCard";
import CreateProjectDialog from "@/components/org/CreateProjectDialog";

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  user_role: string;
  created_at: string;
}

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_at: string;
}

export default function OrgPageContent() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const [createOpen, setCreateOpen] = useState(false);

  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ["orgs", orgSlug],
    queryFn: () =>
      apiFetch<DataEnvelope<OrgDetail>>(`/api/orgs/${orgSlug}`),
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["orgs", orgSlug, "projects"],
    queryFn: () =>
      apiFetch<DataEnvelope<ProjectItem[]>>(
        `/api/orgs/${orgSlug}/projects`
      ),
  });

  const org = orgData?.data;
  const projects = projectsData?.data ?? [];
  const isAdmin = org?.user_role === "admin";
  const isLoading = orgLoading || projectsLoading;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-10 w-36 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {org?.name ?? orgSlug}
          </h1>
          {isAdmin && (
            <Link
              href={`/${orgSlug}/settings`}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Settings className="size-4" />
              Settings
            </Link>
          )}
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create Project
          </Button>
        )}
      </div>

      {/* Project grid or empty state */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              name={project.name}
              slug={project.slug}
              orgSlug={orgSlug}
              createdAt={project.created_at}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-4">
            <FolderOpen className="size-8 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">
            No projects yet
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {isAdmin
              ? "Projects group your monitored services. Create your first one to start tracking."
              : "No projects have been created yet. Ask your organization admin to create one."}
          </p>
          {isAdmin && (
            <Button className="mt-6" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create your first project
            </Button>
          )}
        </div>
      )}

      {isAdmin && (
        <CreateProjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          orgSlug={orgSlug}
        />
      )}
    </div>
  );
}
