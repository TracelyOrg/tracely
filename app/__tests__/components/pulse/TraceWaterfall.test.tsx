import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TraceWaterfall } from "@/components/pulse/TraceWaterfall";
import type { TraceSpanEvent } from "@/types/span";
import type { PropsWithChildren, HTMLAttributes } from "react";

// Mock framer-motion to avoid animation async issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
}));

function makeSpan(overrides: Partial<TraceSpanEvent> = {}): TraceSpanEvent {
  return {
    trace_id: "trace-1",
    span_id: "root",
    parent_span_id: "",
    span_name: "GET /api/users",
    span_type: "span",
    service_name: "api",
    kind: "SERVER",
    start_time: "2026-02-03T10:00:00.000Z",
    duration_ms: 100,
    status_code: "OK",
    http_method: "GET",
    http_route: "/api/users",
    http_status_code: 200,
    attributes: {},
    ...overrides,
  };
}

describe("TraceWaterfall", () => {
  it("shows loading skeleton when loading", () => {
    render(<TraceWaterfall spans={[]} loading={true} error={null} />);
    const pulsingElements = document.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("shows error message when error occurs", () => {
    render(
      <TraceWaterfall spans={[]} loading={false} error="Failed to load" />
    );
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("shows empty state when no spans", () => {
    render(<TraceWaterfall spans={[]} loading={false} error={null} />);
    expect(
      screen.getByText("No spans found for this trace.")
    ).toBeInTheDocument();
  });

  it("renders span names in the tree (AC1)", () => {
    const spans = [
      makeSpan({ span_id: "root", span_name: "GET /api/users" }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        span_name: "SELECT users",
        kind: "CLIENT",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 40,
      }),
    ];
    render(<TraceWaterfall spans={spans} loading={false} error={null} />);

    expect(screen.getByText("GET /api/users")).toBeInTheDocument();
    expect(screen.getByText("SELECT users")).toBeInTheDocument();
  });

  it("renders timing header with markers (AC1)", () => {
    const spans = [makeSpan({ duration_ms: 100 })];
    render(<TraceWaterfall spans={spans} loading={false} error={null} />);

    // Header should show "Span" label
    expect(screen.getByText("Span")).toBeInTheDocument();
  });

  it("renders trace summary footer with span count", () => {
    const spans = [
      makeSpan({ span_id: "root" }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 40,
      }),
    ];
    render(<TraceWaterfall spans={spans} loading={false} error={null} />);

    expect(screen.getByText("2 spans")).toBeInTheDocument();
  });

  it("shows collapsed summary when a node is collapsed (AC2)", () => {
    const spans = [
      makeSpan({ span_id: "root", duration_ms: 100 }),
      makeSpan({
        span_id: "child-1",
        parent_span_id: "root",
        span_name: "DB query",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 40,
      }),
    ];
    render(<TraceWaterfall spans={spans} loading={false} error={null} />);

    // Initially expanded, child should be visible
    expect(screen.getByText("DB query")).toBeInTheDocument();

    // Collapse root
    const collapseBtn = screen.getByLabelText("Collapse");
    fireEvent.click(collapseBtn);

    // Child should no longer be visible, collapsed summary should appear
    expect(screen.queryByText("DB query")).not.toBeInTheDocument();
    expect(screen.getByText(/1 child span/)).toBeInTheDocument();
  });

  it("re-expands when toggle is clicked again (AC2)", () => {
    const spans = [
      makeSpan({ span_id: "root", duration_ms: 100 }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        span_name: "DB query",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 40,
      }),
    ];
    render(<TraceWaterfall spans={spans} loading={false} error={null} />);

    // Collapse
    fireEvent.click(screen.getByLabelText("Collapse"));
    expect(screen.queryByText("DB query")).not.toBeInTheDocument();

    // Re-expand
    fireEvent.click(screen.getByLabelText("Expand"));
    expect(screen.getByText("DB query")).toBeInTheDocument();
  });

  it("displays duration labels for each span (AC1, AC4)", () => {
    const spans = [
      makeSpan({ span_id: "root", duration_ms: 100 }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 42.5,
      }),
    ];
    render(<TraceWaterfall spans={spans} loading={false} error={null} />);

    // Duration appears in span rows (may also appear in footer/header)
    const durations100 = screen.getAllByText("100.0ms");
    expect(durations100.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("42.5ms")).toBeInTheDocument();
  });

  it("renders log events under an expanded span (AC3)", () => {
    const logEvents = [
      {
        timestamp: "2026-02-03T10:00:00.015Z",
        name: "log",
        level: "error",
        message: "Connection refused",
      },
      {
        timestamp: "2026-02-03T10:00:00.020Z",
        name: "log",
        level: "info",
        message: "Retrying request",
      },
    ];

    const spans = [
      makeSpan({
        span_id: "root",
        duration_ms: 100,
        attributes: {
          "span.events": JSON.stringify(logEvents),
        },
      }),
    ];
    render(<TraceWaterfall spans={spans} loading={false} error={null} />);

    // Log event messages should be rendered
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
    expect(screen.getByText("Retrying request")).toBeInTheDocument();

    // Level badges should be rendered
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("info")).toBeInTheDocument();
  });
});
