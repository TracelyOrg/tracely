import { create } from "zustand";
import type { StatusCodeGroup, StreamFilters, TimeRange } from "@/types/span";
import { DEFAULT_FILTERS } from "@/types/span";

interface FilterState {
  filters: StreamFilters;
  setService: (service: string | null) => void;
  toggleStatusGroup: (group: StatusCodeGroup) => void;
  setEndpointSearch: (search: string) => void;
  setTimeRange: (range: TimeRange) => void;
  clearAll: () => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  filters: { ...DEFAULT_FILTERS, statusGroups: [] },

  setService: (service) =>
    set((state) => ({
      filters: { ...state.filters, service },
    })),

  toggleStatusGroup: (group) =>
    set((state) => {
      const current = state.filters.statusGroups;
      const next = current.includes(group)
        ? current.filter((g) => g !== group)
        : [...current, group];
      return { filters: { ...state.filters, statusGroups: next } };
    }),

  setEndpointSearch: (search) =>
    set((state) => ({
      filters: { ...state.filters, endpointSearch: search },
    })),

  setTimeRange: (range) =>
    set((state) => ({
      filters: { ...state.filters, timeRange: range },
    })),

  clearAll: () =>
    set({ filters: { ...DEFAULT_FILTERS, statusGroups: [] } }),

  reset: () =>
    set({ filters: { ...DEFAULT_FILTERS, statusGroups: [] } }),
}));

/** Compute the number of active (non-default) filters. */
export function getActiveFilterCount(filters: StreamFilters): number {
  let count = 0;
  if (filters.service !== null) count++;
  if (filters.statusGroups.length > 0) count++;
  if (filters.endpointSearch !== "") count++;
  if (filters.timeRange.preset !== "15m") count++;
  return count;
}
