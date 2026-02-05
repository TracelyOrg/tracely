"use client";

import { cn } from "@/lib/utils";

interface WidgetSkeletonProps {
  className?: string;
}

export function WidgetSkeleton({ className }: WidgetSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 min-h-[180px]",
        className
      )}
      data-testid="widget-skeleton"
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>

      {/* Value skeleton */}
      <div className="mb-4">
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
      </div>

      {/* Chart/content skeleton */}
      <div className="h-16 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}
