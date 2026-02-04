import { memo } from "react";
import { Loader, Plus, Minus } from "lucide-react";
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
      {/* Timestamp — fixed width */}
      <span className="shrink-0 w-[7ch] text-xs text-muted-foreground/70 tabular-nums">
        {!isPending ? formatTimestamp(span.start_time) : "\u00A0"}
      </span>

      {/* Service name — fixed width */}
      <span className="shrink-0 w-20 text-xs text-muted-foreground/70 truncate" title={serviceName}>
        {serviceName}
      </span>

      {/* Child count toggle — fixed width */}
      <span className="shrink-0 w-10 flex items-center justify-center">
        {!isPending && childCount > 0 ? (
          <button
            onClick={handleChevronClick}
            className={cn(
              "inline-flex h-5 items-center gap-0.5 rounded px-1.5 text-[11px] font-medium tabular-nums border transition-colors",
              span.http_status_code >= 400
                ? "border-red-500/30 text-red-500 hover:bg-red-500/10"
                : span.http_status_code >= 200 && span.http_status_code < 300
                  ? "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                  : "border-border text-muted-foreground hover:bg-accent"
            )}
            tabIndex={-1}
            aria-label={isExpanded ? "Collapse children" : "Expand children"}
          >
            {isExpanded ? <Minus size={10} /> : <Plus size={10} />}
            <span>{childCount}</span>
          </button>
        ) : null}
      </span>

      {/* Status code — fixed width */}
      <span className={cn("shrink-0 w-8 text-xs font-medium text-center", !isPending && statusColorClass(span.http_status_code))}>
        {!isPending ? span.http_status_code : "\u00A0"}
      </span>

      {/* Method + Path — flex */}
      <span className="min-w-0 flex-1 truncate text-foreground">
        {isPending ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <Loader size={12} className="animate-spin text-muted-foreground" />
            <span>{method} {route}</span>
            <span className="text-xs text-muted-foreground">In Progress</span>
          </span>
        ) : (
          <span className="truncate">{method} {route}</span>
        )}
      </span>

      {/* Duration — fixed width */}
      <span className="shrink-0 w-16 text-right text-xs text-muted-foreground tabular-nums">
        {!isPending ? `${Math.round(span.duration_ms)}ms` : "\u00A0"}
      </span>
    </div>
  );
});
