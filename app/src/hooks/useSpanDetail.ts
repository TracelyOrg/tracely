import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import type { SpanDetail } from "@/types/span";

interface UseSpanDetailResult {
  detail: SpanDetail | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches full span detail for the Span Inspector panel.
 *
 * Returns loading/error states and caches results by span_id to avoid
 * refetching when the same span is re-selected.
 */
export function useSpanDetail(
  orgSlug: string,
  projectSlug: string,
  spanId: string | null
): UseSpanDetailResult {
  const [detail, setDetail] = useState<SpanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, SpanDetail>>(new Map());

  const fetchDetail = useCallback(
    async (id: string) => {
      // Check cache first
      const cached = cacheRef.current.get(id);
      if (cached) {
        setDetail(cached);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await apiFetch<DataEnvelope<SpanDetail>>(
          `/api/orgs/${orgSlug}/projects/${projectSlug}/spans/${id}`
        );
        cacheRef.current.set(id, res.data);
        setDetail(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load span");
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [orgSlug, projectSlug]
  );

  useEffect(() => {
    if (!spanId) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }
    fetchDetail(spanId);
  }, [spanId, fetchDetail]);

  return { detail, loading, error };
}
