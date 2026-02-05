"use client";

import { Activity, BookOpen, Plus } from "lucide-react";
import Link from "next/link";

interface EmptyHealthStateProps {
  orgSlug: string;
  projectSlug: string;
}

export function EmptyHealthState({ orgSlug, projectSlug }: EmptyHealthStateProps) {
  return (
    <div
      className="flex h-full items-center justify-center p-6"
      data-testid="empty-health-state"
    >
      <div className="w-full max-w-md text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Activity className="size-6 text-muted-foreground" />
        </div>

        <div>
          <h3 className="text-lg font-medium">No services detected yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Once your application sends telemetry data, health metrics will appear here.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/${orgSlug}/${projectSlug}/onboarding`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <BookOpen className="size-4" />
            Setup guide
          </Link>
          <a
            href="https://tracely.sh/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            View documentation
          </a>
        </div>
      </div>
    </div>
  );
}

interface SingleServicePromptProps {
  className?: string;
}

export function SingleServicePrompt({ className }: SingleServicePromptProps) {
  return (
    <div
      className={className}
      data-testid="single-service-prompt"
    >
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-4">
        <Plus className="size-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Instrument more services to see a complete health overview
        </p>
      </div>
    </div>
  );
}
