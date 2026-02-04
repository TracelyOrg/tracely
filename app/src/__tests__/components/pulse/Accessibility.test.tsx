/**
 * Tests for ARIA accessibility enhancements (AC6, UX11).
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreamRow } from "@/components/pulse/StreamRow";
import type { SpanEvent } from "@/types/span";

const makeSpan = (overrides: Partial<SpanEvent> = {}): SpanEvent => ({
  trace_id: "trace-1",
  span_id: "span-1",
  parent_span_id: "",
  span_name: "GET /api/users",
  span_type: "span",
  service_name: "api",
  kind: "SERVER",
  start_time: "2026-02-04T10:00:00Z",
  duration_ms: 42,
  status_code: "OK",
  http_method: "GET",
  http_route: "/api/users",
  http_status_code: 200,
  environment: "",
  ...overrides,
});

describe("StreamRow ARIA accessibility (AC6, UX11)", () => {
  it("has aria-label on successful status icon", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 200 })} />);
    const icon = screen.getByLabelText("Status: healthy");
    expect(icon).toBeInTheDocument();
  });

  it("has aria-label on error status icon for 4xx", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 404 })} />);
    const icon = screen.getByLabelText("Status: error");
    expect(icon).toBeInTheDocument();
  });

  it("has aria-label on error status icon", () => {
    render(<StreamRow span={makeSpan({ http_status_code: 500 })} />);
    const icon = screen.getByLabelText("Status: error");
    expect(icon).toBeInTheDocument();
  });

  it("has a descriptive aria-label on the row element", () => {
    render(<StreamRow span={makeSpan()} />);
    const row = screen.getByRole("row");
    expect(row).toHaveAttribute("aria-label");
    const label = row.getAttribute("aria-label");
    expect(label).toContain("GET");
    expect(label).toContain("/api/users");
    expect(label).toContain("200");
    expect(label).toContain("42");
  });

  it("pending span row has appropriate aria-label", () => {
    render(
      <StreamRow
        span={makeSpan({ span_type: "pending_span", http_status_code: 0, duration_ms: 0 })}
      />
    );
    const row = screen.getByRole("row");
    const label = row.getAttribute("aria-label");
    expect(label).toContain("in progress");
  });

  it("row has aria-selected when selected", () => {
    render(<StreamRow span={makeSpan()} isSelected />);
    const row = screen.getByRole("row");
    expect(row).toHaveAttribute("aria-selected", "true");
  });

  it("row has aria-selected false when not selected", () => {
    render(<StreamRow span={makeSpan()} />);
    const row = screen.getByRole("row");
    expect(row).toHaveAttribute("aria-selected", "false");
  });
});
