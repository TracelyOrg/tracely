"use client";

import { useRouter } from "next/navigation";
import { Settings, Users, FolderOpen } from "lucide-react";

interface OrgCardProps {
  name: string;
  slug: string;
  userRole: string;
  memberCount: number;
  projectCount: number;
}

export default function OrgCard({
  name,
  slug,
  userRole,
  memberCount,
  projectCount,
}: OrgCardProps) {
  const router = useRouter();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/${slug}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/${slug}`);
      }}
      className="group relative flex flex-col gap-3 rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/50 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-base font-semibold tracking-tight truncate pr-8">
          {name}
        </h3>
        {userRole === "admin" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/${slug}/settings`);
            }}
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
            aria-label="Organization settings"
          >
            <Settings className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="size-3.5" />
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
        <span className="flex items-center gap-1.5">
          <FolderOpen className="size-3.5" />
          {projectCount} {projectCount === 1 ? "project" : "projects"}
        </span>
      </div>

      <span
        className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          userRole === "admin"
            ? "bg-primary/10 text-primary"
            : userRole === "member"
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {userRole}
      </span>
    </div>
  );
}
