import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import type { DataEnvelope } from "@/types/api";
import type { HealthResponse } from "@/types/health";

// Stale time matches Redis cache TTL (20s) for consistency
const HEALTH_STALE_TIME = 20_000;

interface UseHealthDataOptions {
  orgSlug: string;
  projectSlug: string;
  enabled?: boolean;
}

/**
 * Fetches health aggregation data for a project.
 *
 * Uses React Query with stale time matching the backend Redis cache TTL
 * to minimize redundant requests while keeping data fresh.
 */
export function useHealthData({
  orgSlug,
  projectSlug,
  enabled = true,
}: UseHealthDataOptions) {
  return useQuery({
    queryKey: queryKeys.health(`${orgSlug}/${projectSlug}`),
    queryFn: async () => {
      const res = await apiFetch<DataEnvelope<HealthResponse>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/health`
      );
      return res.data;
    },
    enabled,
    staleTime: HEALTH_STALE_TIME,
    refetchInterval: HEALTH_STALE_TIME,
  });
}
