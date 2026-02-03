"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "framer-motion";
import { Wifi, WifiOff, Radio, BookOpen } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import type { SpanEvent } from "@/types/span";
import { useEventStream } from "@/hooks/useEventStream";
import { useLiveStreamStore } from "@/stores/liveStreamStore";
import { StreamRow } from "@/components/pulse/StreamRow";

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
  const addSpan = useLiveStreamStore((s) => s.addSpan);
  const setIsAtBottom = useLiveStreamStore((s) => s.setIsAtBottom);
  const reset = useLiveStreamStore((s) => s.reset);

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

  // --- TanStack Virtual ---
  const parentRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const virtualizer = useVirtualizer({
    count: spans.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  // Track scroll position to detect "at bottom" (live position)
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    function handleScroll() {
      if (!el) return;
      const threshold = 50;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setIsAtBottom(atBottom);
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [setIsAtBottom]);

  // Auto-scroll when at bottom and new spans arrive (AC2)
  useEffect(() => {
    if (isAtBottom && spans.length > 0 && spans.length > prevCountRef.current) {
      virtualizer.scrollToIndex(spans.length - 1, { align: "end" });
    }
    prevCountRef.current = spans.length;
  }, [spans.length, isAtBottom, virtualizer]);

  // Determine what to show
  const showSkeleton = loading;
  const showEmpty = !loading && status === "connected" && spans.length === 0;
  const showList = !loading && spans.length > 0;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 48px)" }}>
      <LiveHeader status={status} spanCount={spans.length} />
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
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
                      <StreamRow span={span} />
                    </motion.div>
                  ) : (
                    <StreamRow span={span} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
