export default function OnboardingLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-2xl px-4 py-8">
        {/* Header skeleton */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>

        {/* Stepper skeleton */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-8 bg-muted" />}
              <div className="flex items-center gap-2">
                <div className="size-8 animate-pulse rounded-full bg-muted" />
                <div className="hidden h-4 w-20 animate-pulse rounded bg-muted sm:block" />
              </div>
            </div>
          ))}
        </div>

        {/* Step content skeleton */}
        <div className="mt-8 space-y-4">
          <div className="h-6 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>

        {/* Navigation skeleton */}
        <div className="mt-8 flex items-center justify-between">
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
