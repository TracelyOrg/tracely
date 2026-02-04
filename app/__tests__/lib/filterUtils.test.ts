import { matchesFilters, getStatusCodeGroup } from "@/lib/filterUtils";
import type { SpanEvent, StreamFilters } from "@/types/span";
import { DEFAULT_FILTERS } from "@/types/span";

function makeSpan(overrides: Partial<SpanEvent> = {}): SpanEvent {
  return {
    trace_id: "trace-1",
    span_id: "span-1",
    parent_span_id: "",
    span_name: "GET /api/users",
    span_type: "span",
    service_name: "api",
    kind: "SERVER",
    start_time: "2026-02-03T10:00:00Z",
    duration_ms: 42,
    status_code: "OK",
    http_method: "GET",
    http_route: "/api/users",
    http_status_code: 200,
    environment: "",
    ...overrides,
  };
}

const noFilters: StreamFilters = { ...DEFAULT_FILTERS, statusGroups: [] };

describe("getStatusCodeGroup", () => {
  it("returns 2xx for 200-299", () => {
    expect(getStatusCodeGroup(200)).toBe("2xx");
    expect(getStatusCodeGroup(201)).toBe("2xx");
    expect(getStatusCodeGroup(299)).toBe("2xx");
  });

  it("returns 3xx for 300-399", () => {
    expect(getStatusCodeGroup(301)).toBe("3xx");
    expect(getStatusCodeGroup(304)).toBe("3xx");
  });

  it("returns 4xx for 400-499", () => {
    expect(getStatusCodeGroup(400)).toBe("4xx");
    expect(getStatusCodeGroup(404)).toBe("4xx");
    expect(getStatusCodeGroup(422)).toBe("4xx");
  });

  it("returns 5xx for 500-599", () => {
    expect(getStatusCodeGroup(500)).toBe("5xx");
    expect(getStatusCodeGroup(503)).toBe("5xx");
  });

  it("returns null for codes outside 200-599", () => {
    expect(getStatusCodeGroup(0)).toBeNull();
    expect(getStatusCodeGroup(100)).toBeNull();
    expect(getStatusCodeGroup(199)).toBeNull();
    expect(getStatusCodeGroup(600)).toBeNull();
  });
});

describe("matchesFilters", () => {
  it("returns true when no filters are active", () => {
    expect(matchesFilters(makeSpan(), noFilters)).toBe(true);
  });

  // --- Service filter ---

  it("filters by service name (match)", () => {
    const filters: StreamFilters = { ...noFilters, service: "api" };
    expect(matchesFilters(makeSpan({ service_name: "api" }), filters)).toBe(true);
  });

  it("filters by service name (no match)", () => {
    const filters: StreamFilters = { ...noFilters, service: "web" };
    expect(matchesFilters(makeSpan({ service_name: "api" }), filters)).toBe(false);
  });

  it("null service matches all services", () => {
    const filters: StreamFilters = { ...noFilters, service: null };
    expect(matchesFilters(makeSpan({ service_name: "anything" }), filters)).toBe(true);
  });

  // --- Status code group filter ---

  it("filters by single status group (match)", () => {
    const filters: StreamFilters = { ...noFilters, statusGroups: ["2xx"] };
    expect(matchesFilters(makeSpan({ http_status_code: 200 }), filters)).toBe(true);
  });

  it("filters by single status group (no match)", () => {
    const filters: StreamFilters = { ...noFilters, statusGroups: ["5xx"] };
    expect(matchesFilters(makeSpan({ http_status_code: 200 }), filters)).toBe(false);
  });

  it("filters by multiple status groups", () => {
    const filters: StreamFilters = { ...noFilters, statusGroups: ["4xx", "5xx"] };
    expect(matchesFilters(makeSpan({ http_status_code: 404 }), filters)).toBe(true);
    expect(matchesFilters(makeSpan({ http_status_code: 500 }), filters)).toBe(true);
    expect(matchesFilters(makeSpan({ http_status_code: 200 }), filters)).toBe(false);
  });

  it("empty statusGroups matches all status codes", () => {
    const filters: StreamFilters = { ...noFilters, statusGroups: [] };
    expect(matchesFilters(makeSpan({ http_status_code: 500 }), filters)).toBe(true);
  });

  it("excludes spans with status code 0 (e.g. pending) when status filter active", () => {
    const filters: StreamFilters = { ...noFilters, statusGroups: ["2xx"] };
    expect(matchesFilters(makeSpan({ http_status_code: 0 }), filters)).toBe(false);
  });

  // --- Endpoint search filter ---

  it("filters by endpoint path (case-insensitive match)", () => {
    const filters: StreamFilters = { ...noFilters, endpointSearch: "/api/users" };
    expect(matchesFilters(makeSpan({ http_route: "/api/users/123" }), filters)).toBe(true);
  });

  it("filters by endpoint path (no match)", () => {
    const filters: StreamFilters = { ...noFilters, endpointSearch: "/health" };
    expect(matchesFilters(makeSpan({ http_route: "/api/users" }), filters)).toBe(false);
  });

  it("endpoint search is case-insensitive", () => {
    const filters: StreamFilters = { ...noFilters, endpointSearch: "/API/USERS" };
    expect(matchesFilters(makeSpan({ http_route: "/api/users" }), filters)).toBe(true);
  });

  it("falls back to span_name when http_route is empty", () => {
    const filters: StreamFilters = { ...noFilters, endpointSearch: "GET" };
    expect(matchesFilters(makeSpan({ http_route: "", span_name: "GET /users" }), filters)).toBe(true);
  });

  it("empty endpointSearch matches everything", () => {
    const filters: StreamFilters = { ...noFilters, endpointSearch: "" };
    expect(matchesFilters(makeSpan(), filters)).toBe(true);
  });

  // --- Combined filters ---

  it("combines service and status group filters", () => {
    const filters: StreamFilters = { ...noFilters, service: "api", statusGroups: ["5xx"] };
    // Right service, wrong status
    expect(matchesFilters(makeSpan({ service_name: "api", http_status_code: 200 }), filters)).toBe(false);
    // Wrong service, right status
    expect(matchesFilters(makeSpan({ service_name: "web", http_status_code: 500 }), filters)).toBe(false);
    // Both match
    expect(matchesFilters(makeSpan({ service_name: "api", http_status_code: 500 }), filters)).toBe(true);
  });

  it("combines all three filters", () => {
    const filters: StreamFilters = {
      service: "api",
      statusGroups: ["2xx"],
      endpointSearch: "/users",
      timeRange: { preset: "15m" },
      environment: null,
    };
    const match = makeSpan({
      service_name: "api",
      http_status_code: 200,
      http_route: "/api/users/list",
    });
    expect(matchesFilters(match, filters)).toBe(true);

    const noMatch = makeSpan({
      service_name: "api",
      http_status_code: 200,
      http_route: "/api/health",
    });
    expect(matchesFilters(noMatch, filters)).toBe(false);
  });
});
