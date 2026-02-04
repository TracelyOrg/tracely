"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, ArrowDown, Check, Copy, Terminal, Code, BookOpen, RefreshCw, Clock, Search, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import type { SpanEvent, TimeRangePreset } from "@/types/span";
import { useEventStream } from "@/hooks/useEventStream";
import { useSpanDetail } from "@/hooks/useSpanDetail";
import { useLiveStreamStore } from "@/stores/liveStreamStore";
import { useFilterStore } from "@/stores/filterStore";
import { matchesFilters } from "@/lib/filterUtils";
import { cn } from "@/lib/utils";
import { StreamRow } from "@/components/pulse/StreamRow";
import { ChildSpanRow } from "@/components/pulse/ChildSpanRow";
import { SpanInspector } from "@/components/pulse/SpanInspector";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

type DisplayItem =
  | { type: "root"; span: SpanEvent; childCount: number; hasErrorChildren: boolean; isExpanded: boolean }
  | { type: "child"; span: SpanEvent; depth: number; childCount: number };

interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_at: string;
}

interface ApiKeyItem {
  id: string;
  prefix: string;
  name: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface ApiKeyCreatedResponse {
  id: string;
  key: string;
  prefix: string;
  name: string | null;
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

// --- Helpers for Empty State ---

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="rounded-lg border bg-muted/50">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground font-mono">
          {language || "shell"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="text-sm font-mono">{code}</code>
      </pre>
    </div>
  );
}

// --- Empty State (AC4, UX6) ---

function EmptyState({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [keyPrefix, setKeyPrefix] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const initRef = useRef(false);

  const basePath = `/api/orgs/${orgSlug}/projects/${projectSlug}/api-keys`;

  // Generate a new key and display the full value
  const generateKey = useCallback(async () => {
    setRegenerating(true);
    try {
      const created = await apiFetch<DataEnvelope<ApiKeyCreatedResponse>>(
        basePath,
        { method: "POST", body: JSON.stringify({ name: "Default" }) }
      );
      setFullKey(created.data.key);
      setKeyPrefix(created.data.prefix);
    } catch {
      // Non-blocking
    } finally {
      setRegenerating(false);
    }
  }, [basePath]);

  // On mount: if no keys → auto-generate; if keys exist → show prefix
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        const res = await apiFetch<DataEnvelope<ApiKeyItem[]>>(basePath);
        if (res.data.length > 0) {
          setKeyPrefix(res.data[0].prefix);
        } else {
          generateKey();
        }
      } catch {
        // Non-blocking
      }
    }
    init();
  }, [basePath, generateKey]);

  const hasFullKey = fullKey !== null;
  const displayKey = fullKey ?? (keyPrefix ? `${keyPrefix}...` : "your_api_key_here");
  const installSnippet = `pip install tracely-sdk
export TRACELY_API_KEY="${displayKey}"`;

  const configSnippet = `import tracely

tracely.init()  # reads TRACELY_API_KEY from env`;

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center">
          <h3 className="text-lg font-medium">Get started</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Install the SDK and send your first event to see it here in real time.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Terminal className="size-4 text-muted-foreground" />
              1. Install &amp; configure
            </div>
            {!hasFullKey && keyPrefix && (
              <button
                onClick={generateKey}
                disabled={regenerating}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${regenerating ? "animate-spin" : ""}`} />
                {regenerating ? "Generating..." : "Regenerate key"}
              </button>
            )}
          </div>
          <CodeBlock code={installSnippet} language="shell" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Code className="size-4 text-muted-foreground" />
            2. Add to your app
          </div>
          <CodeBlock code={configSnippet} language="python" />
        </div>

        <div className="text-center">
          <a
            href={`/${orgSlug}/${projectSlug}/onboarding`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <BookOpen className="size-4" />
            Full setup guide
          </a>
        </div>
      </div>
    </div>
  );
}

// --- Time Presets ---

const TIME_PRESETS: { key: TimeRangePreset; label: string }[] = [
  { key: "15m", label: "15m" },
  { key: "1h", label: "1h" },
  { key: "6h", label: "6h" },
  { key: "24h", label: "24h" },
  { key: "custom", label: "Custom" },
];

// --- Live Header (40px, AC1 UX12, Story 11.2) ---

function LiveHeader({
  status,
  spanCount,
  isHistorical,
  environments,
  onTimePreset,
  onCustomStart,
  onCustomEnd,
}: {
  status: "connecting" | "connected" | "disconnected";
  spanCount: number;
  isHistorical?: boolean;
  environments: string[];
  onTimePreset: (preset: TimeRangePreset) => void;
  onCustomStart: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCustomEnd: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const filters = useFilterStore((s) => s.filters);
  const setEnvironment = useFilterStore((s) => s.setEnvironment);
  const [searchExpanded, setSearchExpanded] = useState(false);

  return (
    <div className="sticky top-0 z-10 flex h-10 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur-sm">
      {/* Left: Timeframe presets */}
      <div className="flex items-center gap-0.5 overflow-x-auto" data-testid="header-time-range">
        <Clock className="mr-1 size-3.5 shrink-0 text-muted-foreground" />
        {TIME_PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onTimePreset(key)}
            className={cn(
              "h-6 shrink-0 rounded-md px-2 text-xs font-medium transition-colors",
              filters.timeRange.preset === key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            data-testid={`header-time-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom time range inputs */}
      {filters.timeRange.preset === "custom" && (
        <div className="flex items-center gap-1" data-testid="header-custom-range">
          <input
            type="datetime-local"
            onChange={onCustomStart}
            className="h-7 rounded-md border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="header-custom-start"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="datetime-local"
            onChange={onCustomEnd}
            className="h-7 rounded-md border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="header-custom-end"
          />
        </div>
      )}

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Search input (non-functional, AC1) */}
      <div className="hidden md:block">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search with filters..."
            readOnly
            className="h-7 min-w-[250px] max-w-[400px] rounded-md border bg-background pl-8 pr-3 text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            data-testid="header-search"
          />
        </div>
      </div>
      {/* Mobile: search icon button */}
      <button
        className="flex md:hidden shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        onClick={() => setSearchExpanded(!searchExpanded)}
        data-testid="header-search-mobile"
      >
        <Search className="size-3.5" />
      </button>

      {/* Mobile expanded search overlay */}
      {searchExpanded && (
        <div className="absolute left-0 top-10 z-20 flex w-full items-center gap-2 border-b bg-background px-4 py-2 md:hidden">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search with filters..."
            readOnly
            autoFocus
            className="h-7 flex-1 rounded-md border bg-background px-3 text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button
            onClick={() => setSearchExpanded(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side: Environment dropdown + Connection status + Count */}
      <div className="relative" data-testid="header-env-selector">
        <select
          value={filters.environment ?? ""}
          onChange={(e) => setEnvironment(e.target.value === "" ? null : e.target.value)}
          className="h-7 appearance-none rounded-md border bg-background pl-2 pr-6 text-xs transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Envs</option>
          {environments.map((env) => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      </div>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        {isHistorical ? (
          <>
            <Clock className="size-3.5 text-violet-500" />
            <span className="text-xs text-violet-600">Historical</span>
          </>
        ) : status === "connected" ? (
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

      {/* Request count */}
      <span className="text-xs text-muted-foreground tabular-nums" data-testid="header-span-count">
        {spanCount > 0 && `${spanCount.toLocaleString()} requests`}
      </span>
    </div>
  );
}

// --- Main Pulse View Page ---

export default function LivePage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { orgSlug, projectSlug } = params;

  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const spans = useLiveStreamStore((s) => s.spans);
  const childrenMap = useLiveStreamStore((s) => s.childrenMap);
  const expandedSpanIds = useLiveStreamStore((s) => s.expandedSpanIds);
  const isAtBottom = useLiveStreamStore((s) => s.isAtBottom);
  const isLoadingHistory = useLiveStreamStore((s) => s.isLoadingHistory);
  const hasMoreHistory = useLiveStreamStore((s) => s.hasMoreHistory);
  const addSpan = useLiveStreamStore((s) => s.addSpan);
  const prependSpans = useLiveStreamStore((s) => s.prependSpans);
  const toggleExpanded = useLiveStreamStore((s) => s.toggleExpanded);
  const setIsAtBottom = useLiveStreamStore((s) => s.setIsAtBottom);
  const setLoadingHistory = useLiveStreamStore((s) => s.setLoadingHistory);
  const setHasMoreHistory = useLiveStreamStore((s) => s.setHasMoreHistory);
  const reset = useLiveStreamStore((s) => s.reset);

  // --- Filter state (Story 3.5, 11.2) ---
  const filters = useFilterStore((s) => s.filters);
  const setTimeRange = useFilterStore((s) => s.setTimeRange);

  // Extract unique environments from span buffer (Task 5)
  const environments = useMemo(() => {
    const envs = [...new Set(spans.map((s) => s.environment).filter(Boolean))].sort();
    return envs.length > 0 ? envs : ["unknown"];
  }, [spans]);

  // Timeframe handling (migrated from FilterBar)
  const handleTimePreset = useCallback(
    (preset: TimeRangePreset) => {
      if (preset === "custom") {
        setTimeRange({ preset: "custom" });
      } else {
        setTimeRange({ preset });
      }
    },
    [setTimeRange]
  );

  const handleCustomStart = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value ? new Date(e.target.value).toISOString() : undefined;
      setTimeRange({ preset: "custom", start: iso, end: filters.timeRange.end });
    },
    [setTimeRange, filters.timeRange.end]
  );

  const handleCustomEnd = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value ? new Date(e.target.value).toISOString() : undefined;
      setTimeRange({ preset: "custom", start: filters.timeRange.start, end: iso });
    },
    [setTimeRange, filters.timeRange.start]
  );

  // Filter root spans only (children inherit parent visibility)
  const filteredRootSpans = useMemo(
    () => spans.filter((s) => matchesFilters(s, filters)),
    [spans, filters]
  );

  // Build flat display list: root spans + expanded children
  const expandedSet = useMemo(() => new Set(expandedSpanIds), [expandedSpanIds]);

  const displayList: DisplayItem[] = useMemo(() => {
    const items: DisplayItem[] = [];
    for (const root of filteredRootSpans) {
      const children = childrenMap[root.span_id] ?? [];
      const childCount = children.length;
      const hasErrorChildren = children.some((c) => c.http_status_code >= 400);
      const isExpanded = expandedSet.has(root.span_id);

      items.push({ type: "root", span: root, childCount, hasErrorChildren, isExpanded });

      if (isExpanded && childCount > 0) {
        for (const child of children) {
          const subChildren = childrenMap[child.span_id] ?? [];
          items.push({ type: "child", span: child, depth: 1, childCount: subChildren.length });
        }
      }
    }
    return items;
  }, [filteredRootSpans, childrenMap, expandedSet]);

  // Backward-compatible alias used by existing code (auto-scroll, counts, empty state)
  const filteredSpans = filteredRootSpans;

  // Historical mode: custom time range with both start and end set (AC5)
  const isHistoricalMode =
    filters.timeRange.preset === "custom" &&
    !!filters.timeRange.start &&
    !!filters.timeRange.end;

  // --- Filter URL sync (UX16) ---
  const searchParams = useSearchParams();
  const filterReset = useFilterStore((s) => s.reset);

  // Hydrate filter store from URL params on mount
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const time = searchParams.get("time");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const env = searchParams.get("env");

    const store = useFilterStore.getState();
    if (time) {
      const validPresets = new Set(["15m", "1h", "6h", "24h", "custom"]);
      if (validPresets.has(time)) {
        store.setTimeRange({
          preset: time as TimeRangePreset,
          start: start ?? undefined,
          end: end ?? undefined,
        });
      }
    }
    if (env) store.setEnvironment(env);
  }, [searchParams]);

  // Sync filters to URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.timeRange.preset !== "15m") params.set("time", filters.timeRange.preset);
    if (filters.timeRange.start) params.set("start", filters.timeRange.start);
    if (filters.timeRange.end) params.set("end", filters.timeRange.end);
    if (filters.environment) params.set("env", filters.environment);

    const search = params.toString();
    const newUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  }, [filters]);

  // Reset filters on org/project switch (UX16, AC4)
  const contextKeyRef = useRef(`${orgSlug}/${projectSlug}`);
  useEffect(() => {
    const key = `${orgSlug}/${projectSlug}`;
    if (contextKeyRef.current !== key) {
      contextKeyRef.current = key;
      filterReset();
    }
  }, [orgSlug, projectSlug, filterReset]);

  // --- Selection & Inspector state (Story 3.3 + 3.6) ---
  // highlightedSpanId: keyboard/click highlight (J/K navigation, AC2)
  // inspectorSpanId: which span has its inspector open (Enter to open, Escape to close)
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | null>(null);
  const [inspectorSpanId, setInspectorSpanId] = useState<string | null>(null);
  const inspectorOpen = inspectorSpanId !== null;
  const { detail: spanDetail, loading: detailLoading, error: detailError } =
    useSpanDetail(orgSlug, projectSlug, inspectorSpanId);

  // The "active" span for row highlighting is either the highlighted span or the inspector span
  const activeSpanId = highlightedSpanId ?? inspectorSpanId;

  // Ref for returning focus to the stream list (AC4, UX3)
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Click handler: highlight + open inspector (preserves existing behavior)
  const handleRowClick = useCallback((spanId: string) => {
    setHighlightedSpanId(spanId);
    setInspectorSpanId(spanId);
  }, []);

  // --- Keyboard Navigation (Story 3.6, AC2/AC3/AC4, UX3) ---

  // Compute selected index from highlighted span for keyboard navigation
  const selectedIndex = useMemo(() => {
    if (!highlightedSpanId) return -1;
    return filteredSpans.findIndex((s) => s.span_id === highlightedSpanId);
  }, [highlightedSpanId, filteredSpans]);

  // J / ArrowDown — move selection down (AC2)
  const moveDown = useCallback(() => {
    if (filteredSpans.length === 0) return;
    const nextIndex = selectedIndex === -1 ? 0 : Math.min(selectedIndex + 1, filteredSpans.length - 1);
    setHighlightedSpanId(filteredSpans[nextIndex].span_id);
  }, [filteredSpans, selectedIndex]);

  // K / ArrowUp — move selection up (AC2)
  const moveUp = useCallback(() => {
    if (filteredSpans.length === 0) return;
    const nextIndex = selectedIndex === -1 ? filteredSpans.length - 1 : Math.max(selectedIndex - 1, 0);
    setHighlightedSpanId(filteredSpans[nextIndex].span_id);
  }, [filteredSpans, selectedIndex]);

  useKeyboardShortcut("j", moveDown);
  useKeyboardShortcut("ArrowDown", moveDown);
  useKeyboardShortcut("k", moveUp);
  useKeyboardShortcut("ArrowUp", moveUp);

  // Enter — open inspector for highlighted span (AC3)
  useKeyboardShortcut("Enter", useCallback(() => {
    if (highlightedSpanId) {
      setInspectorSpanId(highlightedSpanId);
    }
  }, [highlightedSpanId]));

  // Escape — close inspector and return focus to list (AC4, UX3)
  useKeyboardShortcut("Escape", useCallback(() => {
    if (inspectorOpen) {
      setInspectorSpanId(null);
      listContainerRef.current?.focus();
    }
  }, [inspectorOpen]), { allowInInputs: true });

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

  // Load recent spans on initial page load so the list isn't empty
  useEffect(() => {
    if (!projectId || initialLoadDone || isHistoricalMode) return;

    let cancelled = false;
    async function loadInitial() {
      try {
        const url = `/api/orgs/${orgSlug}/projects/${projectSlug}/spans?limit=50`;
        const res = await apiFetch<DataEnvelope<SpanEvent[]>>(url);
        if (cancelled) return;
        const fetched = res.data;

        if (fetched.length > 0) {
          const chronological = [...fetched].reverse();
          prependSpans(chronological);

          const meta = res.meta as { has_more?: boolean };
          if (!meta.has_more) {
            setHasMoreHistory(false);
          }
        } else {
          setHasMoreHistory(false);
        }
      } catch {
        // Non-blocking
      } finally {
        if (!cancelled) setInitialLoadDone(true);
      }
    }

    loadInitial();
    return () => { cancelled = true; };
  }, [projectId, initialLoadDone, isHistoricalMode, orgSlug, projectSlug, prependSpans, setHasMoreHistory]);

  // Live stream announcement for screen readers (AC6, UX11)
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  // SSE: push spans into Zustand store
  const handleSpan = useCallback(
    (data: Record<string, unknown>) => {
      const span = data as unknown as SpanEvent;
      addSpan(span);
      // Announce new span for screen readers
      if (span.span_type !== "pending_span") {
        setLiveAnnouncement(
          `New request: ${span.http_method} ${span.http_route || span.span_name}, status ${span.http_status_code}`
        );
      }
    },
    [addSpan]
  );

  const { status } = useEventStream({
    projectId: projectId ?? "",
    enabled: projectId !== null && !isHistoricalMode,
    onSpan: handleSpan,
  });

  // --- History loading (AC1) ---
  const fetchingRef = useRef(false);
  const scrollAdjustRef = useRef(0);

  /** Build filter query params for server-side filtering in historical mode. */
  const buildFilterParams = useCallback(() => {
    const params: string[] = [];
    if (filters.environment) params.push(`environment=${encodeURIComponent(filters.environment)}`);
    return params.length > 0 ? `&${params.join("&")}` : "";
  }, [filters.environment]);

  const loadHistory = useCallback(async () => {
    if (fetchingRef.current || !projectId || !hasMoreHistory) return;
    fetchingRef.current = true;
    setLoadingHistory(true);

    const currentSpans = useLiveStreamStore.getState().spans;
    const oldest = currentSpans.length > 0 ? currentSpans[0].start_time : undefined;

    try {
      let url =
        `/api/orgs/${orgSlug}/projects/${projectSlug}/spans?limit=50` +
        (oldest ? `&before=${encodeURIComponent(oldest)}` : "");

      // In historical mode, bound the query to the custom range and apply server-side filters
      if (isHistoricalMode) {
        if (filters.timeRange.start) url += `&after=${encodeURIComponent(filters.timeRange.start)}`;
        url += buildFilterParams();
      }

      const res = await apiFetch<DataEnvelope<SpanEvent[]>>(url);
      const fetched = res.data;

      if (fetched.length === 0) {
        setHasMoreHistory(false);
      } else {
        // API returns newest-first; reverse for chronological prepend
        const chronological = [...fetched].reverse();
        // Only root spans affect scroll position (children are collapsed by default)
        const rootCount = chronological.filter((s) => !s.parent_span_id || s.parent_span_id === "").length;
        scrollAdjustRef.current = rootCount * ROW_HEIGHT;
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
  }, [projectId, hasMoreHistory, orgSlug, projectSlug, prependSpans, setLoadingHistory, setHasMoreHistory, isHistoricalMode, filters.timeRange.start, buildFilterParams]);

  // --- Historical mode: initial fetch on entry (AC5) ---
  const prevHistoricalRef = useRef(false);
  useEffect(() => {
    if (isHistoricalMode && !prevHistoricalRef.current && projectId) {
      // Entering historical mode — reset store and fetch first page
      reset();
      setHasMoreHistory(true);

      async function fetchInitialPage() {
        fetchingRef.current = true;
        setLoadingHistory(true);

        try {
          const url =
            `/api/orgs/${orgSlug}/projects/${projectSlug}/spans?limit=50` +
            `&after=${encodeURIComponent(filters.timeRange.start!)}` +
            `&before=${encodeURIComponent(filters.timeRange.end!)}` +
            buildFilterParams();

          const res = await apiFetch<DataEnvelope<SpanEvent[]>>(url);
          const fetched = res.data;

          if (fetched.length > 0) {
            // API returns newest-first; reverse for chronological display
            const chronological = [...fetched].reverse();
            prependSpans(chronological);

            const meta = res.meta as { has_more?: boolean };
            if (!meta.has_more) {
              setHasMoreHistory(false);
            }
          } else {
            setHasMoreHistory(false);
          }
        } catch {
          // Non-blocking
        } finally {
          setLoadingHistory(false);
          fetchingRef.current = false;
        }
      }

      fetchInitialPage();
    } else if (!isHistoricalMode && prevHistoricalRef.current) {
      // Leaving historical mode — reset store (SSE will auto-reconnect)
      reset();
      setHasMoreHistory(true);
    }
    prevHistoricalRef.current = isHistoricalMode;
  }, [isHistoricalMode, projectId, orgSlug, projectSlug, filters.timeRange.start, filters.timeRange.end, reset, prependSpans, setLoadingHistory, setHasMoreHistory, buildFilterParams]);

  // --- TanStack Virtual ---
  const parentRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const virtualizer = useVirtualizer({
    count: displayList.length,
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
    if (isAtBottom && displayList.length > 0 && displayList.length > prevCountRef.current) {
      virtualizer.scrollToIndex(displayList.length - 1, { align: "end" });
    }
    prevCountRef.current = displayList.length;
  }, [displayList.length, isAtBottom, virtualizer]);

  // Auto-scroll selected row into view when keyboard-navigating (AC2, Story 3.6)
  // Map root span index to displayList index (accounts for expanded children)
  const selectedDisplayIndex = useMemo(() => {
    if (!highlightedSpanId) return -1;
    return displayList.findIndex(
      (item) => item.type === "root" && item.span.span_id === highlightedSpanId
    );
  }, [highlightedSpanId, displayList]);

  useEffect(() => {
    if (selectedDisplayIndex >= 0) {
      virtualizer.scrollToIndex(selectedDisplayIndex, { align: "auto" });
    }
  }, [selectedDisplayIndex, virtualizer]);

  // Back to Live handler (AC3)
  function handleBackToLive() {
    virtualizer.scrollToIndex(displayList.length - 1, { align: "end" });
    setIsAtBottom(true);
  }

  // Determine what to show
  const showSkeleton = loading || !initialLoadDone;
  const showEmpty = !loading && initialLoadDone && spans.length === 0;
  const showList = !loading && initialLoadDone && spans.length > 0;
  const showNoResults = showList && filteredSpans.length === 0;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 48px)" }}>
      {/* Screen reader live region for new span announcements (AC6, UX11) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>
      <LiveHeader
        status={status}
        spanCount={filteredSpans.length}
        isHistorical={isHistoricalMode}
        environments={environments}
        onTimePreset={handleTimePreset}
        onCustomStart={handleCustomStart}
        onCustomEnd={handleCustomEnd}
      />
      <div className="relative flex flex-1 overflow-hidden">
        {/* Stream list — compresses to 40% when inspector is open (AC1, UX2) */}
        <div className={inspectorOpen ? "w-2/5 hidden md:block" : "w-full"}>
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
              {showEmpty && <EmptyState orgSlug={orgSlug} projectSlug={projectSlug} />}
              {showNoResults && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">No matching requests</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Try adjusting your filters</p>
                  </div>
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
                    const item = displayList[virtualRow.index];
                    const isNew =
                      virtualRow.index >= prevCountRef.current - 1 &&
                      virtualRow.index === displayList.length - 1;

                    const rowContent =
                      item.type === "root" ? (
                        <StreamRow
                          span={item.span}
                          isSelected={item.span.span_id === activeSpanId}
                          childCount={item.childCount}
                          hasErrorChildren={item.hasErrorChildren}
                          isExpanded={item.isExpanded}
                          onToggleExpand={() => toggleExpanded(item.span.span_id)}
                          onClick={() => handleRowClick(item.span.span_id)}
                        />
                      ) : (
                        <ChildSpanRow
                          span={item.span}
                          depth={item.depth}
                          childCount={item.childCount}
                          isSelected={item.span.span_id === activeSpanId}
                          onClick={() => handleRowClick(item.span.span_id)}
                        />
                      );

                    return (
                      <div
                        key={`${item.type}-${item.span.span_id}`}
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

            {/* Back to Live floating button (AC2, AC3, UX17) */}
            <AnimatePresence>
              {!isAtBottom && filteredSpans.length > 0 && (
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
              onClose={() => setInspectorSpanId(null)}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
            />
          </div>
        )}
      </div>
    </div>
  );
}
