import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import type { AlertHistoryResponse } from "@/types/alert";

const ACTIVE_ALERTS_STALE_MS = 20_000;

interface UseActiveAlertsOptions {
  orgSlug: string;
  projectSlug: string;
  enabled?: boolean;
  limit?: number;
}

export function useActiveAlerts({
  orgSlug,
  projectSlug,
  enabled = true,
  limit = 5,
}: UseActiveAlertsOptions) {
  return useQuery({
    queryKey: ["alerts", "active", orgSlug, projectSlug, limit],
    queryFn: async () => {
      const res = await apiFetch<DataEnvelope<AlertHistoryResponse>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/history?status=active&limit=${limit}`
      );
      return res.data;
    },
    enabled: enabled && !!orgSlug && !!projectSlug,
    staleTime: ACTIVE_ALERTS_STALE_MS,
    refetchInterval: ACTIVE_ALERTS_STALE_MS,
  });
}
