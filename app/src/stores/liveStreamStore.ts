import { create } from "zustand";
import type { SpanEvent } from "@/types/span";

const MAX_BUFFER_SIZE = 5000;

interface LiveStreamState {
  spans: SpanEvent[];
  isAtBottom: boolean;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  addSpan: (span: SpanEvent) => void;
  prependSpans: (older: SpanEvent[]) => void;
  setIsAtBottom: (value: boolean) => void;
  setLoadingHistory: (value: boolean) => void;
  setHasMoreHistory: (value: boolean) => void;
  reset: () => void;
}

export const useLiveStreamStore = create<LiveStreamState>((set) => ({
  spans: [],
  isAtBottom: true,
  isLoadingHistory: false,
  hasMoreHistory: true,

  addSpan: (span) =>
    set((state) => {
      // Check if this is a final span replacing a pending one
      const pendingIndex = state.spans.findIndex(
        (s) => s.span_id === span.span_id && s.span_type === "pending_span"
      );

      let nextSpans: SpanEvent[];

      if (pendingIndex !== -1 && span.span_type === "span") {
        // Update pending span in-place
        nextSpans = [...state.spans];
        nextSpans[pendingIndex] = span;
      } else {
        nextSpans = [...state.spans, span];
      }

      // Prune oldest if buffer exceeds cap
      if (nextSpans.length > MAX_BUFFER_SIZE) {
        nextSpans = nextSpans.slice(nextSpans.length - MAX_BUFFER_SIZE);
      }

      return { spans: nextSpans };
    }),

  prependSpans: (older) =>
    set((state) => {
      const existingIds = new Set(state.spans.map((s) => s.span_id));
      const unique = older.filter((s) => !existingIds.has(s.span_id));
      return { spans: [...unique, ...state.spans] };
    }),

  setIsAtBottom: (value) => set({ isAtBottom: value }),
  setLoadingHistory: (value) => set({ isLoadingHistory: value }),
  setHasMoreHistory: (value) => set({ hasMoreHistory: value }),

  reset: () => set({
    spans: [],
    isAtBottom: true,
    isLoadingHistory: false,
    hasMoreHistory: true,
  }),
}));
