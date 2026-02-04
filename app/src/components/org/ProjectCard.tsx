"use client";

import { useRouter } from "next/navigation";
import { Settings, Activity } from "lucide-react";

interface ProjectCardProps {
  name: string;
  slug: string;
  orgSlug: string;
  createdAt: string;
  isAdmin: boolean;
}

export default function ProjectCard({
  name,
  slug,
  orgSlug,
  createdAt,
  isAdmin,
}: ProjectCardProps) {
  const router = useRouter();

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/${orgSlug}/${slug}/live`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/${orgSlug}/${slug}/live`);
      }}
      className="group relative flex flex-col gap-3 rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/50 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight truncate pr-8">
            {name}
          </h3>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/${orgSlug}/${slug}/settings`);
            }}
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
            aria-label="Project settings"
          >
            <Settings className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="font-mono text-xs">{slug}</span>
        <span>Created {formattedDate}</span>
      </div>
    </div>
  );
}
