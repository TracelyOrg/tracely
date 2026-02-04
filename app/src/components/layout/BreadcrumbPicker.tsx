"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import { useFilterStore } from "@/stores/filterStore";

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_at: string;
}

interface BreadcrumbPickerProps {
  currentOrgSlug?: string;
  currentProjectSlug?: string;
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function BreadcrumbPicker({
  currentOrgSlug,
  currentProjectSlug,
}: BreadcrumbPickerProps) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [orgOpen, setOrgOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);

  const availableEnvironments = useFilterStore((s) => s.availableEnvironments);
  const currentEnvironment = useFilterStore((s) => s.filters.environment);
  const setEnvironment = useFilterStore((s) => s.setEnvironment);

  const currentOrg = orgs.find((o) => o.slug === currentOrgSlug);
  const currentProject = projects.find((p) => p.slug === currentProjectSlug);

  useEffect(() => {
    let cancelled = false;

    async function loadOrgs() {
      try {
        const res = await apiFetch<DataEnvelope<OrgItem[]>>("/api/orgs");
        if (!cancelled) setOrgs(res.data);
      } catch {
        // Silently fail — orgs list is non-critical
      }
    }

    loadOrgs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentOrgSlug) {
      setProjects([]);
      return;
    }

    let cancelled = false;

    async function loadProjects() {
      try {
        const res = await apiFetch<DataEnvelope<ProjectItem[]>>(
          `/api/orgs/${currentOrgSlug}/projects`
        );
        if (!cancelled) setProjects(res.data);
      } catch {
        // Silently fail
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [currentOrgSlug]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) {
        setOrgOpen(false);
      }
      if (
        projectRef.current &&
        !projectRef.current.contains(e.target as Node)
      ) {
        setProjectOpen(false);
      }
      if (envRef.current && !envRef.current.contains(e.target as Node)) {
        setEnvOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSwitchOrg(slug: string) {
    setOrgOpen(false);
    router.push(`/${slug}`);
  }

  function handleSwitchProject(slug: string) {
    setProjectOpen(false);
    router.push(`/${currentOrgSlug}/${slug}`);
  }

  return (
    <div className="flex items-center gap-1">
      {/* Org picker */}
      <div className="relative" ref={orgRef}>
        <button
          type="button"
          onClick={() => setOrgOpen((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
        >
          <span className="max-w-[160px] truncate">
            {currentOrg?.name ?? "Select organization"}
          </span>
          <ChevronDown open={orgOpen} />
        </button>

        {orgOpen && orgs.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
            {orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => handleSwitchOrg(org.slug)}
                className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                  org.slug === currentOrgSlug ? "bg-accent font-medium" : ""
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Separator + Project picker (only when org is selected and projects exist) */}
      {currentOrgSlug && (
        <>
          <span className="text-muted-foreground">/</span>
          <div className="relative" ref={projectRef}>
            <button
              type="button"
              onClick={() => setProjectOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
            >
              <span className="max-w-[160px] truncate">
                {currentProject?.name ?? "Select project"}
              </span>
              <ChevronDown open={projectOpen} />
            </button>

            {projectOpen && projects.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => handleSwitchProject(proj.slug)}
                    className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                      proj.slug === currentProjectSlug
                        ? "bg-accent font-medium"
                        : ""
                    }`}
                  >
                    {proj.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Separator + Environment picker (only when project is selected and envs exist) */}
      {currentProjectSlug && availableEnvironments.length > 0 && (
        <>
          <span className="text-muted-foreground">/</span>
          <div className="relative" ref={envRef}>
            <button
              type="button"
              onClick={() => setEnvOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
            >
              <span className="max-w-[160px] truncate">
                {currentEnvironment ?? "All Envs"}
              </span>
              <ChevronDown open={envOpen} />
            </button>

            {envOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
                <button
                  type="button"
                  onClick={() => {
                    setEnvironment(null);
                    setEnvOpen(false);
                  }}
                  className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                    currentEnvironment === null ? "bg-accent font-medium" : ""
                  }`}
                >
                  All Envs
                </button>
                {availableEnvironments.map((env) => (
                  <button
                    key={env}
                    type="button"
                    onClick={() => {
                      setEnvironment(env);
                      setEnvOpen(false);
                    }}
                    className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                      currentEnvironment === env ? "bg-accent font-medium" : ""
                    }`}
                  >
                    {env}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
