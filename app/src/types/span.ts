// --- Filter types (Story 3.5) ---

export type StatusCodeGroup = "2xx" | "3xx" | "4xx" | "5xx";

export type TimeRangePreset = "15m" | "1h" | "6h" | "24h" | "custom";

export interface TimeRange {
  preset: TimeRangePreset;
  /** Only used when preset === "custom" */
  start?: string;
  end?: string;
}

export interface StreamFilters {
  service: string | null;
  statusGroups: StatusCodeGroup[];
  endpointSearch: string;
  timeRange: TimeRange;
  environment: string | null;
}

export const DEFAULT_FILTERS: StreamFilters = {
  service: null,
  statusGroups: [],
  endpointSearch: "",
  timeRange: { preset: "15m" },
  environment: null,
};

// --- Span types ---

export interface SpanEvent {
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  span_name: string;
  span_type: "span" | "pending_span";
  service_name: string;
  kind: string;
  start_time: string;
  duration_ms: number;
  status_code: string;
  http_method: string;
  http_route: string;
  http_status_code: number;
  environment: string;
}

/** Extended span data for the Trace Waterfall view (includes attributes). */
export interface TraceSpanEvent extends SpanEvent {
  attributes: Record<string, string>;
}

/** A log event attached to a span (from OTLP span events). */
export interface SpanLogEvent {
  timestamp: string;
  name: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

/** A node in the trace span tree with children and computed waterfall data. */
export interface SpanTreeNode {
  span: SpanEvent;
  children: SpanTreeNode[];
  depth: number;
  /** Offset from trace start in ms */
  offsetMs: number;
  /** Duration as percentage of total trace duration */
  percentOfTrace: number;
  /** Offset as percentage of total trace duration */
  offsetPercent: number;
  /** Total duration of all children (for collapsed summary) */
  childrenDurationMs: number;
  /** Whether this span is the slowest in the trace */
  isSlowest: boolean;
  /** Whether this span exceeds a slow threshold */
  isBottleneck: boolean;
  /** Parsed log events if available */
  logEvents: SpanLogEvent[];
}

/** Full span detail returned by GET /spans/{span_id}. */
export interface SpanDetail extends SpanEvent {
  framework: string;
  environment: string;
  end_time: string;
  status_message: string;
  request_body: string;
  response_body: string;
  request_headers: Record<string, string>;
  response_headers: Record<string, string>;
  attributes: Record<string, string>;
}
