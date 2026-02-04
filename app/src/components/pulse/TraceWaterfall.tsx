"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Globe,
  Database,
  Server,
  Layers,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildSpanTree, flattenTree, getAllSpanIds } from "@/lib/spanTree";
import type { SpanEvent, TraceSpanEvent, SpanTreeNode, SpanLogEvent } from "@/types/span";

// --- Types ---

interface TraceWaterfallProps {
  spans: TraceSpanEvent[];
  loading: boolean;
  error: string | null;
}

// --- Helpers ---

/** Get icon for span kind */
function KindIcon({ kind }: { kind: string }) {
  const cls = "size-3.5 shrink-0";
  switch (kind) {
    case "SERVER":
      return <Server className={cls} />;
    case "CLIENT":
      return <Globe className={cls} />;
    case "PRODUCER":
      return <ArrowRight className={cls} />;
    case "CONSUMER":
      return <ArrowLeft className={cls} />;
    default:
      return <Layers className={cls} />;
  }
}

/** Format duration for display */
function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}us`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Get the waterfall bar color based on status */
function barColor(node: SpanTreeNode): string {
  if (node.span.status_code === "ERROR" || node.span.http_status_code >= 500) {
    return "bg-red-500";
  }
  if (node.isBottleneck) {
    return "bg-amber-500";
  }
  return "bg-blue-500";
}

/** Get duration badge style for slow/bottleneck spans */
function durationBadgeClass(node: SpanTreeNode): string {
  if (node.isSlowest) {
    return "bg-red-500/15 text-red-600 ring-1 ring-red-500/30";
  }
  if (node.isBottleneck) {
    return "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30";
  }
  return "text-muted-foreground";
}

// --- Skeleton ---

function WaterfallSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[100, 80, 60, 70, 50, 65].map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="h-4 animate-pulse rounded bg-muted"
            style={{ width: `${w}px`, marginLeft: `${i * 16}px` }}
          />
          <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// --- Span Row ---

interface SpanRowProps {
  node: SpanTreeNode;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

function SpanRow({ node, isExpanded, onToggle }: SpanRowProps) {
  const hasChildren = node.children.length > 0;
  const indent = node.depth * 20;

  return (
    <div
      className="group flex items-center gap-1 border-b border-muted/50 hover:bg-accent/30 transition-colors"
      style={{ minHeight: 36 }}
    >
      {/* Left: tree label area (fixed ~45%) */}
      <div
        className="flex shrink-0 items-center gap-1 py-1.5 pr-2"
        style={{ width: "45%", paddingLeft: `${8 + indent}px` }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.span.span_id)}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronRight className="size-3.5" />
            </motion.div>
          </button>
        ) : (
          <span className="inline-block w-[22px]" />
        )}

        {/* Kind icon */}
        <span className="text-muted-foreground">
          <KindIcon kind={node.span.kind} />
        </span>

        {/* Span name */}
        <span className="truncate font-mono text-xs" title={node.span.span_name}>
          {node.span.span_name}
        </span>
      </div>

      {/* Right: waterfall bar area (remaining ~55%) */}
      <div className="relative flex flex-1 items-center py-1.5 pr-3">
        {/* Waterfall timing bar */}
        <div className="relative h-5 w-full">
          <div
            className={cn(
              "absolute top-0 h-full rounded-sm opacity-80 transition-all",
              barColor(node)
            )}
            style={{
              left: `${Math.min(node.offsetPercent, 99)}%`,
              width: `${Math.max(node.percentOfTrace, 0.5)}%`,
            }}
          />

          {/* Duration label positioned after bar */}
          <span
            className={cn(
              "absolute top-0.5 whitespace-nowrap font-mono text-[10px] leading-4",
              durationBadgeClass(node)
            )}
            style={{
              left: `${Math.min(node.offsetPercent + node.percentOfTrace + 1, 85)}%`,
            }}
          >
            {formatDuration(node.span.duration_ms)}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Collapsed Summary Row ---

function CollapsedSummary({ node }: { node: SpanTreeNode }) {
  const totalChildren = countDescendants(node);
  const totalMs = node.childrenDurationMs;

  return (
    <div
      className="flex items-center border-b border-muted/50 bg-muted/20 text-[10px] text-muted-foreground italic"
      style={{ paddingLeft: `${8 + (node.depth + 1) * 20 + 22}px`, minHeight: 24 }}
    >
      {totalChildren} child span{totalChildren !== 1 ? "s" : ""},{" "}
      {formatDuration(totalMs)} total
    </div>
  );
}

function countDescendants(node: SpanTreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}

// --- Bottleneck Label ---

function BottleneckBadge() {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
      <AlertTriangle className="size-2.5" />
      Bottleneck
    </span>
  );
}

// --- Timing Header ---

function TimingHeader({ traceDurationMs }: { traceDurationMs: number }) {
  const markers = [0, 25, 50, 75, 100];
  return (
    <div className="flex items-center border-b bg-muted/30">
      <div className="shrink-0 px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider" style={{ width: "45%" }}>
        Span
      </div>
      <div className="relative flex-1 py-1.5 pr-3">
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          {markers.map((pct) => (
            <span key={pct}>{formatDuration((traceDurationMs * pct) / 100)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Log Events (AC3) ---

interface LogEventsProps {
  events: SpanLogEvent[];
  depth: number;
}

function LogEvents({ events, depth }: LogEventsProps) {
  if (events.length === 0) return null;

  const levelColor: Record<string, string> = {
    error: "text-red-500",
    warn: "text-amber-500",
    info: "text-blue-500",
    debug: "text-muted-foreground",
  };

  return (
    <>
      {events.map((evt, i) => (
        <div
          key={i}
          className="flex items-center gap-2 border-b border-dashed border-muted/40 bg-muted/10 py-1 text-[10px]"
          style={{ paddingLeft: `${8 + (depth + 1) * 20 + 22}px` }}
        >
          <span className="font-mono text-muted-foreground">
            {new Date(evt.timestamp).toLocaleTimeString([], {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              fractionalSecondDigits: 3,
            } as Intl.DateTimeFormatOptions)}
          </span>
          <span className={cn("font-semibold uppercase", levelColor[evt.level] || "text-muted-foreground")}>
            {evt.level}
          </span>
          <span className="truncate font-mono">{evt.message || evt.name}</span>
        </div>
      ))}
    </>
  );
}

// --- Timing Detail Row (AC4) ---

function TimingDetail({ node, traceDurationMs, traceStartTime }: {
  node: SpanTreeNode;
  traceDurationMs: number;
  traceStartTime: string;
}) {
  const relativeStartMs = node.offsetMs;
  const pct = node.percentOfTrace;

  return (
    <div
      className="flex items-center gap-3 border-b border-dashed border-muted/40 bg-muted/10 py-1 pr-3 text-[10px] text-muted-foreground font-mono"
      style={{ paddingLeft: `${8 + (node.depth + 1) * 20 + 22}px` }}
    >
      <span>+{formatDuration(relativeStartMs)}</span>
      <span>{formatDuration(node.span.duration_ms)}</span>
      <span>{pct.toFixed(1)}% of trace</span>
      {node.isBottleneck && <BottleneckBadge />}
    </div>
  );
}

// --- Main Component ---

export function TraceWaterfall({ spans, loading, error }: TraceWaterfallProps) {
  const tree = useMemo(() => buildSpanTree(spans), [spans]);

  // Default: all nodes expanded
  const allIds = useMemo(() => getAllSpanIds(tree), [tree]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Initialize expanded state when tree changes
  useMemo(() => {
    setExpandedIds(allIds);
  }, [allIds]);

  const flatNodes = useMemo(
    () => flattenTree(tree, expandedIds),
    [tree, expandedIds]
  );

  const traceDurationMs = tree.length > 0 ? tree[0].span.duration_ms : 0;
  const traceStartTime = tree.length > 0 ? tree[0].span.start_time : "";

  function handleToggle(spanId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  }

  if (loading) {
    return <WaterfallSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-32 items-center justify-center p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (spans.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">
          No spans found for this trace.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Timing header with markers */}
      <TimingHeader traceDurationMs={traceDurationMs} />

      {/* Span rows */}
      <div className="overflow-auto">
        <AnimatePresence initial={false}>
          {flatNodes.map((node) => {
            const isExpanded = expandedIds.has(node.span.span_id);
            const hasChildren = node.children.length > 0;

            return (
              <motion.div
                key={node.span.span_id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
              >
                <SpanRow
                  node={node}
                  isExpanded={isExpanded}
                  onToggle={handleToggle}
                />

                {/* Collapsed summary when has children but not expanded */}
                {hasChildren && !isExpanded && (
                  <CollapsedSummary node={node} />
                )}

                {/* Log events when expanded */}
                {isExpanded && node.logEvents.length > 0 && (
                  <LogEvents events={node.logEvents} depth={node.depth} />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Trace summary footer */}
      <div className="border-t bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="font-mono">{spans.length} span{spans.length !== 1 ? "s" : ""}</span>
        <span className="mx-2">|</span>
        <span className="font-mono">Total: {formatDuration(traceDurationMs)}</span>
      </div>
    </div>
  );
}
