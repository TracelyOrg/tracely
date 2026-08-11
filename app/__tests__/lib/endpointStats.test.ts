import {
  endpointIdentity,
  endpointReactKey,
  formatEndpointLatency,
  mergeDuplicateEndpoints,
  mergeDuplicateWidgetEndpoints,
  normalizeRoute,
  resolveEndpointP95,
} from "@/lib/endpointStats";

describe("endpointStats", () => {
  it("endpointIdentity normalizes empty method to GET", () => {
    expect(endpointIdentity("", "/users/me")).toBe("GET\0/users/me");
    expect(endpointIdentity("get", "/users/me")).toBe("GET\0/users/me");
  });

  it("normalizeRoute collapses trailing slashes", () => {
    expect(normalizeRoute("/docs/")).toBe("/docs");
    expect(normalizeRoute("docs")).toBe("/docs");
    expect(normalizeRoute("/")).toBe("/");
  });

  it("endpointReactKey matches display-style keys after normalization", () => {
    expect(endpointReactKey("GET", "/docs/")).toBe("GET-/docs");
  });

  it("mergeDuplicateEndpoints combines rows with same method and route", () => {
    const merged = mergeDuplicateEndpoints([
      {
        route: "/users/me",
        method: "GET",
        count: 100,
        avg_latency: 50,
        p95_latency: 100,
        error_rate: 2,
      },
      {
        route: "/users/me",
        method: "",
        count: 50,
        avg_latency: 80,
        p95_latency: 200,
        error_rate: 4,
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].count).toBe(150);
    expect(merged[0].avg_latency).toBeCloseTo(60);
    expect(merged[0].p95_latency).toBe(200);
    expect(merged[0].error_rate).toBeCloseTo(2.666, 2);
  });

  it("mergeDuplicateEndpoints merges trailing-slash variants", () => {
    const merged = mergeDuplicateEndpoints([
      {
        route: "/docs",
        method: "GET",
        count: 80,
        avg_latency: 10,
        p95_latency: 20,
        error_rate: 0,
      },
      {
        route: "/docs/",
        method: "GET",
        count: 20,
        avg_latency: 30,
        p95_latency: 50,
        error_rate: 0,
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].route).toBe("/docs");
    expect(merged[0].count).toBe(100);
    expect(merged[0].p95_latency).toBe(50);
  });

  it("mergeDuplicateWidgetEndpoints dedupes camelCase rows", () => {
    const merged = mergeDuplicateWidgetEndpoints([
      { route: "/users/me", method: "GET", count: 10, avgLatency: 100, p95Latency: 150, errorRate: 1 },
      { route: "/users/me", method: "GET", count: 5, avgLatency: 200, p95Latency: 300, errorRate: 3 },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].count).toBe(15);
    expect(merged[0].p95Latency).toBe(300);
  });

  it("resolveEndpointP95 falls back to avg when p95 missing", () => {
    expect(resolveEndpointP95({ p95_latency: undefined, avg_latency: 42 })).toBe(42);
    expect(resolveEndpointP95({ p95_latency: null, avg_latency: 42 })).toBe(42);
    expect(resolveEndpointP95({ p95_latency: NaN, avg_latency: 42 })).toBe(42);
  });

  it("resolveEndpointP95 prefers valid p95", () => {
    expect(resolveEndpointP95({ p95_latency: 120, avg_latency: 40 })).toBe(120);
  });

  it("formatEndpointLatency never renders NaN", () => {
    expect(formatEndpointLatency(NaN)).toBe("—");
    expect(formatEndpointLatency(undefined as unknown as number)).toBe("—");
    expect(formatEndpointLatency(0)).toBe("—");
    expect(formatEndpointLatency(45)).toBe("45ms");
    expect(formatEndpointLatency(1500)).toBe("1.5s");
  });
});
