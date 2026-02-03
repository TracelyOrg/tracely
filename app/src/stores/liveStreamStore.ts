import { create } from "zustand";
import type { SpanEvent } from "@/types/span";

const MAX_BUFFER_SIZE = 5000;

interface LiveStreamState {
  spans: SpanEvent[];
  isAtBottom: boolean;
  addSpan: (span: SpanEvent) => void;
  setIsAtBottom: (value: boolean) => void;
  reset: () => void;
}

export const useLiveStreamStore = create<LiveStreamState>((set) => ({
  spans: [],
  isAtBottom: true,

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

  setIsAtBottom: (value) => set({ isAtBottom: value }),

  reset: () => set({ spans: [], isAtBottom: true }),
}));
