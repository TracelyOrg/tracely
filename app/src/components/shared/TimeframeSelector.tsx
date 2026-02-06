"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { TimeRange, TimeRangePreset } from "@/types/span";

// Time presets available for selection
export const TIME_PRESETS: { key: TimeRangePreset; label: string }[] = [
  { key: "5m", label: "5 min" },
  { key: "15m", label: "15 min" },
  { key: "1h", label: "1 hour" },
  { key: "6h", label: "6 hours" },
  { key: "24h", label: "24 hours" },
  { key: "custom", label: "Custom" },
];

interface TimeframeSelectorProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  className?: string;
  /** Whether to show inline (horizontal) or as dropdown */
  variant?: "inline" | "dropdown";
}

/**
 * Shared timeframe selector component used across Live and Dashboard pages.
 * Supports preset time ranges (5m, 15m, 1h, 6h, 24h) and custom date ranges.
 */
export function TimeframeSelector({
  timeRange,
  onTimeRangeChange,
  className,
  variant = "inline",
}: TimeframeSelectorProps) {
  const handlePresetChange = useCallback(
    (preset: TimeRangePreset) => {
      if (preset === "custom") {
        // Keep existing custom dates if switching back to custom
        onTimeRangeChange({ ...timeRange, preset: "custom" });
      } else {
        onTimeRangeChange({ preset });
      }
    },
    [onTimeRangeChange, timeRange]
  );

  const handleCustomStart = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value ? new Date(e.target.value).toISOString() : undefined;
      onTimeRangeChange({ preset: "custom", start: iso, end: timeRange.end });
    },
    [onTimeRangeChange, timeRange.end]
  );

  const handleCustomEnd = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value ? new Date(e.target.value).toISOString() : undefined;
      onTimeRangeChange({ preset: "custom", start: timeRange.start, end: iso });
    },
    [onTimeRangeChange, timeRange.start]
  );

  // Format ISO to datetime-local input value
  const formatForInput = (iso?: string) => {
    if (!iso) return "";
    const date = new Date(iso);
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
  };

  if (variant === "dropdown") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <select
          value={timeRange.preset}
          onChange={(e) => handlePresetChange(e.target.value as TimeRangePreset)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Time range"
        >
          {TIME_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>

        {timeRange.preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={formatForInput(timeRange.start)}
              onChange={handleCustomStart}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Start time"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="datetime-local"
              value={formatForInput(timeRange.end)}
              onChange={handleCustomEnd}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="End time"
            />
          </div>
        )}
      </div>
    );
  }

  // Inline variant - pill buttons
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {TIME_PRESETS.filter((p) => p.key !== "custom").map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => handlePresetChange(preset.key)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
            timeRange.preset === preset.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {preset.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => handlePresetChange("custom")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
          timeRange.preset === "custom"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        Custom
      </button>

      {timeRange.preset === "custom" && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="datetime-local"
            value={formatForInput(timeRange.start)}
            onChange={handleCustomStart}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Start time"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="datetime-local"
            value={formatForInput(timeRange.end)}
            onChange={handleCustomEnd}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="End time"
          />
        </div>
      )}
    </div>
  );
}

export default TimeframeSelector;
