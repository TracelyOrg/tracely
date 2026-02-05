import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { HealthCard } from "@/components/dashboard/HealthCard";
import { HealthCardSkeleton } from "@/components/dashboard/HealthCardSkeleton";
import { EmptyHealthState, SingleServicePrompt } from "@/components/dashboard/EmptyHealthState";
import type { ServiceHealth, HealthStatus } from "@/types/health";

function makeService(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    name: "api-gateway",
    status: "healthy" as HealthStatus,
    request_rate: 120.5,
    error_rate: 0.5,
    p95_latency: 45.2,
    ...overrides,
  };
}

describe("HealthCard", () => {
  // ─── Basic Rendering ─────────────────────────────────────────────

  it("renders service name", () => {
    render(<HealthCard service={makeService({ name: "user-service" })} />);
    expect(screen.getByText("user-service")).toBeInTheDocument();
  });

  it("renders request rate", () => {
    render(<HealthCard service={makeService({ request_rate: 150.75 })} />);
    // Large values (>= 10) are rounded to integers
    expect(screen.getByText("151")).toBeInTheDocument();
  });

  it("renders error rate with percentage", () => {
    render(<HealthCard service={makeService({ error_rate: 2.5 })} />);
    expect(screen.getByText("2.50%")).toBeInTheDocument();
  });

  it("renders p95 latency in ms", () => {
    render(<HealthCard service={makeService({ p95_latency: 245.5 })} />);
    expect(screen.getByText("246ms")).toBeInTheDocument();
  });

  it("renders p95 latency in seconds for large values", () => {
    render(<HealthCard service={makeService({ p95_latency: 2500 })} />);
    expect(screen.getByText("2.50s")).toBeInTheDocument();
  });

  // ─── Status Indicator Tests (AC1) ────────────────────────────────

  it("shows healthy status with green badge", () => {
    render(<HealthCard service={makeService({ status: "healthy" })} />);
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    const badge = screen.getByText("Healthy").closest("div");
    expect(badge?.className).toMatch(/emerald/);
  });

  it("shows degraded status with amber badge", () => {
    render(<HealthCard service={makeService({ status: "degraded" })} />);
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    const badge = screen.getByText("Degraded").closest("div");
    expect(badge?.className).toMatch(/amber/);
  });

  it("shows error status with red badge", () => {
    render(<HealthCard service={makeService({ status: "error" })} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    const badge = screen.getByText("Error").closest("div");
    expect(badge?.className).toMatch(/red/);
  });

  // ─── Icon + Color Pairing (AC1, UX rules) ─────────────────────────

  it("renders status icon alongside status text", () => {
    render(<HealthCard service={makeService({ status: "healthy" })} />);
    // The badge should contain both icon (svg) and text
    const badge = screen.getByText("Healthy").closest("div");
    expect(badge?.querySelector("svg")).toBeInTheDocument();
  });

  // ─── Metric Color Highlighting ────────────────────────────────────

  it("highlights high error rate in red", () => {
    render(<HealthCard service={makeService({ error_rate: 6.5 })} />);
    const errorText = screen.getByText("6.50%");
    expect(errorText.className).toMatch(/red/);
  });

  it("highlights medium error rate in amber", () => {
    render(<HealthCard service={makeService({ error_rate: 2.5 })} />);
    const errorText = screen.getByText("2.50%");
    expect(errorText.className).toMatch(/amber/);
  });

  it("highlights high latency in red", () => {
    render(<HealthCard service={makeService({ p95_latency: 2500 })} />);
    const latencyText = screen.getByText("2.50s");
    expect(latencyText.className).toMatch(/red/);
  });

  it("highlights medium latency in amber", () => {
    render(<HealthCard service={makeService({ p95_latency: 750 })} />);
    const latencyText = screen.getByText("750ms");
    expect(latencyText.className).toMatch(/amber/);
  });

  // ─── Test ID for automation ───────────────────────────────────────

  it("has correct test id", () => {
    render(<HealthCard service={makeService({ name: "my-service" })} />);
    expect(screen.getByTestId("health-card-my-service")).toBeInTheDocument();
  });
});

describe("HealthCardSkeleton", () => {
  it("renders skeleton loading state", () => {
    render(<HealthCardSkeleton />);
    expect(screen.getByTestId("health-card-skeleton")).toBeInTheDocument();
  });

  it("contains animated pulse elements", () => {
    render(<HealthCardSkeleton />);
    const skeleton = screen.getByTestId("health-card-skeleton");
    const pulsingElements = skeleton.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThan(0);
  });
});

describe("EmptyHealthState", () => {
  it("renders empty state message", () => {
    render(<EmptyHealthState orgSlug="acme" projectSlug="my-api" />);
    expect(screen.getByText("No services detected yet")).toBeInTheDocument();
  });

  it("provides setup guide link", () => {
    render(<EmptyHealthState orgSlug="acme" projectSlug="my-api" />);
    const link = screen.getByRole("link", { name: /setup guide/i });
    expect(link).toHaveAttribute("href", "/acme/my-api/onboarding");
  });

  it("provides documentation link", () => {
    render(<EmptyHealthState orgSlug="acme" projectSlug="my-api" />);
    const link = screen.getByRole("link", { name: /documentation/i });
    expect(link).toHaveAttribute("href", "https://tracely.sh/docs");
  });

  it("has correct test id", () => {
    render(<EmptyHealthState orgSlug="acme" projectSlug="my-api" />);
    expect(screen.getByTestId("empty-health-state")).toBeInTheDocument();
  });
});

describe("SingleServicePrompt", () => {
  it("renders prompt for adding more services", () => {
    render(<SingleServicePrompt />);
    expect(screen.getByText(/instrument more services/i)).toBeInTheDocument();
  });

  it("has correct test id", () => {
    render(<SingleServicePrompt />);
    expect(screen.getByTestId("single-service-prompt")).toBeInTheDocument();
  });
});
