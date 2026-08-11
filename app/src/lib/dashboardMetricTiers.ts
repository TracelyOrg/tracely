export type MetricTier = "good" | "watch" | "critical";

export interface MetricTierInfo {
  tier: MetricTier;
  label: string;
}

const TIER_BADGE: Record<MetricTier, string> = {
  good: "bg-success/10 text-success",
  watch: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

export function tierBadgeClass(tier: MetricTier): string {
  return TIER_BADGE[tier];
}

export function errorRateTier(rate: number): MetricTierInfo {
  if (rate >= 5) return { tier: "critical", label: "Critical" };
  if (rate >= 1) return { tier: "watch", label: "Watch" };
  return { tier: "good", label: "Good" };
}

export function latencyTier(ms: number): MetricTierInfo {
  if (ms >= 2000) return { tier: "critical", label: "Slow" };
  if (ms >= 500) return { tier: "watch", label: "Watch" };
  return { tier: "good", label: "Good" };
}

export function successRateTier(successPct: number): MetricTierInfo {
  if (successPct < 95) return { tier: "critical", label: "Low" };
  if (successPct < 99) return { tier: "watch", label: "Mid" };
  return { tier: "good", label: "Elite" };
}

export function requestVolumeTier(total: number): MetricTierInfo {
  if (total >= 1000) return { tier: "good", label: "Active" };
  if (total >= 100) return { tier: "watch", label: "Moderate" };
  return { tier: "watch", label: "Quiet" };
}
