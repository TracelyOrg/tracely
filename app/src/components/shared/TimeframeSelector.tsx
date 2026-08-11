"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { TimeRange, TimeRangePreset } from "@/types/span";

const DateRangePicker = dynamic(
  () =>
    import("@/components/shared/DateRangePicker").then((m) => ({
      default: m.DateRangePicker,
    })),
  {
    loading: () => (
      <button
        type="button"
        disabled
        className="inline-flex h-7 min-h-9 items-center rounded-md border bg-background px-2 text-xs text-muted-foreground sm:min-h-7"
      >
        Select range…
      </button>
    ),
  }
);

// Time presets available for selection (Live and shared defaults)
export const TIME_PRESETS: { key: TimeRangePreset; label: string }[] = [
  { key: "5m", label: "5 min" },
  { key: "15m", label: "15 min" },
  { key: "1h", label: "1 hour" },
  { key: "6h", label: "6 hours" },
  { key: "24h", label: "24 hours" },
  { key: "custom", label: "Custom" },
];

/** Dashboard presets — 15m minimum for meaningful trend analysis. */
export const DASHBOARD_TIME_PRESETS = TIME_PRESETS.filter((p) => p.key !== "5m");

interface TimeframeSelectorProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  className?: string;
  /** Override preset list (e.g. dashboard excludes 5m). */
  presets?: { key: TimeRangePreset; label: string }[];
  /** Whether to show inline (horizontal) or as dropdown */
  variant?: "inline" | "dropdown";
  /** Visual style for inline preset buttons */
  appearance?: "pill" | "segmented";
}

/**
 * Shared timeframe selector component used across Live and Dashboard pages.
 * Supports preset time ranges (5m, 15m, 1h, 6h, 24h) and custom date ranges.
 */
export function TimeframeSelector({
  timeRange,
  onTimeRangeChange,
  className,
  presets = TIME_PRESETS,
  variant = "inline",
  appearance = "pill",
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

  const handleCustomRangeApply = useCallback(
    (start: string, end: string) => {
      onTimeRangeChange({ preset: "custom", start, end });
    },
    [onTimeRangeChange]
  );

  const customRangePicker = timeRange.preset === "custom" && (
    <DateRangePicker
      start={timeRange.start}
      end={timeRange.end}
      onApply={handleCustomRangeApply}
    />
  );

  if (variant === "dropdown") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <select
          value={timeRange.preset}
          onChange={(e) => handlePresetChange(e.target.value as TimeRangePreset)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Time range"
        >
          {presets.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>

        {customRangePicker}
      </div>
    );
  }

  // Inline variant
  const isSegmented = appearance === "segmented";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1",
        isSegmented && "rounded-md border border-border p-0.5",
        className
      )}
      role="group"
      aria-label="Time range"
    >
      {presets.filter((p) => p.key !== "custom").map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => handlePresetChange(preset.key)}
          className={cn(
            "min-h-9 px-2.5 text-xs font-medium transition-colors",
            isSegmented
              ? cn(
                  "rounded-sm",
                  timeRange.preset === preset.key
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )
              : cn(
                  "rounded-full px-3 py-1.5 text-sm",
                  timeRange.preset === preset.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
          )}
        >
          {preset.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => handlePresetChange("custom")}
        className={cn(
          "min-h-9 px-2.5 text-xs font-medium transition-colors",
          isSegmented
            ? cn(
                "rounded-sm",
                timeRange.preset === "custom"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )
            : cn(
                "rounded-full px-3 py-1.5 text-sm",
                timeRange.preset === "custom"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
        )}
      >
        Custom
      </button>

      {customRangePicker && (
        <div className="ml-0 w-full basis-full sm:ml-2 sm:w-auto sm:basis-auto">
          {customRangePicker}
        </div>
      )}
    </div>
  );
}

export default TimeframeSelector;
