"use client";

import { useState } from "react";
import { DayPicker, type DateRange, type DayButtonProps } from "react-day-picker";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  /** Currently applied range, as ISO strings. Undefined until a range has been picked. */
  start?: string;
  end?: string;
  onApply: (start: string, end: string) => void;
}

function formatRangeLabel(start?: string, end?: string): string {
  if (!start || !end) return "Select range...";
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  return `${new Date(start).toLocaleString("en-US", opts)} → ${new Date(end).toLocaleString("en-US", opts)}`;
}

function toTimeInputValue(iso: string | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours || 0, minutes || 0, 0, 0);
  return result;
}

function formatMonthLabel(month: Date): string {
  return month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function addMonths(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

/** Custom day cell button — colors range endpoints/middle beyond what the static classNames map can express. */
function RangeDayButton({ modifiers, className, ...props }: DayButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "size-8 rounded-full text-xs transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring",
        (modifiers.range_start || modifiers.range_end) && "bg-primary text-primary-foreground hover:bg-primary/90",
        modifiers.range_middle && "text-foreground",
        modifiers.today && !modifiers.range_start && !modifiers.range_end && "font-semibold text-primary",
        modifiers.outside && "text-muted-foreground/40",
        modifiers.disabled && "cursor-not-allowed text-muted-foreground/30",
        className
      )}
      {...props}
    />
  );
}

export function DateRangePicker({ start, end, onApply }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [month, setMonth] = useState<Date>(new Date());

  // Reset the draft to the last-applied value every time the popover opens
  function handleOpenChange(next: boolean) {
    if (next) {
      setRange(start && end ? { from: new Date(start), to: new Date(end) } : undefined);
      setStartTime(toTimeInputValue(start, "00:00"));
      setEndTime(toTimeInputValue(end, "23:59"));
      setMonth(start ? new Date(start) : new Date());
    }
    setOpen(next);
  }

  function handleApply() {
    if (!range?.from || !range?.to) return;
    const from = combineDateAndTime(range.from, startTime);
    const to = combineDateAndTime(range.to, endTime);
    onApply(from.toISOString(), to.toISOString());
    setOpen(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-7 max-w-[180px] items-center gap-1.5 rounded-md border bg-background px-2 text-xs transition-colors hover:bg-accent sm:max-w-[280px]"
          data-testid="header-custom-range-trigger"
        >
          <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatRangeLabel(start, end)}</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          data-slot="popover-content"
          className="z-50 w-[300px] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
        >
          {/* Editable start / end rows — date comes from the calendar below, time is free entry */}
          <div className="mb-3 space-y-1.5">
            <div
              className={cn(
                "flex items-center justify-between rounded-md border px-2 py-1.5 text-xs",
                range?.from && "border-primary/50 bg-accent/30"
              )}
              data-testid="range-start-row"
            >
              <span className={cn(!range?.from && "text-muted-foreground")}>
                {range?.from
                  ? range.from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "Start date"}
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-[70px] bg-transparent text-right text-xs focus:outline-none"
                aria-label="Start time"
              />
            </div>
            <div
              className={cn(
                "flex items-center justify-between rounded-md border px-2 py-1.5 text-xs",
                range?.to && "border-primary/50 bg-accent/30"
              )}
              data-testid="range-end-row"
            >
              <span className={cn(!range?.to && "text-muted-foreground")}>
                {range?.to
                  ? range.to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "End date"}
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-[70px] bg-transparent text-right text-xs focus:outline-none"
                aria-label="End time"
              />
            </div>
          </div>

          {/* Month navigation + "Now" shortcut */}
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs font-medium">{formatMonthLabel(month)}</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMonth(new Date())}
                className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, -1))}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Next month"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            month={month}
            onMonthChange={setMonth}
            showOutsideDays
            components={{ DayButton: RangeDayButton }}
            classNames={{
              months: "flex flex-col",
              month: "space-y-1",
              month_caption: "hidden",
              nav: "hidden",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday: "w-8 text-center text-[10px] font-medium text-muted-foreground",
              week: "flex w-full mt-0.5",
              day: "size-8 p-0 text-center align-middle",
              range_start: "rounded-l-full bg-accent/30",
              range_end: "rounded-r-full bg-accent/30",
              range_middle: "bg-accent/30",
            }}
          />

          <div className="mt-3 flex justify-end gap-2 border-t pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!range?.from || !range?.to}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              data-testid="range-apply"
            >
              Apply
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
