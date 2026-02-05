"use client";

import { cn } from "@/lib/utils";

interface HealthCardSkeletonProps {
  className?: string;
}

export function HealthCardSkeleton({ className }: HealthCardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 flex flex-col gap-3",
        className
      )}
      data-testid="health-card-skeleton"
    >
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-4 rounded bg-muted animate-pulse" />
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
      </div>

      {/* Metrics grid skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            <div className="h-5 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
