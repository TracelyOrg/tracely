"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardThresholdLegend({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn("rounded-lg border border-border bg-muted/30", className)}
      data-testid="dashboard-threshold-legend"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-muted-foreground sm:min-h-9"
      >
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <HelpCircle className="size-3.5" aria-hidden />
          How to read the colors
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <ul className="flex flex-col gap-2 border-t border-border px-3 pb-3 pt-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
          <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-success" aria-hidden />
            <span>
              <strong className="font-medium text-foreground">OK</strong> — error &lt; 1%, p95
              &lt; 500ms
            </span>
          </li>
          <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-warning" aria-hidden />
            <span>
              <strong className="font-medium text-foreground">Warning</strong> — error 1–5% or p95
              500ms–2s
            </span>
          </li>
          <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-destructive" aria-hidden />
            <span>
              <strong className="font-medium text-foreground">Critical</strong> — error ≥ 5% or
              p95 ≥ 2s
            </span>
          </li>
        </ul>
      )}
    </div>
  );
}
