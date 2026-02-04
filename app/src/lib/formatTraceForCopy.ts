import type { SpanDetail, SpanEvent } from "@/types/span";

/**
 * Format JSON for display (pretty-print if valid JSON, otherwise return raw).
 */
function formatJson(raw: string): string {
  if (!raw || !raw.trim()) return "(empty)";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/**
 * Build a simple text-based span tree from flat span list.
 */
function buildSpanTreeText(spans: SpanEvent[]): string {
  if (spans.length === 0) return "(no spans)";

  // Build parent→children map
  const childrenMap = new Map<string, SpanEvent[]>();
  let root: SpanEvent | undefined;

  for (const span of spans) {
    if (!span.parent_span_id) {
      root = span;
    } else {
      const siblings = childrenMap.get(span.parent_span_id) ?? [];
      siblings.push(span);
      childrenMap.set(span.parent_span_id, siblings);
    }
  }

  if (!root) {
    // No root found — just list spans flat
    return spans
      .map((s) => `  ${s.span_name || s.http_route || s.span_id} (${s.duration_ms.toFixed(1)}ms)`)
      .join("\n");
  }

  const lines: string[] = [];

  function walk(span: SpanEvent, depth: number) {
    const indent = "  ".repeat(depth);
    const label = span.span_name || span.http_route || span.span_id;
    const method = span.http_method ? `${span.http_method} ` : "";
    const status = span.http_status_code ? ` → ${span.http_status_code}` : "";
    lines.push(`${indent}${method}${label}${status} (${span.duration_ms.toFixed(1)}ms)`);

    const children = childrenMap.get(span.span_id) ?? [];
    for (const child of children) {
      walk(child, depth + 1);
    }
  }

  walk(root, 0);
  return lines.join("\n");
}

/**
 * Format headers as key: value lines.
 */
function formatHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers);
  if (entries.length === 0) return "(none)";
  return entries.map(([k, v]) => `  ${k}: ${v}`).join("\n");
}

/**
 * Format trace details as human-readable text for clipboard copy (UX18).
 *
 * Includes: trace ID, span summary, request/response data.
 */
export function formatTraceForCopy(detail: SpanDetail, traceSpans?: SpanEvent[]): string {
  const sections: string[] = [];

  // Header
  sections.push(`=== Trace Details ===`);
  sections.push(`Trace ID: ${detail.trace_id}`);
  sections.push(`Span ID: ${detail.span_id}`);
  sections.push(`Service: ${detail.service_name}`);
  sections.push(`${detail.http_method} ${detail.http_route} → ${detail.http_status_code} (${detail.duration_ms.toFixed(1)}ms)`);
  sections.push(`Time: ${detail.start_time}`);

  // Span tree (if trace spans provided)
  if (traceSpans && traceSpans.length > 0) {
    sections.push("");
    sections.push("--- Span Tree ---");
    sections.push(buildSpanTreeText(traceSpans));
  }

  // Request
  sections.push("");
  sections.push("--- Request ---");
  sections.push(`Headers:\n${formatHeaders(detail.request_headers)}`);
  sections.push(`Body:\n${formatJson(detail.request_body)}`);

  // Response
  sections.push("");
  sections.push("--- Response ---");
  sections.push(`Headers:\n${formatHeaders(detail.response_headers)}`);
  sections.push(`Body:\n${formatJson(detail.response_body)}`);

  return sections.join("\n");
}
