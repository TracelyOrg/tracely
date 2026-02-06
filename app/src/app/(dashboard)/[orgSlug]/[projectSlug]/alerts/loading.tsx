"use client";

function AlertCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header with name and status badge */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Description */}
      <div className="h-4 w-full animate-pulse rounded bg-muted" />

      {/* Threshold info */}
      <div className="flex items-center gap-4">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2">
        <div className="h-8 w-12 animate-pulse rounded bg-muted" />
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function CategorySkeleton({ cardCount = 2 }: { cardCount?: number }) {
  return (
    <div className="space-y-4">
      {/* Category header */}
      <div className="flex items-center gap-2">
        <div className="size-5 animate-pulse rounded bg-muted" />
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cardCount }).map((_, i) => (
          <AlertCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function AlertsLoading() {
  return (
    <div className="p-4 space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>

      {/* Category sections */}
      <CategorySkeleton cardCount={2} />
      <CategorySkeleton cardCount={2} />
      <CategorySkeleton cardCount={2} />
    </div>
  );
}
