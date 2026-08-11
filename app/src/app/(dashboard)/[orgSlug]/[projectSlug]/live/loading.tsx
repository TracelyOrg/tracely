import { STREAM_SKELETON_WIDTHS } from "@/components/pulse/streamListTypes";

export default function LiveLoading() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 48px)" }}>
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 flex h-10 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur-sm">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-20 animate-pulse rounded-md bg-muted" />
        <div className="flex-1" />
        <div className="hidden lg:flex items-center gap-3">
          <div className="h-3 w-14 animate-pulse rounded bg-muted" />
          <div className="h-3 w-10 animate-pulse rounded bg-muted" />
          <div className="h-3 w-10 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-3 w-10 animate-pulse rounded bg-muted" />
      </div>

      {/* Timeline skeleton */}
      <div className="flex h-20 shrink-0 items-end gap-px border-b border-border bg-background/50 px-2 pb-5 pl-9">
        {Array.from({ length: 48 }).map((_, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 animate-pulse rounded-t-sm bg-muted"
            style={{ height: `${18 + (i % 7) * 8}%` }}
          />
        ))}
      </div>

      {/* Stream list skeleton */}
      <div className="flex flex-1 flex-col">
        {STREAM_SKELETON_WIDTHS.map((w, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border/50 px-4 py-2"
          >
            <div className="h-5 w-14 animate-pulse rounded bg-muted" />
            <div
              className="h-4 animate-pulse rounded bg-muted"
              style={{ width: `${w}%` }}
            />
            <div className="ml-auto h-4 w-10 animate-pulse rounded bg-muted" />
            <div className="h-4 w-14 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
