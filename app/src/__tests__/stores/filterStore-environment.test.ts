import { useFilterStore, getActiveFilterCount } from "@/stores/filterStore";
import type { StreamFilters } from "@/types/span";
import { DEFAULT_FILTERS } from "@/types/span";

describe("filterStore environment (Story 11.2)", () => {
  beforeEach(() => {
    useFilterStore.getState().reset();
  });

  it("starts with environment null", () => {
    const { filters } = useFilterStore.getState();
    expect(filters.environment).toBeNull();
  });

  it("setEnvironment updates environment filter", () => {
    useFilterStore.getState().setEnvironment("production");
    expect(useFilterStore.getState().filters.environment).toBe("production");
  });

  it("setEnvironment to null clears environment filter", () => {
    useFilterStore.getState().setEnvironment("staging");
    useFilterStore.getState().setEnvironment(null);
    expect(useFilterStore.getState().filters.environment).toBeNull();
  });

  it("clearAll resets environment to null", () => {
    useFilterStore.getState().setEnvironment("production");
    useFilterStore.getState().clearAll();
    expect(useFilterStore.getState().filters.environment).toBeNull();
  });

  it("reset resets environment to null", () => {
    useFilterStore.getState().setEnvironment("staging");
    useFilterStore.getState().reset();
    expect(useFilterStore.getState().filters.environment).toBeNull();
  });

  it("getActiveFilterCount counts environment when set", () => {
    const f: StreamFilters = { ...DEFAULT_FILTERS, statusGroups: [], environment: "production" };
    expect(getActiveFilterCount(f)).toBe(1);
  });

  it("getActiveFilterCount does not count environment when null", () => {
    const f: StreamFilters = { ...DEFAULT_FILTERS, statusGroups: [], environment: null };
    expect(getActiveFilterCount(f)).toBe(0);
  });
});
