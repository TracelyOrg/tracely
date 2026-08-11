import type { HealthStatus } from "@/types/health";
import type { AlertCategory, AlertEventStatus } from "@/types/alert";
import { cn } from "@/lib/utils";

/** Semantic status dots — always use with rounded-full */
export const STATUS_DOT: Record<HealthStatus, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  error: "bg-destructive",
};

export const STATUS_TEXT: Record<HealthStatus, string> = {
  healthy: "text-success",
  degraded: "text-warning",
  error: "text-destructive",
};

export const STATUS_BADGE: Record<HealthStatus, string> = {
  healthy: "bg-success/10 text-success",
  degraded: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
};

export function errorRateTextClass(rate: number): string {
  if (rate >= 5) return "text-destructive";
  if (rate >= 1) return "text-warning";
  return "text-muted-foreground";
}

export function latencyTextClass(ms: number): string {
  if (ms >= 2000) return "text-destructive";
  if (ms >= 500) return "text-warning";
  return "text-muted-foreground";
}

export function cnErrorRate(rate: number, extra?: string) {
  return cn(errorRateTextClass(rate), extra);
}

export function cnLatency(ms: number, extra?: string) {
  return cn(latencyTextClass(ms), extra);
}

/** Alert history / event surfaces */
export const ALERT_EVENT_ROW: Record<AlertEventStatus, string> = {
  active: "bg-destructive/5",
  resolved: "bg-success/5",
  acknowledged: "bg-warning/5",
};

export const ALERT_EVENT_BADGE: Record<AlertEventStatus, string> = {
  active: "bg-destructive/10 text-destructive",
  resolved: "bg-success/10 text-success",
  acknowledged: "bg-warning/10 text-warning",
};

export const ALERT_CATEGORY_TEXT: Record<AlertCategory, string> = {
  availability: "text-destructive",
  performance: "text-warning",
  volume: "text-muted-foreground",
};

export function sparkBarClass(value: number, thresholds: { warn: number; critical: number }): string {
  if (value >= thresholds.critical) return "bg-destructive";
  if (value >= thresholds.warn) return "bg-warning";
  return "bg-success";
}
