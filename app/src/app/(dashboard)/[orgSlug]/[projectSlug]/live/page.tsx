"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Radio, BookOpen, ArrowDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import type { SpanEvent } from "@/types/span";
import { useEventStream } from "@/hooks/useEventStream";
import { useSpanDetail } from "@/hooks/useSpanDetail";
import { useLiveStreamStore } from "@/stores/liveStreamStore";
import { StreamRow } from "@/components/pulse/StreamRow";
import { SpanInspector } from "@/components/pulse/SpanInspector";

interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_at: string;
}

const ROW_HEIGHT = 40;

// Pre-computed widths for skeleton rows (pure — no Math.random during render)
const SKELETON_WIDTHS = [55, 42, 68, 47, 60, 50, 63, 45, 57, 52, 65, 48];

// --- Skeleton Loading (AC4, UX7) ---

function PulseSkeleton() {
  return (
    <div className="flex flex-col gap-0">
      {SKELETON_WIDTHS.map((w, i) => (
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

// --- Empty State (AC4, UX6) ---

function EmptyState({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Radio className="mx-auto size-10 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No requests yet</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Once your application sends requests through the Tracely SDK, they
          will appear here in real time.
        </p>
        <a
          href={`/${orgSlug}/${projectSlug}/onboarding`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <BookOpen className="size-4" />
          Go to setup guide
        </a>
      </div>
    </div>
  );
}

// --- Live Header (40px, AC1 UX12) ---

function LiveHeader({
  status,
  spanCount,
}: {
  status: "connecting" | "connected" | "disconnected";
  spanCount: number;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Pulse View</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {spanCount > 0 && `${spanCount.toLocaleString()} requests`}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {status === "connected" ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <Wifi className="size-3.5 text-emerald-500" />
            <span className="text-xs text-emerald-600">Live</span>
          </>
        ) : status === "connecting" ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <Wifi className="size-3.5 text-amber-500" />
            <span className="text-xs text-amber-600">Connecting...</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <WifiOff className="size-3.5 text-red-500" />
            <span className="text-xs text-red-600">Disconnected</span>
          </>
        )}
      </div>
    </div>
  );
}

// --- Main Pulse View Page ---

export default function LivePage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { orgSlug, projectSlug } = params;

  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const spans = useLiveStreamStore((s) => s.spans);
  const isAtBottom = useLiveStreamStore((s) => s.isAtBottom);
  const isLoadingHistory = useLiveStreamStore((s) => s.isLoadingHistory);
  const hasMoreHistory = useLiveStreamStore((s) => s.hasMoreHistory);
  const addSpan = useLiveStreamStore((s) => s.addSpan);
  const prependSpans = useLiveStreamStore((s) => s.prependSpans);
  const setIsAtBottom = useLiveStreamStore((s) => s.setIsAtBottom);
  const setLoadingHistory = useLiveStreamStore((s) => s.setLoadingHistory);
  const setHasMoreHistory = useLiveStreamStore((s) => s.setHasMoreHistory);
  const reset = useLiveStreamStore((s) => s.reset);

  // --- Span Inspector state (Story 3.3) ---
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const inspectorOpen = selectedSpanId !== null;
  const { detail: spanDetail, loading: detailLoading, error: detailError } =
    useSpanDetail(orgSlug, projectSlug, selectedSpanId);

  // Escape key closes inspector (AC5, UX3)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && inspectorOpen) {
        setSelectedSpanId(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [inspectorOpen]);

  // Fetch project UUID for SSE endpoint
  useEffect(() => {
    let cancelled = false;
    async function loadProject() {
      try {
        const res = await apiFetch<DataEnvelope<ProjectInfo>>(
          `/api/orgs/${orgSlug}/projects/${projectSlug}`
        );
        if (!cancelled) setProjectId(res.data.id);
      } catch {
        // Non-blocking — SSE won't connect without project ID
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProject();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, projectSlug]);

  // Reset store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  // SSE: push spans into Zustand store
  const handleSpan = useCallback(
    (data: Record<string, unknown>) => {
      addSpan(data as unknown as SpanEvent);
    },
    [addSpan]
  );

  const { status } = useEventStream({
    projectId: projectId ?? "",
    enabled: projectId !== null,
    onSpan: handleSpan,
  });

  // --- History loading (AC1) ---
  const fetchingRef = useRef(false);
  const scrollAdjustRef = useRef(0);

  const loadHistory = useCallback(async () => {
    if (fetchingRef.current || !projectId || !hasMoreHistory) return;
    fetchingRef.current = true;
    setLoadingHistory(true);

    const currentSpans = useLiveStreamStore.getState().spans;
    const oldest = currentSpans.length > 0 ? currentSpans[0].start_time : undefined;

    try {
      const url =
        `/api/orgs/${orgSlug}/projects/${projectSlug}/spans?limit=50` +
        (oldest ? `&before=${encodeURIComponent(oldest)}` : "");
      const res = await apiFetch<DataEnvelope<SpanEvent[]>>(url);
      const fetched = res.data;

      if (fetched.length === 0) {
        setHasMoreHistory(false);
      } else {
        // API returns newest-first; reverse for chronological prepend
        const chronological = [...fetched].reverse();
        scrollAdjustRef.current = chronological.length * ROW_HEIGHT;
        prependSpans(chronological);

        const meta = res.meta as { has_more?: boolean };
        if (!meta.has_more) {
          setHasMoreHistory(false);
        }
      }
    } catch {
      // Non-blocking — user can retry by scrolling up again
    } finally {
      setLoadingHistory(false);
      fetchingRef.current = false;
    }
  }, [projectId, hasMoreHistory, orgSlug, projectSlug, prependSpans, setLoadingHistory, setHasMoreHistory]);

  // --- TanStack Virtual ---
  const parentRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const virtualizer = useVirtualizer({
    count: spans.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  // Adjust scroll position after history prepend to prevent jumping (AC1)
  useLayoutEffect(() => {
    if (scrollAdjustRef.current > 0 && parentRef.current) {
      parentRef.current.scrollTop += scrollAdjustRef.current;
      scrollAdjustRef.current = 0;
    }
  });

  // Track scroll position to detect "at bottom" and "near top" for history loading
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    function handleScroll() {
      if (!el) return;
      const threshold = 50;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setIsAtBottom(atBottom);

      // Trigger history loading when scrolled near top (AC1)
      if (el.scrollTop < 100) {
        loadHistory();
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [setIsAtBottom, loadHistory]);

  // Auto-scroll when at bottom and new spans arrive (AC2)
  useEffect(() => {
    if (isAtBottom && spans.length > 0 && spans.length > prevCountRef.current) {
      virtualizer.scrollToIndex(spans.length - 1, { align: "end" });
    }
    prevCountRef.current = spans.length;
  }, [spans.length, isAtBottom, virtualizer]);

  // Back to Live handler (AC3)
  function handleBackToLive() {
    virtualizer.scrollToIndex(spans.length - 1, { align: "end" });
    setIsAtBottom(true);
  }

  // Determine what to show
  const showSkeleton = loading;
  const showEmpty = !loading && status === "connected" && spans.length === 0;
  const showList = !loading && spans.length > 0;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 48px)" }}>
      <LiveHeader status={status} spanCount={spans.length} />
      <div className="relative flex flex-1 overflow-hidden">
        {/* Stream list — compresses to 40% when inspector is open (AC1, UX2) */}
        <div className={inspectorOpen ? "w-2/5 hidden md:block" : "w-full"}>
          <div className="relative h-full">
            <div
              ref={parentRef}
              className="h-full overflow-auto"
            >
              {showSkeleton && <PulseSkeleton />}
              {showEmpty && <EmptyState orgSlug={orgSlug} projectSlug={projectSlug} />}
              {showList && (
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {/* History loading skeleton at top (AC1, UX7) */}
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
                            style={{ width: `${SKELETON_WIDTHS[i]}%` }}
                          />
                          <div className="ml-auto h-4 w-10 animate-pulse rounded bg-muted" />
                          <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                        </div>
                      ))}
                    </div>
                  )}

                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const span = spans[virtualRow.index];
                    const isNew =
                      virtualRow.index >= prevCountRef.current - 1 &&
                      virtualRow.index === spans.length - 1;

                    return (
                      <div
                        key={span.span_id}
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
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.15 }}
                          >
                            <StreamRow
                              span={span}
                              isSelected={span.span_id === selectedSpanId}
                              onClick={() => setSelectedSpanId(span.span_id)}
                            />
                          </motion.div>
                        ) : (
                          <StreamRow
                            span={span}
                            isSelected={span.span_id === selectedSpanId}
                            onClick={() => setSelectedSpanId(span.span_id)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Back to Live floating button (AC2, AC3, UX17) */}
            <AnimatePresence>
              {!isAtBottom && spans.length > 0 && (
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
        </div>

        {/* Span Inspector panel — 60% on desktop, full overlay on mobile (AC1, UX2) */}
        {inspectorOpen && (
          <div className="absolute inset-0 z-30 md:relative md:z-auto md:w-3/5">
            <SpanInspector
              detail={spanDetail}
              loading={detailLoading}
              error={detailError}
              onClose={() => setSelectedSpanId(null)}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
            />
          </div>
        )}
      </div>
    </div>
  );
}
