"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { matchesFilters } from "@/lib/filterUtils";
import type { StreamFilters } from "@/types/span";
import { useLiveStreamStore } from "@/stores/liveStreamStore";
import { useFilterStore } from "@/stores/filterStore";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { StreamRow } from "@/components/pulse/StreamRow";
import { ChildSpanRow } from "@/components/pulse/ChildSpanRow";
import {
  itemKey,
  STREAM_ROW_HEIGHT,
  STREAM_SKELETON_WIDTHS,
  type DisplayItem,
} from "@/components/pulse/streamListTypes";

function PulseSkeleton() {
  return (
    <div className="flex flex-col gap-0">
      {STREAM_SKELETON_WIDTHS.map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border/50 px-4 py-2"
        >
          <div className="h-5 w-14 animate-pulse rounded bg-muted" />
          <div
            className="h-4 animate-pulse rounded bg-muted"
            style={{ width: `${w}%` }}
          />
          <div className="ml-auto h-4 w-10 animate-pulse rounded bg-muted" />
          <div className="h-4 w-14 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export interface StreamListProps {
  projectId: string | null;
  initialLoadDone: boolean;
  isHistoricalMode: boolean;
  /** True once the project has ever had spans (SSR, fetch, or live stream). */
  projectHasData: boolean;
  inspectorSpanId: string | null;
  onOpenInspector: (spanId: string) => void;
  onCloseInspector: () => void;
  listContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollAdjustRef: React.MutableRefObject<number>;
  isHistoryPrependRef: React.MutableRefObject<boolean>;
  onLoadHistory: () => void;
  emptyState: ReactNode;
}

function hasServerSideFilters(filters: StreamFilters) {
  return (
    filters.statusGroups.length > 0 ||
    filters.environment !== null ||
    filters.endpointSearch !== ""
  );
}

function StreamListInner({
  projectId,
  initialLoadDone,
  isHistoricalMode,
  projectHasData,
  inspectorSpanId,
  onOpenInspector,
  onCloseInspector,
  listContainerRef,
  scrollAdjustRef,
  isHistoryPrependRef,
  onLoadHistory,
  emptyState,
}: StreamListProps) {
  const spans = useLiveStreamStore((s) => s.spans);
  const childrenMap = useLiveStreamStore((s) => s.childrenMap);
  const expandedSpanIds = useLiveStreamStore((s) => s.expandedSpanIds);
  const isAtBottom = useLiveStreamStore((s) => s.isAtBottom);
  const isLoadingHistory = useLiveStreamStore((s) => s.isLoadingHistory);
  const hasMoreHistory = useLiveStreamStore((s) => s.hasMoreHistory);
  const toggleExpanded = useLiveStreamStore((s) => s.toggleExpanded);
  const setIsAtBottom = useLiveStreamStore((s) => s.setIsAtBottom);

  const filters = useFilterStore((s) => s.filters);

  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const filteredRootSpans = useMemo(
    () => spans.filter((s) => matchesFilters(s, filters)),
    [spans, filters]
  );

  const expandedSet = useMemo(() => new Set(expandedSpanIds), [expandedSpanIds]);

  const displayList: DisplayItem[] = useMemo(() => {
    const items: DisplayItem[] = [];
    for (const root of filteredRootSpans) {
      const children = childrenMap[root.span_id] ?? [];
      const totalCount = 1 + children.length;
      const hasErrorChildren = children.some((c) => c.http_status_code >= 400);
      const isExpanded = expandedSet.has(root.span_id);

      items.push({ type: "root", span: root, childCount: totalCount, hasErrorChildren, isExpanded });

      if (isExpanded) {
        const allRows = [root, ...children];
        for (let i = 0; i < allRows.length; i++) {
          const span = allRows[i];
          const subChildren = childrenMap[span.span_id] ?? [];
          items.push({
            type: "child",
            span,
            depth: 1,
            childCount: subChildren.length,
            isLast: i === allRows.length - 1,
          });
        }
      }
    }
    return items;
  }, [filteredRootSpans, childrenMap, expandedSet]);

  const activeKey = useMemo(() => {
    if (highlightedKey) return highlightedKey;
    if (!inspectorSpanId) return null;
    const match = displayList.find((item) => item.span.span_id === inspectorSpanId);
    return match ? itemKey(match) : null;
  }, [highlightedKey, inspectorSpanId, displayList]);

  const selectedDisplayIndex = useMemo(() => {
    if (!highlightedKey) return -1;
    return displayList.findIndex((item) => itemKey(item) === highlightedKey);
  }, [highlightedKey, displayList]);

  const handleRowClick = useCallback(
    (item: DisplayItem) => {
      setHighlightedKey(itemKey(item));
      onOpenInspector(item.span.span_id);
    },
    [onOpenInspector]
  );

  const moveDown = useCallback(() => {
    if (displayList.length === 0) return;
    const nextIndex =
      selectedDisplayIndex === -1
        ? 0
        : Math.min(selectedDisplayIndex + 1, displayList.length - 1);
    setHighlightedKey(itemKey(displayList[nextIndex]));
  }, [displayList, selectedDisplayIndex]);

  const moveUp = useCallback(() => {
    if (displayList.length === 0) return;
    const nextIndex =
      selectedDisplayIndex === -1
        ? displayList.length - 1
        : Math.max(selectedDisplayIndex - 1, 0);
    setHighlightedKey(itemKey(displayList[nextIndex]));
  }, [displayList, selectedDisplayIndex]);

  useKeyboardShortcut("j", moveDown);
  useKeyboardShortcut("ArrowDown", moveDown);
  useKeyboardShortcut("k", moveUp);
  useKeyboardShortcut("ArrowUp", moveUp);

  useKeyboardShortcut(
    "Enter",
    useCallback(() => {
      if (selectedDisplayIndex >= 0) {
        onOpenInspector(displayList[selectedDisplayIndex].span.span_id);
      }
    }, [selectedDisplayIndex, displayList, onOpenInspector])
  );

  useKeyboardShortcut(
    "Escape",
    useCallback(() => {
      if (inspectorSpanId !== null) {
        onCloseInspector();
        listContainerRef.current?.focus();
      }
    }, [inspectorSpanId, onCloseInspector, listContainerRef]),
    { allowInInputs: true }
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const virtualizer = useVirtualizer({
    count: displayList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => STREAM_ROW_HEIGHT,
    overscan: 8,
  });

  useLayoutEffect(() => {
    if (scrollAdjustRef.current > 0 && parentRef.current) {
      parentRef.current.scrollTop += scrollAdjustRef.current;
      scrollAdjustRef.current = 0;
    }
  });

  const checkScrollPosition = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const threshold = 50;
    const hasScrollableContent = el.scrollHeight > el.clientHeight;
    const atBottom =
      !hasScrollableContent ||
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);

    // Predictive: trigger while there's still ~1 viewport of content above,
    // instead of waiting until the user has visually reached the top —
    // by the time they get there, the next page is already loaded.
    if (hasScrollableContent && el.scrollTop < el.clientHeight) {
      onLoadHistory();
    }
  }, [setIsAtBottom, onLoadHistory]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScrollPosition, { passive: true });
    return () => el.removeEventListener("scroll", checkScrollPosition);
  }, [checkScrollPosition]);

  useEffect(() => {
    const grew = displayList.length > 0 && displayList.length > prevCountRef.current;
    if (isAtBottom && grew && !isHistoryPrependRef.current) {
      virtualizer.scrollToIndex(displayList.length - 1, { align: "end" });
    }
    isHistoryPrependRef.current = false;
    prevCountRef.current = displayList.length;
  }, [displayList.length, isAtBottom, virtualizer, isHistoryPrependRef]);

  // Re-evaluate scroll position after content changes (mount, preset
  // backfill, live growth), not just on a native scroll event — otherwise
  // the first scroll-up gesture after a content change can be missed and
  // nothing loads until the user scrolls down and back up. Deferred one
  // frame so it runs after the auto-scroll-to-bottom effect above (declared
  // first, so it commits first) has applied its own scroll change.
  useEffect(() => {
    const raf = requestAnimationFrame(checkScrollPosition);
    return () => cancelAnimationFrame(raf);
  }, [displayList.length, checkScrollPosition]);

  useEffect(() => {
    if (selectedDisplayIndex >= 0) {
      virtualizer.scrollToIndex(selectedDisplayIndex, { align: "auto" });
    }
  }, [selectedDisplayIndex, virtualizer]);

  function handleBackToLive() {
    virtualizer.scrollToIndex(displayList.length - 1, { align: "end" });
    setIsAtBottom(true);
  }

  const serverFiltersActive = hasServerSideFilters(filters);

  const showSkeleton =
    !projectId ||
    !initialLoadDone ||
    (isLoadingHistory && spans.length === 0);
  const showOnboarding =
    initialLoadDone &&
    spans.length === 0 &&
    !isHistoricalMode &&
    !serverFiltersActive &&
    !isLoadingHistory &&
    !projectHasData;
  const showFilteredEmpty =
    initialLoadDone &&
    spans.length === 0 &&
    !isHistoricalMode &&
    serverFiltersActive &&
    !isLoadingHistory;
  const showWindowEmpty =
    initialLoadDone &&
    spans.length === 0 &&
    !isHistoricalMode &&
    !serverFiltersActive &&
    !isLoadingHistory &&
    projectHasData;
  const showHistoricalEmpty =
    initialLoadDone && spans.length === 0 && isHistoricalMode && !isLoadingHistory;
  const showList = initialLoadDone && spans.length > 0;
  const showNoResults = showList && filteredRootSpans.length === 0;

  return (
    <div className="relative h-full">
      <div
        ref={(el) => {
          (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (listContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        tabIndex={-1}
        role="list"
        aria-label="Request stream"
        className="h-full overflow-auto outline-none"
      >
        {showSkeleton && <PulseSkeleton />}
        {showOnboarding && emptyState}
        {showFilteredEmpty && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">No matching requests</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                No spans match your filters in the selected time window
              </p>
            </div>
          </div>
        )}
        {showWindowEmpty && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">No requests in this time range</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Try a wider time window or wait for new traffic
              </p>
            </div>
          </div>
        )}
        {showHistoricalEmpty && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">No requests in this time range</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Try a different date range or check your filters
              </p>
            </div>
          </div>
        )}
        {showNoResults && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">No matching requests</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Try adjusting your filters</p>
            </div>
          </div>
        )}
        {showList && !showNoResults && !isLoadingHistory && !hasMoreHistory && (
          <div className="border-b border-border/50 bg-muted/30 px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              No older items in the selected time window.
            </p>
          </div>
        )}
        {showList && !showNoResults && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {isLoadingHistory && (
              <div className="absolute left-0 top-0 z-10 w-full">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b border-border/50 bg-background px-4 py-2"
                  >
                    <div className="h-5 w-14 animate-pulse rounded bg-muted" />
                    <div
                      className="h-4 animate-pulse rounded bg-muted"
                      style={{ width: `${STREAM_SKELETON_WIDTHS[i]}%` }}
                    />
                    <div className="ml-auto h-4 w-10 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            )}

            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = displayList[virtualRow.index];
              const isNew =
                virtualRow.index >= prevCountRef.current - 1 &&
                virtualRow.index === displayList.length - 1;

              const rowContent =
                item.type === "root" ? (
                  <StreamRow
                    span={item.span}
                    isSelected={itemKey(item) === activeKey}
                    childCount={item.childCount}
                    hasErrorChildren={item.hasErrorChildren}
                    isExpanded={item.isExpanded}
                    onToggleExpand={() => toggleExpanded(item.span.span_id)}
                    onClick={() => handleRowClick(item)}
                  />
                ) : (
                  <ChildSpanRow
                    span={item.span}
                    depth={item.depth}
                    childCount={item.childCount}
                    isLast={item.isLast}
                    isSelected={itemKey(item) === activeKey}
                    onClick={() => handleRowClick(item)}
                  />
                );

              return (
                <div
                  key={itemKey(item)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {isNew ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      {rowContent}
                    </motion.div>
                  ) : (
                    rowContent
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {!isAtBottom && filteredRootSpans.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={handleBackToLive}
            className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowDown className="size-4" />
            Back to Live
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export const StreamList = memo(StreamListInner);
