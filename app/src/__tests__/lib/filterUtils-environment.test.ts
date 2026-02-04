import { matchesFilters } from "@/lib/filterUtils";
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
    environment: "production",
    ...overrides,
  };
}

const noFilters: StreamFilters = { ...DEFAULT_FILTERS, statusGroups: [] };

describe("matchesFilters environment (Story 11.2)", () => {
  it("returns true when environment filter is null (all envs)", () => {
    const filters: StreamFilters = { ...noFilters, environment: null };
    expect(matchesFilters(makeSpan({ environment: "production" }), filters)).toBe(true);
    expect(matchesFilters(makeSpan({ environment: "staging" }), filters)).toBe(true);
    expect(matchesFilters(makeSpan({ environment: "" }), filters)).toBe(true);
  });

  it("filters by environment (match)", () => {
    const filters: StreamFilters = { ...noFilters, environment: "production" };
    expect(matchesFilters(makeSpan({ environment: "production" }), filters)).toBe(true);
  });

  it("filters by environment (no match)", () => {
    const filters: StreamFilters = { ...noFilters, environment: "staging" };
    expect(matchesFilters(makeSpan({ environment: "production" }), filters)).toBe(false);
  });

  it("filters by environment combined with other filters", () => {
    const filters: StreamFilters = {
      ...noFilters,
      environment: "production",
      service: "api",
    };
    // Both match
    expect(matchesFilters(makeSpan({ environment: "production", service_name: "api" }), filters)).toBe(true);
    // Wrong environment
    expect(matchesFilters(makeSpan({ environment: "staging", service_name: "api" }), filters)).toBe(false);
    // Wrong service
    expect(matchesFilters(makeSpan({ environment: "production", service_name: "web" }), filters)).toBe(false);
  });

  it("handles empty environment string on span", () => {
    const filters: StreamFilters = { ...noFilters, environment: "production" };
    expect(matchesFilters(makeSpan({ environment: "" }), filters)).toBe(false);
  });
});
