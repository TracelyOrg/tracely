import { memo } from "react";
import { CheckCircle, AlertCircle, XCircle, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpanEvent } from "@/types/span";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/10 text-blue-600",
  POST: "bg-green-500/10 text-green-600",
  PUT: "bg-amber-500/10 text-amber-600",
  PATCH: "bg-orange-500/10 text-orange-600",
  DELETE: "bg-red-500/10 text-red-600",
};

function statusColorClass(code: number): string {
  if (code >= 200 && code < 300) return "text-emerald-500";
  if (code >= 400 && code < 500) return "text-amber-500";
  if (code >= 500) return "text-red-500";
  return "text-muted-foreground";
}

function StatusIcon({ code }: { code: number }) {
  const size = 14;
  if (code >= 200 && code < 300) return <CheckCircle size={size} className="text-emerald-500" />;
  if (code >= 400 && code < 500) return <AlertCircle size={size} className="text-amber-500" />;
  if (code >= 500) return <XCircle size={size} className="text-red-500" />;
  return null;
}

interface StreamRowProps {
  span: SpanEvent;
  isSelected?: boolean;
  onClick?: () => void;
}

export const StreamRow = memo(function StreamRow({ span, isSelected, onClick }: StreamRowProps) {
  const isPending = span.span_type === "pending_span";
  const route = span.http_route || span.span_name;
  const methodColor = METHOD_COLORS[span.http_method] ?? "bg-muted text-muted-foreground";

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onClick) onClick();
      }}
      className={cn(
        "flex items-center gap-3 px-4 py-2 text-sm font-mono border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50",
        isPending && "opacity-70",
        isSelected && "bg-accent"
      )}
    >
      {/* HTTP Method Badge */}
      <span
        className={cn(
          "inline-flex w-16 shrink-0 items-center justify-center rounded px-2 py-0.5 text-xs font-semibold uppercase",
          methodColor
        )}
      >
        {span.http_method || "—"}
      </span>

      {/* URL Path */}
      <span className="min-w-0 flex-1 truncate text-foreground">
        {route}
      </span>

      {/* Status Code or Pending */}
      {isPending ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <Loader size={12} className="animate-spin" />
          <span>In Progress</span>
        </span>
      ) : (
        <span className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", statusColorClass(span.http_status_code))}>
          <StatusIcon code={span.http_status_code} />
          <span>{span.http_status_code}</span>
        </span>
      )}

      {/* Response Time */}
      {!isPending && (
        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {Math.round(span.duration_ms)}ms
        </span>
      )}
    </div>
  );
});
