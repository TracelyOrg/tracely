import { buildSpanTree, flattenTree, getAllSpanIds } from "@/lib/spanTree";
import type { SpanEvent, TraceSpanEvent } from "@/types/span";

function makeSpan(overrides: Partial<SpanEvent> = {}): SpanEvent {
  return {
    trace_id: "trace-1",
    span_id: "span-root",
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
    ...overrides,
  };
}

describe("buildSpanTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildSpanTree([])).toEqual([]);
  });

  it("builds a single root node for a single span", () => {
    const spans = [makeSpan()];
    const tree = buildSpanTree(spans);

    expect(tree).toHaveLength(1);
    expect(tree[0].span.span_id).toBe("span-root");
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children).toEqual([]);
  });

  it("builds a parent-child hierarchy from flat spans", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 100 }),
      makeSpan({
        span_id: "child-1",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 40,
      }),
      makeSpan({
        span_id: "child-2",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.060Z",
        duration_ms: 30,
      }),
    ];

    const tree = buildSpanTree(spans);

    expect(tree).toHaveLength(1);
    expect(tree[0].span.span_id).toBe("root");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].span.span_id).toBe("child-1");
    expect(tree[0].children[1].span.span_id).toBe("child-2");
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[1].depth).toBe(1);
  });

  it("builds deeply nested tree (3 levels)", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 200 }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 100,
      }),
      makeSpan({
        span_id: "grandchild",
        parent_span_id: "child",
        start_time: "2026-02-03T10:00:00.020Z",
        duration_ms: 50,
      }),
    ];

    const tree = buildSpanTree(spans);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].span.span_id).toBe("grandchild");
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it("sorts children by start_time ascending", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 100 }),
      makeSpan({
        span_id: "later",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.050Z",
        duration_ms: 20,
      }),
      makeSpan({
        span_id: "earlier",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 30,
      }),
    ];

    const tree = buildSpanTree(spans);
    expect(tree[0].children[0].span.span_id).toBe("earlier");
    expect(tree[0].children[1].span.span_id).toBe("later");
  });

  it("computes offsetMs relative to trace start", () => {
    const spans = [
      makeSpan({
        span_id: "root",
        parent_span_id: "",
        start_time: "2026-02-03T10:00:00.000Z",
        duration_ms: 100,
      }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.025Z",
        duration_ms: 50,
      }),
    ];

    const tree = buildSpanTree(spans);
    expect(tree[0].offsetMs).toBe(0);
    expect(tree[0].children[0].offsetMs).toBe(25);
  });

  it("computes percentOfTrace correctly", () => {
    const spans = [
      makeSpan({
        span_id: "root",
        parent_span_id: "",
        start_time: "2026-02-03T10:00:00.000Z",
        duration_ms: 200,
      }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.000Z",
        duration_ms: 100,
      }),
    ];

    const tree = buildSpanTree(spans);
    expect(tree[0].percentOfTrace).toBe(100);
    expect(tree[0].children[0].percentOfTrace).toBe(50);
  });

  it("marks the slowest span correctly", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 200 }),
      makeSpan({
        span_id: "fast",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 30,
      }),
      makeSpan({
        span_id: "slow",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.050Z",
        duration_ms: 150,
      }),
    ];

    const tree = buildSpanTree(spans);
    // Root is 200ms which is the slowest
    expect(tree[0].isSlowest).toBe(true);
    expect(tree[0].children[0].isSlowest).toBe(false);
    expect(tree[0].children[1].isSlowest).toBe(false);
  });

  it("marks bottleneck for spans >50% of total trace time", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 100 }),
      makeSpan({
        span_id: "bottleneck",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 60,
      }),
      makeSpan({
        span_id: "fast",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.070Z",
        duration_ms: 20,
      }),
    ];

    const tree = buildSpanTree(spans);
    expect(tree[0].isBottleneck).toBe(true); // root is 100% of trace
    expect(tree[0].children[0].isBottleneck).toBe(true); // 60ms > 50ms (50% of 100ms)
    expect(tree[0].children[1].isBottleneck).toBe(false); // 20ms < 50ms
  });

  it("computes childrenDurationMs as direct children total", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 100 }),
      makeSpan({
        span_id: "c1",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 30,
      }),
      makeSpan({
        span_id: "c2",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.050Z",
        duration_ms: 40,
      }),
    ];

    const tree = buildSpanTree(spans);
    expect(tree[0].childrenDurationMs).toBe(70);
  });
});

describe("flattenTree", () => {
  it("returns empty array for empty roots", () => {
    expect(flattenTree([], new Set())).toEqual([]);
  });

  it("returns only roots when nothing is expanded", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 100 }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 40,
      }),
    ];
    const tree = buildSpanTree(spans);
    const flat = flattenTree(tree, new Set());

    expect(flat).toHaveLength(1);
    expect(flat[0].span.span_id).toBe("root");
  });

  it("includes children when parent is expanded", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 100 }),
      makeSpan({
        span_id: "child-1",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 40,
      }),
      makeSpan({
        span_id: "child-2",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.060Z",
        duration_ms: 30,
      }),
    ];
    const tree = buildSpanTree(spans);
    const flat = flattenTree(tree, new Set(["root"]));

    expect(flat).toHaveLength(3);
    expect(flat[0].span.span_id).toBe("root");
    expect(flat[1].span.span_id).toBe("child-1");
    expect(flat[2].span.span_id).toBe("child-2");
  });

  it("respects nested expand states", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 200 }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 100,
      }),
      makeSpan({
        span_id: "grandchild",
        parent_span_id: "child",
        start_time: "2026-02-03T10:00:00.020Z",
        duration_ms: 50,
      }),
    ];
    const tree = buildSpanTree(spans);

    // Only expand root, not child
    const flat1 = flattenTree(tree, new Set(["root"]));
    expect(flat1).toHaveLength(2);

    // Expand both
    const flat2 = flattenTree(tree, new Set(["root", "child"]));
    expect(flat2).toHaveLength(3);
    expect(flat2[2].span.span_id).toBe("grandchild");
  });
});

function makeTraceSpan(overrides: Partial<TraceSpanEvent> = {}): TraceSpanEvent {
  return {
    ...makeSpan(),
    attributes: {},
    ...overrides,
  };
}

describe("buildSpanTree — log events parsing (AC3)", () => {
  it("parses log events from span.events attribute", () => {
    const logEvents = [
      {
        timestamp: "2026-02-03T10:00:00.015Z",
        name: "log",
        level: "error",
        message: "Connection refused",
      },
      {
        timestamp: "2026-02-03T10:00:00.020Z",
        name: "retry",
        level: "warn",
        message: "Retrying request",
      },
    ];

    const spans: TraceSpanEvent[] = [
      makeTraceSpan({
        attributes: { "span.events": JSON.stringify(logEvents) },
      }),
    ];

    const tree = buildSpanTree(spans);
    expect(tree[0].logEvents).toHaveLength(2);
    expect(tree[0].logEvents[0].message).toBe("Connection refused");
    expect(tree[0].logEvents[0].level).toBe("error");
    expect(tree[0].logEvents[1].message).toBe("Retrying request");
    expect(tree[0].logEvents[1].level).toBe("warn");
  });

  it("returns empty logEvents when no attributes", () => {
    const spans = [makeSpan()];
    const tree = buildSpanTree(spans);
    expect(tree[0].logEvents).toEqual([]);
  });

  it("returns empty logEvents when span.events is missing", () => {
    const spans: TraceSpanEvent[] = [
      makeTraceSpan({ attributes: { "some.other": "value" } }),
    ];
    const tree = buildSpanTree(spans);
    expect(tree[0].logEvents).toEqual([]);
  });

  it("returns empty logEvents for malformed JSON", () => {
    const spans: TraceSpanEvent[] = [
      makeTraceSpan({ attributes: { "span.events": "not valid json" } }),
    ];
    const tree = buildSpanTree(spans);
    expect(tree[0].logEvents).toEqual([]);
  });

  it("defaults invalid level to 'info'", () => {
    const logEvents = [
      { timestamp: "2026-02-03T10:00:00.015Z", name: "log", level: "custom", message: "test" },
    ];
    const spans: TraceSpanEvent[] = [
      makeTraceSpan({ attributes: { "span.events": JSON.stringify(logEvents) } }),
    ];
    const tree = buildSpanTree(spans);
    expect(tree[0].logEvents[0].level).toBe("info");
  });

  it("uses event name as message fallback", () => {
    const logEvents = [
      { timestamp: "2026-02-03T10:00:00.015Z", name: "request.start", level: "info" },
    ];
    const spans: TraceSpanEvent[] = [
      makeTraceSpan({ attributes: { "span.events": JSON.stringify(logEvents) } }),
    ];
    const tree = buildSpanTree(spans);
    expect(tree[0].logEvents[0].message).toBe("request.start");
    expect(tree[0].logEvents[0].name).toBe("request.start");
  });
});

describe("getAllSpanIds", () => {
  it("returns all span IDs in the tree", () => {
    const spans = [
      makeSpan({ span_id: "root", parent_span_id: "", duration_ms: 200 }),
      makeSpan({
        span_id: "child",
        parent_span_id: "root",
        start_time: "2026-02-03T10:00:00.010Z",
        duration_ms: 100,
      }),
      makeSpan({
        span_id: "grandchild",
        parent_span_id: "child",
        start_time: "2026-02-03T10:00:00.020Z",
        duration_ms: 50,
      }),
    ];
    const tree = buildSpanTree(spans);
    const ids = getAllSpanIds(tree);

    expect(ids.size).toBe(3);
    expect(ids.has("root")).toBe(true);
    expect(ids.has("child")).toBe(true);
    expect(ids.has("grandchild")).toBe(true);
  });
});
