"use client";

import { useFilterStore } from "@/stores/filterStore";
import { cn } from "@/lib/utils";

interface DashboardEnvironmentFilterProps {
  className?: string;
}

export function DashboardEnvironmentFilter({ className }: DashboardEnvironmentFilterProps) {
  const availableEnvironments = useFilterStore((s) => s.availableEnvironments);
  const currentEnvironment = useFilterStore((s) => s.filters.environment);
  const setEnvironment = useFilterStore((s) => s.setEnvironment);

  if (availableEnvironments.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1", className)} data-testid="dashboard-env-filter">
      <label htmlFor="dashboard-env-select" className="text-xs font-medium text-muted-foreground">
        Environment
      </label>
      <select
        id="dashboard-env-select"
        value={currentEnvironment ?? ""}
        onChange={(e) => setEnvironment(e.target.value || null)}
        className="h-9 min-h-11 w-full min-w-[120px] appearance-none rounded-md border bg-background pl-2 pr-7 text-xs sm:h-9 sm:min-h-0"
      >
        <option value="">All environments</option>
        {availableEnvironments.map((env) => (
          <option key={env} value={env}>
            {env}
          </option>
        ))}
      </select>
    </div>
  );
}
