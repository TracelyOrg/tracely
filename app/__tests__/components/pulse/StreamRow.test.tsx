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
    environment: "",
    ...overrides,
  };
}

describe("StreamRow", () => {
  it("renders method + path as combined monospace string", () => {
    render(<StreamRow span={makeSpan()} />);
    expect(screen.getByText("GET /api/users")).toBeInTheDocument();
  });

  it("renders service name label", () => {
    render(<StreamRow span={makeSpan({ service_name: "my-api" })} />);
    expect(screen.getByText("my-api")).toBeInTheDocument();
  });

  it("shows 'default' when no service name", () => {
    render(<StreamRow span={makeSpan({ service_name: "" })} />);
    expect(screen.getByText("default")).toBeInTheDocument();
  });

  it("renders status code", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 200 })} />);
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("renders response time in ms", () => {
    render(<StreamRow span={makeSpan({ duration_ms: 42.5 })} />);
    expect(screen.getByText("43ms")).toBeInTheDocument();
  });

  it("renders timestamp", () => {
    render(<StreamRow span={makeSpan({ start_time: "2026-02-03T10:00:00Z" })} />);
    // Timestamp displays in HH:mm:ss format — the exact output depends on locale but
    // we verify the element exists by checking for a time-like pattern
    const row = screen.getByRole("row");
    expect(row.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("applies emerald color class for 2xx status", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 200 })} />);
    const statusEl = screen.getByText("200");
    expect(statusEl.parentElement?.className).toMatch(/emerald/);
  });

  it("applies red color class for 4xx status (not amber)", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 404 })} />);
    const statusEl = screen.getByText("404");
    expect(statusEl.parentElement?.className).toMatch(/red/);
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
    const pulsingEl = document.querySelector(".animate-pulse");
    expect(pulsingEl).toBeInTheDocument();
  });

  it("renders span name when no http_route", () => {
    render(
      <StreamRow
        span={makeSpan({ http_route: "", span_name: "db.query", http_method: "GET" })}
      />
    );
    expect(screen.getByText("GET db.query")).toBeInTheDocument();
  });

  it("shows child count badge when childCount > 0", () => {
    render(<StreamRow span={makeSpan()} childCount={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show badge when childCount is 0", () => {
    render(<StreamRow span={makeSpan()} childCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows red badge when hasErrorChildren is true", () => {
    render(<StreamRow span={makeSpan()} childCount={2} hasErrorChildren />);
    const badge = screen.getByText("2");
    expect(badge.className).toMatch(/bg-red-500/);
    expect(badge.className).toMatch(/text-white/);
  });

  it("shows chevron when childCount > 0", () => {
    render(<StreamRow span={makeSpan()} childCount={1} />);
    const chevronButton = screen.getByLabelText("Expand children");
    expect(chevronButton).toBeInTheDocument();
  });
});
