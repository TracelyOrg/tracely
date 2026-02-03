import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SpanInspector } from "@/components/pulse/SpanInspector";
import type { SpanDetail } from "@/types/span";

function makeDetail(overrides: Partial<SpanDetail> = {}): SpanDetail {
  return {
    trace_id: "trace-abc123",
    span_id: "span-def456",
    parent_span_id: "",
    span_name: "GET /api/users",
    span_type: "span",
    service_name: "api",
    framework: "fastapi",
    environment: "production",
    kind: "SERVER",
    start_time: "2026-02-03T10:00:00Z",
    end_time: "2026-02-03T10:00:00.042Z",
    duration_ms: 42,
    status_code: "OK",
    status_message: "",
    http_method: "GET",
    http_route: "/api/users",
    http_status_code: 200,
    request_body: '{"query": "test"}',
    response_body: '{"users": []}',
    request_headers: { "Content-Type": "application/json" },
    response_headers: { "X-Request-Id": "abc123" },
    attributes: {},
    ...overrides,
  };
}

describe("SpanInspector", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it("renders span header with method, name, and metadata (AC2)", () => {
    render(
      <SpanInspector
        detail={makeDetail()}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    const getTexts = screen.getAllByText("GET");
    expect(getTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("GET /api/users")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("42.0ms")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading", () => {
    render(
      <SpanInspector
        detail={null}
        loading={true}
        error={null}
        onClose={mockOnClose}
      />
    );

    const pulsingElements = document.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("shows error message when error occurs", () => {
    render(
      <SpanInspector
        detail={null}
        loading={false}
        error="Span not found"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Span not found")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked (AC5)", () => {
    render(
      <SpanInspector
        detail={makeDetail()}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByLabelText("Close inspector"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("shows three tabs: Request, Response, Exceptions", () => {
    render(
      <SpanInspector
        detail={makeDetail()}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Request")).toBeInTheDocument();
    expect(screen.getByText("Response")).toBeInTheDocument();
    expect(screen.getByText("Exceptions")).toBeInTheDocument();
  });

  it("shows request tab content by default for successful spans (AC2)", () => {
    render(
      <SpanInspector
        detail={makeDetail()}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    // Request tab should show headers
    expect(screen.getByText("Request Headers")).toBeInTheDocument();
    expect(screen.getByText("Content-Type")).toBeInTheDocument();
    expect(screen.getByText("application/json")).toBeInTheDocument();
  });

  it("switches to response tab on click (AC3)", () => {
    render(
      <SpanInspector
        detail={makeDetail()}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText("Response"));

    expect(screen.getByText("Response Headers")).toBeInTheDocument();
    expect(screen.getByText("X-Request-Id")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("shows timing breakdown in response tab (AC3)", () => {
    render(
      <SpanInspector
        detail={makeDetail()}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText("Response"));

    expect(screen.getByText("Timing")).toBeInTheDocument();
    expect(screen.getByText("Total duration")).toBeInTheDocument();
  });

  it("auto-selects Exceptions tab for error spans (AC4, UX19)", () => {
    render(
      <SpanInspector
        detail={makeDetail({
          status_code: "ERROR",
          http_status_code: 500,
          status_message: "Internal Server Error",
        })}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    // Exceptions tab content should be visible (auto-selected)
    expect(screen.getByText("HTTP 500 Server Error")).toBeInTheDocument();
    expect(screen.getByText("Internal Server Error")).toBeInTheDocument();
  });

  it("shows [REDACTED] with icon for redacted header values (AC2)", () => {
    render(
      <SpanInspector
        detail={makeDetail({
          request_headers: { Authorization: "[REDACTED]", "Content-Type": "application/json" },
        })}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    // The [REDACTED] value should be rendered with special styling
    expect(screen.getByText("Authorization")).toBeInTheDocument();
    const redactedElements = screen.getAllByText("[REDACTED]");
    expect(redactedElements.length).toBeGreaterThan(0);
  });

  it("shows exception details from attributes when present (AC4)", () => {
    render(
      <SpanInspector
        detail={makeDetail({
          status_code: "ERROR",
          http_status_code: 500,
          attributes: {
            "exception.type": "ValueError",
            "exception.message": "Invalid input",
            "exception.stacktrace": "Traceback (most recent call last):\n  File ...",
          },
        })}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("ValueError")).toBeInTheDocument();
    expect(screen.getByText("Invalid input")).toBeInTheDocument();
    expect(screen.getByText(/Traceback/)).toBeInTheDocument();
  });

  it("shows 'No exceptions' message for successful spans", () => {
    render(
      <SpanInspector
        detail={makeDetail()}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText("Exceptions"));
    expect(screen.getByText("No exceptions recorded for this span.")).toBeInTheDocument();
  });

  it("displays trace_id and span_id in header metadata", () => {
    render(
      <SpanInspector
        detail={makeDetail()}
        loading={false}
        error={null}
        onClose={mockOnClose}
      />
    );

    // Truncated IDs shown (last 8 chars via .slice(-8))
    expect(screen.getByText("trace: e-abc123")).toBeInTheDocument();
    expect(screen.getByText("span: n-def456")).toBeInTheDocument();
  });
});
