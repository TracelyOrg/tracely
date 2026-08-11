"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto size-10 text-destructive" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">Dashboard unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We could not load project metrics. This may be a temporary network or server issue.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <Link
            href="../live"
            className="inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-medium"
          >
            Open Live view
          </Link>
        </div>
      </div>
    </div>
  );
}
