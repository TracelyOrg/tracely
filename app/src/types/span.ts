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
}
