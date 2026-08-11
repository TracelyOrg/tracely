export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 animate-pulse rounded bg-muted" />
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="h-16 animate-pulse rounded-lg border bg-muted/40" />

      <div className="grid grid-cols-12 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="col-span-12 h-24 animate-pulse rounded-xl border bg-muted/30 sm:col-span-6 lg:col-span-3"
          />
        ))}
        <div className="col-span-12 h-[200px] animate-pulse rounded-xl border bg-muted/30 lg:col-span-8" />
        <div className="col-span-12 h-[200px] animate-pulse rounded-xl border bg-muted/30 sm:col-span-6 lg:col-span-4" />
        <div className="col-span-12 h-[240px] animate-pulse rounded-xl border bg-muted/30 lg:col-span-6" />
        <div className="col-span-12 h-[240px] animate-pulse rounded-xl border bg-muted/30 lg:col-span-6" />
      </div>
    </div>
  );
}
