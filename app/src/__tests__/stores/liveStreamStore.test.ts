import { useLiveStreamStore } from "@/stores/liveStreamStore";
import type { SpanEvent } from "@/types/span";

function makeSpan(overrides: Partial<SpanEvent> = {}): SpanEvent {
  return {
    trace_id: "trace-1",
    span_id: `span-${Math.random().toString(36).slice(2, 8)}`,
    parent_span_id: "",
    span_name: "GET /test",
    span_type: "span",
    service_name: "api",
    kind: "SERVER",
    start_time: new Date().toISOString(),
    duration_ms: 42,
    status_code: "OK",
    http_method: "GET",
    http_route: "/test",
    http_status_code: 200,
    environment: "",
    ...overrides,
  };
}

describe("liveStreamStore", () => {
  beforeEach(() => {
    useLiveStreamStore.getState().reset();
  });

  describe("addSpan — root spans", () => {
    it("adds a root span to the spans array", () => {
      const root = makeSpan({ span_id: "root-1", parent_span_id: "" });
      useLiveStreamStore.getState().addSpan(root);
      expect(useLiveStreamStore.getState().spans).toHaveLength(1);
      expect(useLiveStreamStore.getState().spans[0].span_id).toBe("root-1");
    });

    it("replaces a pending root span in-place", () => {
      const pending = makeSpan({
        span_id: "root-1",
        parent_span_id: "",
        span_type: "pending_span",
        duration_ms: 0,
      });
      const final = makeSpan({
        span_id: "root-1",
        parent_span_id: "",
        span_type: "span",
        duration_ms: 55,
      });

      const store = useLiveStreamStore.getState();
      store.addSpan(pending);
      expect(useLiveStreamStore.getState().spans[0].span_type).toBe("pending_span");

      useLiveStreamStore.getState().addSpan(final);
      const spans = useLiveStreamStore.getState().spans;
      expect(spans).toHaveLength(1);
      expect(spans[0].span_type).toBe("span");
      expect(spans[0].duration_ms).toBe(55);
    });
  });

  describe("addSpan — child spans", () => {
    it("routes a child span to childrenMap", () => {
      const root = makeSpan({ span_id: "root-1", parent_span_id: "" });
      const child = makeSpan({ span_id: "child-1", parent_span_id: "root-1" });

      const store = useLiveStreamStore.getState();
      store.addSpan(root);
      useLiveStreamStore.getState().addSpan(child);

      const state = useLiveStreamStore.getState();
      expect(state.spans).toHaveLength(1);
      expect(state.childrenMap["root-1"]).toHaveLength(1);
      expect(state.childrenMap["root-1"][0].span_id).toBe("child-1");
    });

    it("handles child arriving before parent (race condition)", () => {
      const child = makeSpan({ span_id: "child-1", parent_span_id: "root-1" });
      const root = makeSpan({ span_id: "root-1", parent_span_id: "" });

      const store = useLiveStreamStore.getState();
      store.addSpan(child);
      // Child is in childrenMap even though parent isn't in spans yet
      expect(useLiveStreamStore.getState().childrenMap["root-1"]).toHaveLength(1);

      useLiveStreamStore.getState().addSpan(root);
      const state = useLiveStreamStore.getState();
      expect(state.spans).toHaveLength(1);
      expect(state.childrenMap["root-1"]).toHaveLength(1);
    });

    it("replaces a pending child span in-place", () => {
      const root = makeSpan({ span_id: "root-1", parent_span_id: "" });
      const pendingChild = makeSpan({
        span_id: "child-1",
        parent_span_id: "root-1",
        span_type: "pending_span",
        duration_ms: 0,
      });
      const finalChild = makeSpan({
        span_id: "child-1",
        parent_span_id: "root-1",
        span_type: "span",
        duration_ms: 30,
      });

      useLiveStreamStore.getState().addSpan(root);
      useLiveStreamStore.getState().addSpan(pendingChild);
      useLiveStreamStore.getState().addSpan(finalChild);

      const children = useLiveStreamStore.getState().childrenMap["root-1"];
      expect(children).toHaveLength(1);
      expect(children[0].span_type).toBe("span");
      expect(children[0].duration_ms).toBe(30);
    });

    it("adds multiple children to same parent", () => {
      const root = makeSpan({ span_id: "root-1", parent_span_id: "" });
      const c1 = makeSpan({ span_id: "child-1", parent_span_id: "root-1" });
      const c2 = makeSpan({ span_id: "child-2", parent_span_id: "root-1" });
      const c3 = makeSpan({ span_id: "child-3", parent_span_id: "root-1" });

      useLiveStreamStore.getState().addSpan(root);
      useLiveStreamStore.getState().addSpan(c1);
      useLiveStreamStore.getState().addSpan(c2);
      useLiveStreamStore.getState().addSpan(c3);

      expect(useLiveStreamStore.getState().childrenMap["root-1"]).toHaveLength(3);
    });
  });

  describe("prependSpans — history loading", () => {
    it("prepends root spans and groups children", () => {
      const existingRoot = makeSpan({ span_id: "new-root", parent_span_id: "" });
      useLiveStreamStore.getState().addSpan(existingRoot);

      const historyRoot = makeSpan({ span_id: "old-root", parent_span_id: "" });
      const historyChild = makeSpan({ span_id: "old-child", parent_span_id: "old-root" });

      useLiveStreamStore.getState().prependSpans([historyRoot, historyChild]);

      const state = useLiveStreamStore.getState();
      expect(state.spans).toHaveLength(2);
      expect(state.spans[0].span_id).toBe("old-root"); // prepended
      expect(state.spans[1].span_id).toBe("new-root");
      expect(state.childrenMap["old-root"]).toHaveLength(1);
    });

    it("deduplicates spans that already exist", () => {
      const root = makeSpan({ span_id: "root-1", parent_span_id: "" });
      useLiveStreamStore.getState().addSpan(root);

      useLiveStreamStore.getState().prependSpans([root]);
      expect(useLiveStreamStore.getState().spans).toHaveLength(1);
    });
  });

  describe("toggleExpanded", () => {
    it("adds span ID to expandedSpanIds", () => {
      useLiveStreamStore.getState().toggleExpanded("root-1");
      expect(useLiveStreamStore.getState().expandedSpanIds).toContain("root-1");
    });

    it("removes span ID on second toggle", () => {
      useLiveStreamStore.getState().toggleExpanded("root-1");
      useLiveStreamStore.getState().toggleExpanded("root-1");
      expect(useLiveStreamStore.getState().expandedSpanIds).not.toContain("root-1");
    });

    it("handles multiple expanded spans independently", () => {
      useLiveStreamStore.getState().toggleExpanded("root-1");
      useLiveStreamStore.getState().toggleExpanded("root-2");
      expect(useLiveStreamStore.getState().expandedSpanIds).toEqual(["root-1", "root-2"]);

      useLiveStreamStore.getState().toggleExpanded("root-1");
      expect(useLiveStreamStore.getState().expandedSpanIds).toEqual(["root-2"]);
    });
  });

  describe("reset", () => {
    it("clears all state including childrenMap and expandedSpanIds", () => {
      useLiveStreamStore.getState().addSpan(makeSpan({ span_id: "r", parent_span_id: "" }));
      useLiveStreamStore.getState().addSpan(makeSpan({ span_id: "c", parent_span_id: "r" }));
      useLiveStreamStore.getState().toggleExpanded("r");

      useLiveStreamStore.getState().reset();

      const state = useLiveStreamStore.getState();
      expect(state.spans).toHaveLength(0);
      expect(state.childrenMap).toEqual({});
      expect(state.expandedSpanIds).toEqual([]);
    });
  });
});
