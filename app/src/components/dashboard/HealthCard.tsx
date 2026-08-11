"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceHealth } from "@/types/health";
import { STATUS_BADGE, errorRateTextClass } from "@/lib/statusStyles";

interface HealthCardProps {
  service: ServiceHealth;
}

const STATUS_ICON = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  error: XCircle,
} as const;

const STATUS_LABEL = {
  healthy: "Healthy",
  degraded: "Degraded",
  error: "Error",
} as const;

function formatLatency(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRate(rate: number): string {
  if (rate < 1) return rate.toFixed(2);
  if (rate < 10) return rate.toFixed(1);
  return Math.round(rate).toString();
}

export function HealthCard({ service }: HealthCardProps) {
  const StatusIcon = STATUS_ICON[service.status];

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
      data-testid={`health-card-${service.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-medium" title={service.name}>
          {service.name}
        </h3>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
            STATUS_BADGE[service.status]
          )}
        >
          <StatusIcon className="size-3" />
          <span>{STATUS_LABEL[service.status]}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Rate</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatRate(service.request_rate)}/m
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Error</p>
          <p className={cn("text-sm font-semibold tabular-nums", errorRateTextClass(service.error_rate))}>
            {service.error_rate.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">P95</p>
          <p className="text-sm font-semibold tabular-nums">{formatLatency(service.p95_latency)}</p>
        </div>
      </div>
    </div>
  );
}
