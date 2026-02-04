import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { TraceSpanEvent } from "@/types/span";

interface TraceSpansEnvelope {
  data: TraceSpanEvent[];
  meta: { count: number };
}

interface UseTraceSpansResult {
  spans: TraceSpanEvent[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches all spans belonging to a trace for the Trace Waterfall view.
 *
 * Caches results by trace_id to avoid refetching when switching tabs.
 */
export function useTraceSpans(
  orgSlug: string,
  projectSlug: string,
  traceId: string | null
): UseTraceSpansResult {
  const [spans, setSpans] = useState<TraceSpanEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, TraceSpanEvent[]>>(new Map());

  const fetchTraceSpans = useCallback(
    async (id: string) => {
      const cached = cacheRef.current.get(id);
      if (cached) {
        setSpans(cached);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await apiFetch<TraceSpansEnvelope>(
          `/api/orgs/${orgSlug}/projects/${projectSlug}/spans/trace/${id}`
        );
        cacheRef.current.set(id, res.data);
        setSpans(res.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load trace spans"
        );
        setSpans([]);
      } finally {
        setLoading(false);
      }
    },
    [orgSlug, projectSlug]
  );

  useEffect(() => {
    if (!traceId) {
      setSpans([]);
      setLoading(false);
      setError(null);
      return;
    }
    fetchTraceSpans(traceId);
  }, [traceId, fetchTraceSpans]);

  return { spans, loading, error };
}
