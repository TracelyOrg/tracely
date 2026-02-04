"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Filter, Search, X, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFilterStore, getActiveFilterCount } from "@/stores/filterStore";
import type { StatusCodeGroup, TimeRangePreset } from "@/types/span";

const STATUS_GROUPS: { key: StatusCodeGroup; label: string; color: string }[] = [
  { key: "2xx", label: "2xx", color: "text-emerald-600 border-emerald-500/50 bg-emerald-500/10" },
  { key: "3xx", label: "3xx", color: "text-blue-600 border-blue-500/50 bg-blue-500/10" },
  { key: "4xx", label: "4xx", color: "text-amber-600 border-amber-500/50 bg-amber-500/10" },
  { key: "5xx", label: "5xx", color: "text-red-600 border-red-500/50 bg-red-500/10" },
];

const TIME_PRESETS: { key: TimeRangePreset; label: string }[] = [
  { key: "15m", label: "15m" },
  { key: "1h", label: "1h" },
  { key: "6h", label: "6h" },
  { key: "24h", label: "24h" },
  { key: "custom", label: "Custom" },
];

interface FilterBarProps {
  /** Unique service names from the current span buffer */
  services: string[];
  /** Called when custom time range is being configured */
  onCustomTimeRange?: () => void;
}

export const FilterBar = memo(function FilterBar({ services, onCustomTimeRange }: FilterBarProps) {
  const filters = useFilterStore((s) => s.filters);
  const setService = useFilterStore((s) => s.setService);
  const toggleStatusGroup = useFilterStore((s) => s.toggleStatusGroup);
  const setEndpointSearch = useFilterStore((s) => s.setEndpointSearch);
  const setTimeRange = useFilterStore((s) => s.setTimeRange);
  const clearAll = useFilterStore((s) => s.clearAll);

  const activeCount = getActiveFilterCount(filters);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleServiceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setService(e.target.value === "" ? null : e.target.value);
    },
    [setService]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEndpointSearch(e.target.value);
    },
    [setEndpointSearch]
  );

  const handleTimePreset = useCallback(
    (preset: TimeRangePreset) => {
      if (preset === "custom") {
        onCustomTimeRange?.();
        setTimeRange({ preset: "custom" });
      } else {
        setTimeRange({ preset });
      }
    },
    [setTimeRange, onCustomTimeRange]
  );

  const handleCustomStart = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value ? new Date(e.target.value).toISOString() : undefined;
      setTimeRange({ preset: "custom", start: iso, end: filters.timeRange.end });
    },
    [setTimeRange, filters.timeRange.end]
  );

  const handleCustomEnd = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value ? new Date(e.target.value).toISOString() : undefined;
      setTimeRange({ preset: "custom", start: filters.timeRange.start, end: iso });
    },
    [setTimeRange, filters.timeRange.start]
  );

  const toggleSearch = useCallback(() => {
    const wasOpen = searchOpen;
    setSearchOpen(!wasOpen);
    if (!wasOpen) {
      setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setEndpointSearch("");
    }
  }, [searchOpen, setEndpointSearch]);

  return (
    <div className="flex items-center gap-2 border-b bg-background/95 px-4 py-1.5 backdrop-blur-sm" data-testid="filter-bar">
      {/* Filter icon + badge */}
      <div className="relative flex items-center gap-1.5 text-muted-foreground">
        <Filter className="size-3.5" />
        <span className="text-xs font-medium">Filters</span>
        {activeCount > 0 && (
          <span
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
            data-testid="filter-badge"
          >
            {activeCount}
          </span>
        )}
      </div>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Service dropdown */}
      <div className="relative">
        <select
          value={filters.service ?? ""}
          onChange={handleServiceChange}
          className="h-7 appearance-none rounded-md border bg-background pl-2 pr-6 text-xs transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="filter-service"
        >
          <option value="">All services</option>
          {services.map((svc) => (
            <option key={svc} value={svc}>
              {svc}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Status code group toggles */}
      <div className="flex items-center gap-0.5" data-testid="filter-status-groups">
        {STATUS_GROUPS.map(({ key, label, color }) => {
          const active = filters.statusGroups.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggleStatusGroup(key)}
              className={cn(
                "h-6 rounded-md border px-2 text-xs font-medium transition-colors",
                active
                  ? color
                  : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              data-testid={`filter-status-${key}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Endpoint search */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={toggleSearch}
          className={cn(searchOpen && "text-primary")}
          data-testid="filter-search-toggle"
        >
          <Search className="size-3.5" />
        </Button>
        {searchOpen && (
          <Input
            ref={searchRef}
            type="text"
            placeholder="Search endpoint..."
            value={filters.endpointSearch}
            onChange={handleSearchChange}
            className="h-7 w-36 text-xs"
            data-testid="filter-search-input"
          />
        )}
      </div>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Time range presets */}
      <div className="flex items-center gap-0.5" data-testid="filter-time-range">
        <Clock className="mr-1 size-3.5 text-muted-foreground" />
        {TIME_PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTimePreset(key)}
            className={cn(
              "h-6 rounded-md px-2 text-xs font-medium transition-colors",
              filters.timeRange.preset === key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            data-testid={`filter-time-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom time range inputs (AC5) */}
      {filters.timeRange.preset === "custom" && (
        <div className="flex items-center gap-1" data-testid="filter-custom-range">
          <input
            type="datetime-local"
            onChange={handleCustomStart}
            className="h-7 rounded-md border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="filter-custom-start"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="datetime-local"
            onChange={handleCustomEnd}
            className="h-7 rounded-md border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="filter-custom-end"
          />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear all */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="xs"
          onClick={clearAll}
          className="text-muted-foreground"
          data-testid="filter-clear-all"
        >
          <X className="size-3" />
          Clear all
        </Button>
      )}
    </div>
  );
});
