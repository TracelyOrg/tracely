import { memo } from "react";
import { cn } from "@/lib/utils";
import type { SpanEvent } from "@/types/span";

function statusColorClass(code: number): string {
  if (code >= 200 && code < 300) return "text-emerald-500";
  if (code >= 400) return "text-red-500";
  return "text-muted-foreground";
}

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

interface ChildSpanRowProps {
  span: SpanEvent;
  depth?: number;
  childCount?: number;
  isSelected?: boolean;
  isLast?: boolean;
  onClick?: () => void;
}

export const ChildSpanRow = memo(function ChildSpanRow({
  span,
  depth = 1,
  childCount = 0,
  isSelected,
  isLast = false,
  onClick,
}: ChildSpanRowProps) {
  const operationName = span.span_name || span.http_route || "unknown";
  const serviceName = span.service_name || "default";
  const hasError = span.http_status_code >= 400;

  const ariaLabel = `Child span: ${operationName}, status ${span.http_status_code || 0}, ${Math.round(span.duration_ms)} milliseconds`;

  return (
    <div
      role="row"
      aria-level={2}
      aria-label={ariaLabel}
      aria-selected={isSelected ?? false}
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 py-1.5 text-xs font-mono border-b border-border/30 cursor-pointer transition-colors hover:bg-accent/30",
        hasError && "text-red-500",
        isSelected && "bg-accent/50"
      )}
      style={{ paddingLeft: "16px", paddingRight: "16px" }}
    >
      {/* Timestamp — fixed width (matches StreamRow) */}
      <span className="shrink-0 w-[7ch] text-muted-foreground/70 tabular-nums">
        {formatTimestamp(span.start_time)}
      </span>

      {/* Service name — fixed width (matches StreamRow) */}
      <span className="shrink-0 w-20 text-muted-foreground/70 truncate" title={serviceName}>
        {serviceName}
      </span>

      {/* Tree connector — fixed width (matches toggle column) */}
      <span className="relative shrink-0 w-10 h-full flex items-center justify-center select-none">
        {/* Vertical line */}
        <span
          className={cn(
            "absolute left-[19px] w-px bg-border",
            isLast ? "top-0 h-1/2" : "top-0 h-full"
          )}
        />
        {/* Horizontal branch */}
        <span className="absolute left-[19px] top-1/2 h-px w-[12px] bg-border" />
        {/* Dot at junction */}
        <span className="absolute left-[30px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-border" />
      </span>

      {/* Status code — fixed width (matches StreamRow) */}
      <span className={cn("shrink-0 w-8 font-medium text-center", span.http_status_code > 0 ? statusColorClass(span.http_status_code) : "")}>
        {span.http_status_code > 0 ? span.http_status_code : "\u00A0"}
      </span>

      {/* Operation name — flex */}
      <span className={cn("min-w-0 flex-1 truncate", hasError ? "text-red-500" : "text-muted-foreground")}>
        {operationName}
      </span>

      {/* Sub-child count badge */}
      {childCount > 0 && (
        <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground tabular-nums">
          {childCount}
        </span>
      )}

      {/* Duration — fixed width (matches StreamRow) */}
      <span className="shrink-0 w-16 text-right text-muted-foreground tabular-nums">
        {Math.round(span.duration_ms)}ms
      </span>
    </div>
  );
});
