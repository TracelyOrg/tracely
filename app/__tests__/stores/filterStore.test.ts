import { useFilterStore, getActiveFilterCount } from "@/stores/filterStore";
import type { StreamFilters } from "@/types/span";
import { DEFAULT_FILTERS } from "@/types/span";

describe("filterStore", () => {
  beforeEach(() => {
    useFilterStore.getState().reset();
  });

  it("starts with default filters", () => {
    const { filters } = useFilterStore.getState();
    expect(filters.service).toBeNull();
    expect(filters.statusGroups).toEqual([]);
    expect(filters.endpointSearch).toBe("");
    expect(filters.timeRange).toEqual({ preset: "15m" });
  });

  it("setService updates service filter", () => {
    useFilterStore.getState().setService("api-gateway");
    expect(useFilterStore.getState().filters.service).toBe("api-gateway");
  });

  it("setService to null clears service filter", () => {
    useFilterStore.getState().setService("api");
    useFilterStore.getState().setService(null);
    expect(useFilterStore.getState().filters.service).toBeNull();
  });

  it("toggleStatusGroup adds group when not present", () => {
    useFilterStore.getState().toggleStatusGroup("4xx");
    expect(useFilterStore.getState().filters.statusGroups).toEqual(["4xx"]);
  });

  it("toggleStatusGroup removes group when already present", () => {
    useFilterStore.getState().toggleStatusGroup("4xx");
    useFilterStore.getState().toggleStatusGroup("5xx");
    useFilterStore.getState().toggleStatusGroup("4xx");
    expect(useFilterStore.getState().filters.statusGroups).toEqual(["5xx"]);
  });

  it("toggleStatusGroup allows multiple groups active", () => {
    useFilterStore.getState().toggleStatusGroup("2xx");
    useFilterStore.getState().toggleStatusGroup("5xx");
    const groups = useFilterStore.getState().filters.statusGroups;
    expect(groups).toContain("2xx");
    expect(groups).toContain("5xx");
    expect(groups).toHaveLength(2);
  });

  it("setEndpointSearch updates search string", () => {
    useFilterStore.getState().setEndpointSearch("/api/users");
    expect(useFilterStore.getState().filters.endpointSearch).toBe("/api/users");
  });

  it("setTimeRange updates time range", () => {
    useFilterStore.getState().setTimeRange({ preset: "24h" });
    expect(useFilterStore.getState().filters.timeRange).toEqual({ preset: "24h" });
  });

  it("setTimeRange supports custom range with start/end", () => {
    useFilterStore.getState().setTimeRange({
      preset: "custom",
      start: "2026-02-03T00:00:00Z",
      end: "2026-02-03T12:00:00Z",
    });
    const { timeRange } = useFilterStore.getState().filters;
    expect(timeRange.preset).toBe("custom");
    expect(timeRange.start).toBe("2026-02-03T00:00:00Z");
    expect(timeRange.end).toBe("2026-02-03T12:00:00Z");
  });

  it("clearAll resets all filters to defaults", () => {
    useFilterStore.getState().setService("api");
    useFilterStore.getState().toggleStatusGroup("5xx");
    useFilterStore.getState().setEndpointSearch("/health");
    useFilterStore.getState().setTimeRange({ preset: "6h" });

    useFilterStore.getState().clearAll();

    const { filters } = useFilterStore.getState();
    expect(filters.service).toBeNull();
    expect(filters.statusGroups).toEqual([]);
    expect(filters.endpointSearch).toBe("");
    expect(filters.timeRange).toEqual({ preset: "15m" });
  });

  it("reset behaves same as clearAll", () => {
    useFilterStore.getState().setService("svc");
    useFilterStore.getState().reset();
    expect(useFilterStore.getState().filters.service).toBeNull();
  });
});

describe("getActiveFilterCount", () => {
  it("returns 0 for default filters", () => {
    expect(getActiveFilterCount({ ...DEFAULT_FILTERS, statusGroups: [] })).toBe(0);
  });

  it("counts service filter as 1", () => {
    const f: StreamFilters = { ...DEFAULT_FILTERS, statusGroups: [], service: "api" };
    expect(getActiveFilterCount(f)).toBe(1);
  });

  it("counts non-empty statusGroups as 1", () => {
    const f: StreamFilters = { ...DEFAULT_FILTERS, statusGroups: ["4xx", "5xx"] };
    expect(getActiveFilterCount(f)).toBe(1);
  });

  it("counts endpointSearch as 1", () => {
    const f: StreamFilters = { ...DEFAULT_FILTERS, statusGroups: [], endpointSearch: "/api" };
    expect(getActiveFilterCount(f)).toBe(1);
  });

  it("counts non-default timeRange as 1", () => {
    const f: StreamFilters = { ...DEFAULT_FILTERS, statusGroups: [], timeRange: { preset: "24h" } };
    expect(getActiveFilterCount(f)).toBe(1);
  });

  it("counts all active filters together", () => {
    const f: StreamFilters = {
      service: "api",
      statusGroups: ["5xx"],
      endpointSearch: "/users",
      timeRange: { preset: "1h" },
      environment: null,
    };
    expect(getActiveFilterCount(f)).toBe(4);
  });
});
