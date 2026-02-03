import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreamRow } from "@/components/pulse/StreamRow";
import type { SpanEvent } from "@/types/span";

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
    duration_ms: 42.5,
    status_code: "OK",
    http_method: "GET",
    http_route: "/api/users",
    http_status_code: 200,
    ...overrides,
  };
}

describe("StreamRow", () => {
  it("renders HTTP method badge", () => {
    render(<StreamRow span={makeSpan()} />);
    expect(screen.getByText("GET")).toBeInTheDocument();
  });

  it("renders URL path", () => {
    render(<StreamRow span={makeSpan({ http_route: "/api/projects" })} />);
    expect(screen.getByText("/api/projects")).toBeInTheDocument();
  });

  it("renders status code", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 200 })} />);
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("renders response time in ms", () => {
    render(<StreamRow span={makeSpan({ duration_ms: 42.5 })} />);
    expect(screen.getByText("43ms")).toBeInTheDocument();
  });

  it("applies emerald color class for 2xx status", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 200 })} />);
    const statusEl = screen.getByText("200");
    // Color class is on the parent container element
    expect(statusEl.parentElement?.className).toMatch(/emerald/);
  });

  it("applies amber color class for 4xx status", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 404 })} />);
    const statusEl = screen.getByText("404");
    expect(statusEl.parentElement?.className).toMatch(/amber/);
  });

  it("applies red color class for 5xx status", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 500 })} />);
    const statusEl = screen.getByText("500");
    expect(statusEl.parentElement?.className).toMatch(/red/);
  });

  it("renders pending span with pulsing indicator", () => {
    render(
      <StreamRow
        span={makeSpan({
          span_type: "pending_span",
          duration_ms: 0,
          http_status_code: 0,
          status_code: "UNSET",
        })}
      />
    );
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    // The pulsing dot should have animate-pulse class
    const pulsingEl = document.querySelector(".animate-pulse");
    expect(pulsingEl).toBeInTheDocument();
  });

  it("renders span name when no http_route", () => {
    render(
      <StreamRow
        span={makeSpan({ http_route: "", span_name: "db.query" })}
      />
    );
    expect(screen.getByText("db.query")).toBeInTheDocument();
  });
});
