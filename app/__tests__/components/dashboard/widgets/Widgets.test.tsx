import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RequestsWidget } from "@/components/dashboard/widgets/RequestsWidget";
import { ErrorRateWidget } from "@/components/dashboard/widgets/ErrorRateWidget";
import { LatencyWidget } from "@/components/dashboard/widgets/LatencyWidget";
import { ServiceStatusWidget } from "@/components/dashboard/widgets/ServiceStatusWidget";
import { WidgetSkeleton } from "@/components/dashboard/widgets/WidgetSkeleton";
import type { DataPoint, ServiceStatus } from "@/types/dashboard";

// Mock recharts to avoid rendering issues in tests
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

// Mock framer-motion to simplify animation testing
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div data-testid={props["data-testid"]} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeDataPoints(count: number): DataPoint[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(now.getTime() - (count - i) * 60000).toISOString(),
    value: 100 + i * 10,
  }));
}

function makeServiceStatus(overrides: Partial<ServiceStatus> = {}): ServiceStatus {
  return {
    name: "api-gateway",
    status: "healthy",
    request_rate: 120.5,
    error_rate: 0.5,
    p95_latency: 45.2,
    ...overrides,
  };
}

// ─── RequestsWidget Tests (Task 6.3) ─────────────────────────────────

describe("RequestsWidget", () => {
  it("renders with data-testid", () => {
    render(<RequestsWidget data={makeDataPoints(5)} />);
    expect(screen.getByTestId("requests-widget")).toBeInTheDocument();
  });

  it("displays current request rate from last data point", () => {
    const data = makeDataPoints(5);
    render(<RequestsWidget data={data} />);
    // Last data point value is 100 + 4*10 = 140 (values >= 100 are rounded to integers)
    expect(screen.getByText("140")).toBeInTheDocument();
  });

  it("renders sparkline chart", () => {
    render(<RequestsWidget data={makeDataPoints(5)} />);
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("displays label", () => {
    render(<RequestsWidget data={makeDataPoints(5)} />);
    expect(screen.getByText("Requests/min")).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<RequestsWidget data={[]} />);
    expect(screen.getByTestId("requests-widget")).toBeInTheDocument();
    expect(screen.getByText("0.0")).toBeInTheDocument();
  });
});

// ─── ErrorRateWidget Tests (Task 6.3, 6.4) ───────────────────────────

describe("ErrorRateWidget", () => {
  it("renders with data-testid", () => {
    render(<ErrorRateWidget errorRate={1.5} />);
    expect(screen.getByTestId("error-rate-widget")).toBeInTheDocument();
  });

  it("displays error rate percentage", () => {
    render(<ErrorRateWidget errorRate={2.5} />);
    expect(screen.getByText("2.50%")).toBeInTheDocument();
  });

  it("shows healthy status for low error rate", () => {
    render(<ErrorRateWidget errorRate={0.5} />);
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("shows warning status for medium error rate", () => {
    render(<ErrorRateWidget errorRate={2.5} />);
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("shows critical status for high error rate", () => {
    render(<ErrorRateWidget errorRate={6.0} />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("displays label", () => {
    render(<ErrorRateWidget errorRate={1.0} />);
    expect(screen.getByText("Error Rate")).toBeInTheDocument();
  });
});

// ─── LatencyWidget Tests (Task 6.3) ──────────────────────────────────

describe("LatencyWidget", () => {
  it("renders with data-testid", () => {
    render(<LatencyWidget p95Latency={250} />);
    expect(screen.getByTestId("latency-widget")).toBeInTheDocument();
  });

  it("displays latency in milliseconds", () => {
    render(<LatencyWidget p95Latency={250} />);
    expect(screen.getByText("250ms")).toBeInTheDocument();
  });

  it("displays latency in seconds for large values", () => {
    render(<LatencyWidget p95Latency={2500} />);
    expect(screen.getByText("2.50s")).toBeInTheDocument();
  });

  it("shows fast status for low latency", () => {
    render(<LatencyWidget p95Latency={200} />);
    expect(screen.getByText("Fast")).toBeInTheDocument();
  });

  it("shows moderate status for medium latency", () => {
    render(<LatencyWidget p95Latency={750} />);
    expect(screen.getByText("Moderate")).toBeInTheDocument();
  });

  it("shows slow status for high latency", () => {
    render(<LatencyWidget p95Latency={2500} />);
    expect(screen.getByText("Slow")).toBeInTheDocument();
  });

  it("displays label", () => {
    render(<LatencyWidget p95Latency={250} />);
    expect(screen.getByText("P95 Latency")).toBeInTheDocument();
  });
});

// ─── ServiceStatusWidget Tests (Task 6.3) ────────────────────────────

describe("ServiceStatusWidget", () => {
  it("renders with data-testid", () => {
    render(<ServiceStatusWidget services={[makeServiceStatus()]} />);
    expect(screen.getByTestId("service-status-widget")).toBeInTheDocument();
  });

  it("displays service name", () => {
    render(<ServiceStatusWidget services={[makeServiceStatus({ name: "user-service" })]} />);
    expect(screen.getByText("user-service")).toBeInTheDocument();
  });

  it("displays healthy count in header", () => {
    render(
      <ServiceStatusWidget
        services={[
          makeServiceStatus({ name: "service-1", status: "healthy" }),
          makeServiceStatus({ name: "service-2", status: "healthy" }),
        ]}
      />
    );
    expect(screen.getByText("2 healthy")).toBeInTheDocument();
  });

  it("displays degraded count in header", () => {
    render(
      <ServiceStatusWidget
        services={[makeServiceStatus({ name: "service-1", status: "degraded" })]}
      />
    );
    expect(screen.getByText("1 degraded")).toBeInTheDocument();
  });

  it("displays error count in header", () => {
    render(
      <ServiceStatusWidget
        services={[makeServiceStatus({ name: "service-1", status: "error" })]}
      />
    );
    expect(screen.getByText("1 error")).toBeInTheDocument();
  });

  it("displays request rate per service", () => {
    render(<ServiceStatusWidget services={[makeServiceStatus({ request_rate: 50.5 })]} />);
    expect(screen.getByText("50.5/min")).toBeInTheDocument();
  });

  it("displays error rate per service", () => {
    render(<ServiceStatusWidget services={[makeServiceStatus({ error_rate: 1.5 })]} />);
    expect(screen.getByText("1.5%")).toBeInTheDocument();
  });

  it("displays empty state when no services", () => {
    render(<ServiceStatusWidget services={[]} />);
    expect(screen.getByText("No services detected")).toBeInTheDocument();
  });

  it("displays label", () => {
    render(<ServiceStatusWidget services={[]} />);
    expect(screen.getByText("Services")).toBeInTheDocument();
  });
});

// ─── WidgetSkeleton Tests ────────────────────────────────────────────

describe("WidgetSkeleton", () => {
  it("renders with data-testid", () => {
    render(<WidgetSkeleton />);
    expect(screen.getByTestId("widget-skeleton")).toBeInTheDocument();
  });

  it("contains animated pulse elements", () => {
    render(<WidgetSkeleton />);
    const skeleton = screen.getByTestId("widget-skeleton");
    const pulsingElements = skeleton.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThan(0);
  });
});
