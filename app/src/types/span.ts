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
