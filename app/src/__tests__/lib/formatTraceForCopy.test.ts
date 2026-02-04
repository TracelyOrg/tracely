import { formatTraceForCopy } from "@/lib/formatTraceForCopy";
import type { SpanDetail } from "@/types/span";

const MOCK_DETAIL: SpanDetail = {
  trace_id: "abc123def456",
  span_id: "span001",
  parent_span_id: "",
  span_name: "GET /api/users",
  span_type: "span",
  service_name: "api-server",
  kind: "SERVER",
  start_time: "2026-02-04T10:30:00.000Z",
  duration_ms: 42.5,
  status_code: "OK",
  http_method: "GET",
  http_route: "/api/users",
  http_status_code: 200,
  framework: "fastapi",
  environment: "production",
  end_time: "2026-02-04T10:30:00.042Z",
  status_message: "",
  request_body: '{"page": 1}',
  response_body: '{"users": [{"id": 1, "name": "Alice"}]}',
  request_headers: { "content-type": "application/json", authorization: "[REDACTED]" },
  response_headers: { "content-type": "application/json" },
  attributes: {},
};

describe("formatTraceForCopy", () => {
  it("includes the trace ID", () => {
    const result = formatTraceForCopy(MOCK_DETAIL);
    expect(result).toContain("abc123def456");
  });

  it("includes the HTTP method and route", () => {
    const result = formatTraceForCopy(MOCK_DETAIL);
    expect(result).toContain("GET /api/users");
  });

  it("includes the status code", () => {
    const result = formatTraceForCopy(MOCK_DETAIL);
    expect(result).toContain("200");
  });

  it("includes the duration", () => {
    const result = formatTraceForCopy(MOCK_DETAIL);
    expect(result).toContain("42.5ms");
  });

  it("includes the service name", () => {
    const result = formatTraceForCopy(MOCK_DETAIL);
    expect(result).toContain("api-server");
  });

  it("includes the request body", () => {
    const result = formatTraceForCopy(MOCK_DETAIL);
    expect(result).toContain('"page": 1');
  });

  it("includes the response body", () => {
    const result = formatTraceForCopy(MOCK_DETAIL);
    expect(result).toContain('"users"');
  });

  it("includes request headers", () => {
    const result = formatTraceForCopy(MOCK_DETAIL);
    expect(result).toContain("content-type");
  });

  it("handles empty request body gracefully", () => {
    const detail = { ...MOCK_DETAIL, request_body: "" };
    const result = formatTraceForCopy(detail);
    expect(result).toContain("Trace ID:");
    // Should not throw
  });

  it("handles empty response body gracefully", () => {
    const detail = { ...MOCK_DETAIL, response_body: "" };
    const result = formatTraceForCopy(detail);
    expect(result).toContain("Trace ID:");
  });

  it("produces readable formatted text", () => {
    const result = formatTraceForCopy(MOCK_DETAIL);
    // Should be multi-line formatted text
    expect(result.split("\n").length).toBeGreaterThan(5);
  });

  it("includes span tree summary with trace spans", () => {
    const traceSpans = [
      {
        trace_id: "abc123def456",
        span_id: "span001",
        parent_span_id: "",
        span_name: "GET /api/users",
        span_type: "span" as const,
        service_name: "api-server",
        kind: "SERVER",
        start_time: "2026-02-04T10:30:00.000Z",
        duration_ms: 42.5,
        status_code: "OK",
        http_method: "GET",
        http_route: "/api/users",
        http_status_code: 200,
      },
      {
        trace_id: "abc123def456",
        span_id: "span002",
        parent_span_id: "span001",
        span_name: "SELECT users",
        span_type: "span" as const,
        service_name: "api-server",
        kind: "CLIENT",
        start_time: "2026-02-04T10:30:00.010Z",
        duration_ms: 15.2,
        status_code: "OK",
        http_method: "",
        http_route: "",
        http_status_code: 0,
      },
    ];
    const result = formatTraceForCopy(MOCK_DETAIL, traceSpans);
    expect(result).toContain("Span Tree");
    expect(result).toContain("SELECT users");
  });
});
