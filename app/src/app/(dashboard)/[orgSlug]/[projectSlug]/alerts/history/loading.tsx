"use client";

function AlertHistoryRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border last:border-b-0">
      {/* Severity icon */}
      <div className="h-5 w-5 animate-pulse rounded bg-muted" />

      {/* Alert name */}
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      </div>

      {/* Triggered at */}
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />

      {/* Resolved at */}
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />

      {/* Metric value */}
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />

      {/* Status badge */}
      <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

export default function AlertHistoryLoading() {
  return (
    <div className="p-4 space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
        {/* Tabs skeleton */}
        <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* History list skeleton */}
      <div className="rounded-lg border border-border bg-card">
        {/* Table header */}
        <div className="flex items-center gap-4 p-4 border-b border-border bg-muted/50">
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="flex-1">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <AlertHistoryRowSkeleton key={i} />
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
