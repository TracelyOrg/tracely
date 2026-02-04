import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FilterBar } from "@/components/pulse/FilterBar";
import { useFilterStore } from "@/stores/filterStore";

const SERVICES = ["api", "web", "worker"];

describe("FilterBar", () => {
  beforeEach(() => {
    useFilterStore.getState().reset();
  });

  it("renders the filter bar", () => {
    render(<FilterBar services={SERVICES} />);
    expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("renders service dropdown with all services", () => {
    render(<FilterBar services={SERVICES} />);
    const select = screen.getByTestId("filter-service") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // "All services" + 3 services = 4 options
    expect(select.options).toHaveLength(4);
  });

  it("renders status code group toggles", () => {
    render(<FilterBar services={SERVICES} />);
    expect(screen.getByTestId("filter-status-2xx")).toBeInTheDocument();
    expect(screen.getByTestId("filter-status-3xx")).toBeInTheDocument();
    expect(screen.getByTestId("filter-status-4xx")).toBeInTheDocument();
    expect(screen.getByTestId("filter-status-5xx")).toBeInTheDocument();
  });

  it("renders time range preset buttons", () => {
    render(<FilterBar services={SERVICES} />);
    expect(screen.getByTestId("filter-time-15m")).toBeInTheDocument();
    expect(screen.getByTestId("filter-time-1h")).toBeInTheDocument();
    expect(screen.getByTestId("filter-time-6h")).toBeInTheDocument();
    expect(screen.getByTestId("filter-time-24h")).toBeInTheDocument();
    expect(screen.getByTestId("filter-time-custom")).toBeInTheDocument();
  });

  it("does not show badge when no filters active", () => {
    render(<FilterBar services={SERVICES} />);
    expect(screen.queryByTestId("filter-badge")).not.toBeInTheDocument();
  });

  it("shows badge with count when filters are active", () => {
    useFilterStore.getState().setService("api");
    useFilterStore.getState().toggleStatusGroup("5xx");
    render(<FilterBar services={SERVICES} />);
    const badge = screen.getByTestId("filter-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe("2");
  });

  it("shows clear-all button when filters are active", () => {
    useFilterStore.getState().setService("api");
    render(<FilterBar services={SERVICES} />);
    expect(screen.getByTestId("filter-clear-all")).toBeInTheDocument();
  });

  it("does not show clear-all button when no filters active", () => {
    render(<FilterBar services={SERVICES} />);
    expect(screen.queryByTestId("filter-clear-all")).not.toBeInTheDocument();
  });

  it("clicking clear-all resets all filters", () => {
    useFilterStore.getState().setService("api");
    useFilterStore.getState().toggleStatusGroup("5xx");
    render(<FilterBar services={SERVICES} />);

    fireEvent.click(screen.getByTestId("filter-clear-all"));

    const { filters } = useFilterStore.getState();
    expect(filters.service).toBeNull();
    expect(filters.statusGroups).toEqual([]);
  });

  it("selecting a service updates filter store", () => {
    render(<FilterBar services={SERVICES} />);
    const select = screen.getByTestId("filter-service") as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "web" } });
    expect(useFilterStore.getState().filters.service).toBe("web");

    fireEvent.change(select, { target: { value: "" } });
    expect(useFilterStore.getState().filters.service).toBeNull();
  });

  it("clicking status toggle updates filter store", () => {
    render(<FilterBar services={SERVICES} />);
    fireEvent.click(screen.getByTestId("filter-status-4xx"));
    expect(useFilterStore.getState().filters.statusGroups).toContain("4xx");

    // Click again to deactivate
    fireEvent.click(screen.getByTestId("filter-status-4xx"));
    expect(useFilterStore.getState().filters.statusGroups).not.toContain("4xx");
  });

  it("clicking time range preset updates filter store", () => {
    render(<FilterBar services={SERVICES} />);
    fireEvent.click(screen.getByTestId("filter-time-6h"));
    expect(useFilterStore.getState().filters.timeRange.preset).toBe("6h");
  });

  it("clicking search toggle opens search input", () => {
    render(<FilterBar services={SERVICES} />);
    expect(screen.queryByTestId("filter-search-input")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("filter-search-toggle"));
    expect(screen.getByTestId("filter-search-input")).toBeInTheDocument();
  });

  it("typing in search input updates filter store", () => {
    render(<FilterBar services={SERVICES} />);
    fireEvent.click(screen.getByTestId("filter-search-toggle"));

    const input = screen.getByTestId("filter-search-input");
    fireEvent.change(input, { target: { value: "/api/users" } });
    expect(useFilterStore.getState().filters.endpointSearch).toBe("/api/users");
  });

  it("closing search clears endpoint search filter", () => {
    useFilterStore.getState().setEndpointSearch("/api");
    render(<FilterBar services={SERVICES} />);
    // Open search first
    fireEvent.click(screen.getByTestId("filter-search-toggle"));
    // Close it
    fireEvent.click(screen.getByTestId("filter-search-toggle"));
    expect(useFilterStore.getState().filters.endpointSearch).toBe("");
  });

  // --- Custom time range tests (AC5) ---

  it("does not show custom range inputs when preset is not custom", () => {
    render(<FilterBar services={SERVICES} />);
    expect(screen.queryByTestId("filter-custom-range")).not.toBeInTheDocument();
  });

  it("shows custom range inputs when Custom preset is selected", () => {
    useFilterStore.getState().setTimeRange({ preset: "custom" });
    render(<FilterBar services={SERVICES} />);
    expect(screen.getByTestId("filter-custom-range")).toBeInTheDocument();
    expect(screen.getByTestId("filter-custom-start")).toBeInTheDocument();
    expect(screen.getByTestId("filter-custom-end")).toBeInTheDocument();
  });

  it("clicking Custom preset switches to custom mode", () => {
    render(<FilterBar services={SERVICES} />);
    fireEvent.click(screen.getByTestId("filter-time-custom"));
    expect(useFilterStore.getState().filters.timeRange.preset).toBe("custom");
  });

  it("setting custom start updates filter store", () => {
    useFilterStore.getState().setTimeRange({ preset: "custom" });
    render(<FilterBar services={SERVICES} />);
    const startInput = screen.getByTestId("filter-custom-start");
    fireEvent.change(startInput, { target: { value: "2025-01-15T10:00" } });
    const { timeRange } = useFilterStore.getState().filters;
    expect(timeRange.preset).toBe("custom");
    expect(timeRange.start).toBeDefined();
  });

  it("setting custom end updates filter store", () => {
    useFilterStore.getState().setTimeRange({ preset: "custom" });
    render(<FilterBar services={SERVICES} />);
    const endInput = screen.getByTestId("filter-custom-end");
    fireEvent.change(endInput, { target: { value: "2025-01-15T18:00" } });
    const { timeRange } = useFilterStore.getState().filters;
    expect(timeRange.preset).toBe("custom");
    expect(timeRange.end).toBeDefined();
  });

  it("switching from custom to preset hides custom inputs", () => {
    useFilterStore.getState().setTimeRange({ preset: "custom" });
    render(<FilterBar services={SERVICES} />);
    expect(screen.getByTestId("filter-custom-range")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("filter-time-1h"));
    expect(screen.queryByTestId("filter-custom-range")).not.toBeInTheDocument();
    expect(useFilterStore.getState().filters.timeRange.preset).toBe("1h");
  });
});
