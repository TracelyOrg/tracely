"use client";

import { useParams } from "next/navigation";

export default function LivePage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { orgSlug, projectSlug } = params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Pulse View</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live request monitoring coming in Epic 3.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          {orgSlug} / {projectSlug}
        </p>
      </div>
    </div>
  );
}
