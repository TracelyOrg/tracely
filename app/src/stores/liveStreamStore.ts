import { create } from "zustand";
import type { SpanEvent } from "@/types/span";

const MAX_BUFFER_SIZE = 5000;

interface LiveStreamState {
  /** Root spans only (parent_span_id is empty). */
  spans: SpanEvent[];
  /** Maps parent span_id → direct child spans. */
  childrenMap: Record<string, SpanEvent[]>;
  /** Set of root span IDs that are currently expanded in the UI. */
  expandedSpanIds: string[];
  isAtBottom: boolean;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  addSpan: (span: SpanEvent) => void;
  prependSpans: (older: SpanEvent[]) => void;
  toggleExpanded: (spanId: string) => void;
  setIsAtBottom: (value: boolean) => void;
  setLoadingHistory: (value: boolean) => void;
  setHasMoreHistory: (value: boolean) => void;
  reset: () => void;
}

function isRootSpan(span: SpanEvent): boolean {
  return !span.parent_span_id || span.parent_span_id === "";
}

export const useLiveStreamStore = create<LiveStreamState>((set) => ({
  spans: [],
  childrenMap: {},
  expandedSpanIds: [],
  isAtBottom: true,
  isLoadingHistory: false,
  hasMoreHistory: true,

  addSpan: (span) =>
    set((state) => {
      if (isRootSpan(span)) {
        // --- Root span ---
        // Check if replacing a pending root span
        const pendingIndex = state.spans.findIndex(
          (s) => s.span_id === span.span_id && s.span_type === "pending_span"
        );

        let nextSpans: SpanEvent[];

        if (pendingIndex !== -1 && span.span_type === "span") {
          nextSpans = [...state.spans];
          nextSpans[pendingIndex] = span;
        } else {
          nextSpans = [...state.spans, span];
        }

        // Prune oldest roots if buffer exceeds cap
        let nextChildrenMap = state.childrenMap;
        if (nextSpans.length > MAX_BUFFER_SIZE) {
          const pruned = nextSpans.slice(0, nextSpans.length - MAX_BUFFER_SIZE);
          nextSpans = nextSpans.slice(nextSpans.length - MAX_BUFFER_SIZE);

          // Clean up children of pruned roots
          const prunedIds = new Set(pruned.map((s) => s.span_id));
          if (prunedIds.size > 0) {
            nextChildrenMap = { ...state.childrenMap };
            for (const id of prunedIds) {
              delete nextChildrenMap[id];
            }
          }
        }

        return { spans: nextSpans, childrenMap: nextChildrenMap };
      } else {
        // --- Child span ---
        const parentId = span.parent_span_id;
        const existing = state.childrenMap[parentId] ?? [];

        // Check if replacing a pending child span
        const pendingChildIndex = existing.findIndex(
          (s) => s.span_id === span.span_id && s.span_type === "pending_span"
        );

        let nextChildren: SpanEvent[];
        if (pendingChildIndex !== -1 && span.span_type === "span") {
          nextChildren = [...existing];
          nextChildren[pendingChildIndex] = span;
        } else {
          nextChildren = [...existing, span];
        }

        return {
          childrenMap: {
            ...state.childrenMap,
            [parentId]: nextChildren,
          },
        };
      }
    }),

  prependSpans: (older) =>
    set((state) => {
      const existingRootIds = new Set(state.spans.map((s) => s.span_id));

      // Collect all existing child span_ids across all parents
      const existingChildIds = new Set<string>();
      for (const children of Object.values(state.childrenMap)) {
        for (const child of children) {
          existingChildIds.add(child.span_id);
        }
      }

      const newRoots: SpanEvent[] = [];
      const newChildrenMap: Record<string, SpanEvent[]> = { ...state.childrenMap };

      for (const span of older) {
        if (isRootSpan(span)) {
          if (!existingRootIds.has(span.span_id)) {
            newRoots.push(span);
          }
        } else {
          if (!existingChildIds.has(span.span_id)) {
            const parentId = span.parent_span_id;
            if (!newChildrenMap[parentId]) {
              newChildrenMap[parentId] = [];
            }
            newChildrenMap[parentId] = [...newChildrenMap[parentId], span];
          }
        }
      }

      return {
        spans: [...newRoots, ...state.spans],
        childrenMap: newChildrenMap,
      };
    }),

  toggleExpanded: (spanId) =>
    set((state) => {
      const idx = state.expandedSpanIds.indexOf(spanId);
      if (idx === -1) {
        return { expandedSpanIds: [...state.expandedSpanIds, spanId] };
      } else {
        return {
          expandedSpanIds: state.expandedSpanIds.filter((id) => id !== spanId),
        };
      }
    }),

  setIsAtBottom: (value) => set({ isAtBottom: value }),
  setLoadingHistory: (value) => set({ isLoadingHistory: value }),
  setHasMoreHistory: (value) => set({ hasMoreHistory: value }),

  reset: () =>
    set({
      spans: [],
      childrenMap: {},
      expandedSpanIds: [],
      isAtBottom: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
    }),
}));
