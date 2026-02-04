import type { SpanEvent, SpanLogEvent, SpanTreeNode, TraceSpanEvent } from "@/types/span";

/**
 * Build a hierarchical span tree from a flat list of spans.
 *
 * The root span is the one with no parent_span_id (or parent not in the list).
 * Children are sorted by start_time ASC.
 * Waterfall metrics (offset, percentage, bottleneck) are computed relative
 * to the trace root's start_time and total duration.
 */
export function buildSpanTree(spans: SpanEvent[]): SpanTreeNode[] {
  if (spans.length === 0) return [];

  // Find trace start time and total duration for waterfall calculations
  const traceStartMs = Math.min(
    ...spans.map((s) => new Date(s.start_time).getTime())
  );

  // Root span determines the total trace duration
  const rootSpan = spans.find((s) => !s.parent_span_id || !spans.some((p) => p.span_id === s.parent_span_id));
  const traceDurationMs = rootSpan ? rootSpan.duration_ms : Math.max(
    ...spans.map((s) => new Date(s.start_time).getTime() - traceStartMs + s.duration_ms)
  );

  // Find the slowest span
  let maxDuration = 0;
  let slowestSpanId = "";
  for (const s of spans) {
    if (s.duration_ms > maxDuration) {
      maxDuration = s.duration_ms;
      slowestSpanId = s.span_id;
    }
  }

  // Index spans by parent_span_id for fast child lookup
  const childrenMap = new Map<string, SpanEvent[]>();
  const spanIds = new Set(spans.map((s) => s.span_id));

  for (const span of spans) {
    const parentId = span.parent_span_id;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(span);
  }

  // Sort children by start_time
  for (const children of childrenMap.values()) {
    children.sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }

  function buildNode(span: SpanEvent, depth: number): SpanTreeNode {
    const spanStartMs = new Date(span.start_time).getTime();
    const offsetMs = spanStartMs - traceStartMs;
    const offsetPercent = traceDurationMs > 0 ? (offsetMs / traceDurationMs) * 100 : 0;
    const percentOfTrace = traceDurationMs > 0 ? (span.duration_ms / traceDurationMs) * 100 : 0;

    const childSpans = childrenMap.get(span.span_id) || [];
    const children = childSpans.map((c) => buildNode(c, depth + 1));

    const childrenDurationMs = children.reduce(
      (sum, c) => sum + c.span.duration_ms + c.childrenDurationMs,
      0
    );

    const logEvents = parseLogEvents(span);

    return {
      span,
      children,
      depth,
      offsetMs,
      percentOfTrace,
      offsetPercent,
      childrenDurationMs,
      isSlowest: span.span_id === slowestSpanId,
      isBottleneck: traceDurationMs > 0 && span.duration_ms > traceDurationMs * 0.5,
      logEvents,
    };
  }

  // Find root spans (no parent or parent not in the set)
  const roots = spans.filter(
    (s) => !s.parent_span_id || !spanIds.has(s.parent_span_id)
  );

  return roots.map((r) => buildNode(r, 0));
}

/**
 * Parse log events from span attributes.
 * Events are stored as JSON in the "span.events" attribute (set by OTLP ingestion).
 * Only available when the span carries attributes (TraceSpanEvent).
 */
function parseLogEvents(span: SpanEvent): SpanLogEvent[] {
  const attrs = (span as TraceSpanEvent).attributes;
  if (!attrs || typeof attrs !== "object") return [];

  const eventsJson = attrs["span.events"];
  if (!eventsJson) return [];

  try {
    const parsed: unknown = JSON.parse(eventsJson);
    if (!Array.isArray(parsed)) return [];

    const validLevels = new Set(["info", "warn", "error", "debug"]);

    return parsed.map((e: Record<string, unknown>) => ({
      timestamp: String(e.timestamp ?? ""),
      name: String(e.name ?? ""),
      level: (validLevels.has(String(e.level)) ? String(e.level) : "info") as SpanLogEvent["level"],
      message: String(e.message ?? e.name ?? ""),
    }));
  } catch {
    return [];
  }
}

/**
 * Flatten a span tree into a list for rendering, respecting expanded state.
 * Returns nodes in display order with their depth for indentation.
 */
export function flattenTree(
  roots: SpanTreeNode[],
  expandedIds: Set<string>
): SpanTreeNode[] {
  const result: SpanTreeNode[] = [];

  function walk(node: SpanTreeNode) {
    result.push(node);
    if (node.children.length > 0 && expandedIds.has(node.span.span_id)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const root of roots) {
    walk(root);
  }

  return result;
}

/**
 * Get all span IDs in the tree (for expanding all by default).
 */
export function getAllSpanIds(roots: SpanTreeNode[]): Set<string> {
  const ids = new Set<string>();

  function walk(node: SpanTreeNode) {
    ids.add(node.span.span_id);
    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of roots) {
    walk(root);
  }

  return ids;
}
