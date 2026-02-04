import { memo } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpanEvent } from "@/types/span";

function statusColorClass(code: number): string {
  if (code >= 200 && code < 300) return "text-emerald-500";
  if (code >= 400) return "text-red-500";
  return "text-muted-foreground";
}

function StatusIcon({ code }: { code: number }) {
  const size = 12;
  if (code >= 200 && code < 300)
    return <CheckCircle size={size} className="text-emerald-500" aria-label="Status: healthy" role="img" />;
  if (code >= 400)
    return <XCircle size={size} className="text-red-500" aria-label="Status: error" role="img" />;
  return null;
}

interface ChildSpanRowProps {
  span: SpanEvent;
  depth?: number;
  childCount?: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export const ChildSpanRow = memo(function ChildSpanRow({
  span,
  depth = 1,
  childCount = 0,
  isSelected,
  onClick,
}: ChildSpanRowProps) {
  const operationName = span.span_name || span.http_route || "unknown";
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
      style={{ paddingLeft: `${16 + depth * 24}px`, paddingRight: "16px" }}
    >
      {/* Indent marker */}
      <span className="shrink-0 text-muted-foreground/40 select-none">—</span>

      {/* Operation name */}
      <span className={cn("min-w-0 flex-1 truncate", hasError ? "text-red-500" : "text-muted-foreground")}>
        {operationName}
      </span>

      {/* Sub-child count badge */}
      {childCount > 0 && (
        <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground tabular-nums">
          {childCount}
        </span>
      )}

      {/* Status */}
      {span.http_status_code > 0 && (
        <span className={cn("flex shrink-0 items-center gap-1 font-medium", statusColorClass(span.http_status_code))}>
          <StatusIcon code={span.http_status_code} />
          <span>{span.http_status_code}</span>
        </span>
      )}

      {/* Duration */}
      <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">
        {Math.round(span.duration_ms)}ms
      </span>
    </div>
  );
});
