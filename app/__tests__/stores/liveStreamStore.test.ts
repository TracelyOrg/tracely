import { useLiveStreamStore } from "@/stores/liveStreamStore";
import type { SpanEvent } from "@/types/span";

function makeSpan(overrides: Partial<SpanEvent> = {}): SpanEvent {
  return {
    trace_id: "trace-1",
    span_id: "span-1",
    parent_span_id: "",
    span_name: "GET /api/users",
    span_type: "span",
    service_name: "api",
    kind: "SERVER",
    start_time: "2026-02-03T10:00:00Z",
    duration_ms: 42,
    status_code: "OK",
    http_method: "GET",
    http_route: "/api/users",
    http_status_code: 200,
    ...overrides,
  };
}

describe("liveStreamStore", () => {
  beforeEach(() => {
    useLiveStreamStore.getState().reset();
  });

  it("starts with empty spans array", () => {
    const { spans } = useLiveStreamStore.getState();
    expect(spans).toEqual([]);
  });

  it("addSpan appends a span to the list", () => {
    const span = makeSpan();
    useLiveStreamStore.getState().addSpan(span);

    const { spans } = useLiveStreamStore.getState();
    expect(spans).toHaveLength(1);
    expect(spans[0].span_id).toBe("span-1");
  });

  it("addSpan updates pending span in-place when final span arrives", () => {
    const pending = makeSpan({
      span_id: "span-A",
      span_type: "pending_span",
      duration_ms: 0,
      http_status_code: 0,
      status_code: "UNSET",
    });
    useLiveStreamStore.getState().addSpan(pending);
    expect(useLiveStreamStore.getState().spans).toHaveLength(1);
    expect(useLiveStreamStore.getState().spans[0].span_type).toBe("pending_span");

    const final = makeSpan({
      span_id: "span-A",
      span_type: "span",
      duration_ms: 150,
      http_status_code: 200,
      status_code: "OK",
    });
    useLiveStreamStore.getState().addSpan(final);

    const { spans } = useLiveStreamStore.getState();
    expect(spans).toHaveLength(1);
    expect(spans[0].span_type).toBe("span");
    expect(spans[0].duration_ms).toBe(150);
    expect(spans[0].http_status_code).toBe(200);
  });

  it("caps buffer at MAX_BUFFER_SIZE and prunes oldest", () => {
    const store = useLiveStreamStore.getState();
    for (let i = 0; i < 5010; i++) {
      store.addSpan(makeSpan({ span_id: `span-${i}` }));
    }

    const { spans } = useLiveStreamStore.getState();
    expect(spans.length).toBeLessThanOrEqual(5000);
    // Oldest spans should have been pruned — first span should not be span-0
    expect(spans[0].span_id).not.toBe("span-0");
  });

  it("reset clears all spans", () => {
    useLiveStreamStore.getState().addSpan(makeSpan());
    useLiveStreamStore.getState().addSpan(makeSpan({ span_id: "span-2" }));
    expect(useLiveStreamStore.getState().spans).toHaveLength(2);

    useLiveStreamStore.getState().reset();
    expect(useLiveStreamStore.getState().spans).toEqual([]);
  });

  it("setIsAtBottom updates scroll tracking state", () => {
    useLiveStreamStore.getState().setIsAtBottom(true);
    expect(useLiveStreamStore.getState().isAtBottom).toBe(true);

    useLiveStreamStore.getState().setIsAtBottom(false);
    expect(useLiveStreamStore.getState().isAtBottom).toBe(false);
  });

  it("isAtBottom defaults to true (live position)", () => {
    expect(useLiveStreamStore.getState().isAtBottom).toBe(true);
  });

  // --- History loading (Story 3.2) ---

  it("prependSpans prepends older spans to the beginning", () => {
    useLiveStreamStore.getState().addSpan(makeSpan({ span_id: "live-1" }));

    const olderSpans = [
      makeSpan({ span_id: "old-1", start_time: "2026-02-03T09:00:00Z" }),
      makeSpan({ span_id: "old-2", start_time: "2026-02-03T09:01:00Z" }),
    ];
    useLiveStreamStore.getState().prependSpans(olderSpans);

    const { spans } = useLiveStreamStore.getState();
    expect(spans).toHaveLength(3);
    expect(spans[0].span_id).toBe("old-1");
    expect(spans[1].span_id).toBe("old-2");
    expect(spans[2].span_id).toBe("live-1");
  });

  it("isLoadingHistory defaults to false", () => {
    expect(useLiveStreamStore.getState().isLoadingHistory).toBe(false);
  });

  it("setLoadingHistory updates loading state", () => {
    useLiveStreamStore.getState().setLoadingHistory(true);
    expect(useLiveStreamStore.getState().isLoadingHistory).toBe(true);

    useLiveStreamStore.getState().setLoadingHistory(false);
    expect(useLiveStreamStore.getState().isLoadingHistory).toBe(false);
  });

  it("hasMoreHistory defaults to true", () => {
    expect(useLiveStreamStore.getState().hasMoreHistory).toBe(true);
  });

  it("setHasMoreHistory updates flag", () => {
    useLiveStreamStore.getState().setHasMoreHistory(false);
    expect(useLiveStreamStore.getState().hasMoreHistory).toBe(false);
  });

  it("prependSpans does not duplicate spans with same span_id", () => {
    useLiveStreamStore.getState().addSpan(makeSpan({ span_id: "existing" }));

    const olderSpans = [
      makeSpan({ span_id: "existing" }),
      makeSpan({ span_id: "new-old" }),
    ];
    useLiveStreamStore.getState().prependSpans(olderSpans);

    const { spans } = useLiveStreamStore.getState();
    expect(spans).toHaveLength(2);
    expect(spans[0].span_id).toBe("new-old");
    expect(spans[1].span_id).toBe("existing");
  });

  it("reset clears history state too", () => {
    useLiveStreamStore.getState().setLoadingHistory(true);
    useLiveStreamStore.getState().setHasMoreHistory(false);
    useLiveStreamStore.getState().reset();

    expect(useLiveStreamStore.getState().isLoadingHistory).toBe(false);
    expect(useLiveStreamStore.getState().hasMoreHistory).toBe(true);
  });
});
