import { memo } from "react";
import { CheckCircle, XCircle, Loader, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpanEvent } from "@/types/span";

function statusColorClass(code: number): string {
  if (code >= 200 && code < 300) return "text-emerald-500";
  if (code >= 400) return "text-red-500";
  return "text-muted-foreground";
}

function StatusIcon({ code }: { code: number }) {
  const size = 14;
  if (code >= 200 && code < 300)
    return <CheckCircle size={size} className="text-emerald-500" aria-label="Status: healthy" role="img" />;
  if (code >= 400)
    return <XCircle size={size} className="text-red-500" aria-label="Status: error" role="img" />;
  return null;
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

interface StreamRowProps {
  span: SpanEvent;
  isSelected?: boolean;
  childCount?: number;
  hasErrorChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClick?: () => void;
}

export const StreamRow = memo(function StreamRow({
  span,
  isSelected,
  childCount = 0,
  hasErrorChildren = false,
  isExpanded = false,
  onToggleExpand,
  onClick,
}: StreamRowProps) {
  const isPending = span.span_type === "pending_span";
  const route = span.http_route || span.span_name;
  const method = span.http_method || "";
  const serviceName = span.service_name || "default";

  const ariaLabel = isPending
    ? `${method} ${route}, in progress`
    : `${method} ${route}, status ${span.http_status_code}, ${Math.round(span.duration_ms)} milliseconds`;

  function handleChevronClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleExpand?.();
  }

  return (
    <div
      role="row"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-selected={isSelected ?? false}
      aria-expanded={childCount > 0 ? isExpanded : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onClick) onClick();
      }}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-mono border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50",
        isPending && "opacity-70",
        isSelected && "bg-accent"
      )}
    >
      {/* Chevron toggle */}
      <button
        onClick={handleChevronClick}
        className={cn(
          "flex shrink-0 items-center justify-center w-4 h-4",
          childCount === 0 && "invisible"
        )}
        tabIndex={-1}
        aria-label={isExpanded ? "Collapse children" : "Expand children"}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
      </button>

      {/* Service name */}
      <span className="shrink-0 text-xs text-muted-foreground/70 w-16 truncate" title={serviceName}>
        {serviceName}
      </span>

      {/* Method + Path as single string */}
      <span className="min-w-0 flex-1 truncate text-foreground">
        {isPending ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <Loader size={12} className="animate-spin text-muted-foreground" />
            <span>{method} {route}</span>
            <span className="text-xs text-muted-foreground">In Progress</span>
          </span>
        ) : (
          `${method} ${route}`
        )}
      </span>

      {/* Child count badge */}
      {!isPending && childCount > 0 && (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
            hasErrorChildren
              ? "bg-red-500 text-white"
              : "bg-muted text-muted-foreground"
          )}
        >
          {childCount}
        </span>
      )}

      {/* Status Code */}
      {!isPending && (
        <span className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", statusColorClass(span.http_status_code))}>
          <StatusIcon code={span.http_status_code} />
          <span>{span.http_status_code}</span>
        </span>
      )}

      {/* Timestamp */}
      {!isPending && (
        <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums">
          {formatTimestamp(span.start_time)}
        </span>
      )}

      {/* Duration */}
      {!isPending && (
        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {Math.round(span.duration_ms)}ms
        </span>
      )}
    </div>
  );
});
