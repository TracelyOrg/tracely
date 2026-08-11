import {
  getWiderDashboardPreset,
  formatTryWiderLabel,
  formatViewingWindowLabel,
} from "@/lib/dashboardTimeNudges";

describe("dashboardTimeNudges", () => {
  it("returns the next wider preset in order", () => {
    expect(getWiderDashboardPreset({ preset: "15m" })).toBe("1h");
    expect(getWiderDashboardPreset({ preset: "1h" })).toBe("6h");
    expect(getWiderDashboardPreset({ preset: "6h" })).toBe("24h");
    expect(getWiderDashboardPreset({ preset: "24h" })).toBeNull();
  });

  it("returns null for custom ranges", () => {
    expect(
      getWiderDashboardPreset({
        preset: "custom",
        start: "2026-01-01T00:00:00Z",
        end: "2026-01-02T00:00:00Z",
      })
    ).toBeNull();
  });

  it("formats viewing and try labels", () => {
    expect(formatViewingWindowLabel({ preset: "15m" })).toBe("the last 15 minutes");
    expect(formatTryWiderLabel("1h")).toBe("Try the last hour");
  });
});
