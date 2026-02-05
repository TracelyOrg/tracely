"use client";

import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus, ServiceHealth } from "@/types/health";

interface HealthCardProps {
  service: ServiceHealth;
}

const STATUS_CONFIG: Record<
  HealthStatus,
  {
    icon: typeof CheckCircle2;
    colorClass: string;
    bgClass: string;
    label: string;
  }
> = {
  healthy: {
    icon: CheckCircle2,
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
    label: "Healthy",
  },
  degraded: {
    icon: AlertTriangle,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
    label: "Degraded",
  },
  error: {
    icon: XCircle,
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10",
    label: "Error",
  },
};

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
  const config = STATUS_CONFIG[service.status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-all hover:shadow-md",
        "flex flex-col gap-3"
      )}
      data-testid={`health-card-${service.name}`}
    >
      {/* Header: Service name + Status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="size-4 shrink-0 text-muted-foreground" />
          <h3 className="font-medium truncate" title={service.name}>
            {service.name}
          </h3>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
            config.bgClass,
            config.colorClass
          )}
        >
          <StatusIcon className="size-3" />
          <span>{config.label}</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        {/* Request rate */}
        <div>
          <p className="text-muted-foreground text-xs">Requests/min</p>
          <p className="font-mono font-medium tabular-nums">
            {formatRate(service.request_rate)}
          </p>
        </div>

        {/* Error rate */}
        <div>
          <p className="text-muted-foreground text-xs">Error rate</p>
          <p
            className={cn(
              "font-mono font-medium tabular-nums",
              service.error_rate >= 5 && "text-red-500",
              service.error_rate >= 1 && service.error_rate < 5 && "text-amber-500"
            )}
          >
            {service.error_rate.toFixed(2)}%
          </p>
        </div>

        {/* P95 latency */}
        <div>
          <p className="text-muted-foreground text-xs">P95 latency</p>
          <p
            className={cn(
              "font-mono font-medium tabular-nums",
              service.p95_latency >= 2000 && "text-red-500",
              service.p95_latency >= 500 &&
                service.p95_latency < 2000 &&
                "text-amber-500"
            )}
          >
            {formatLatency(service.p95_latency)}
          </p>
        </div>
      </div>
    </div>
  );
}
