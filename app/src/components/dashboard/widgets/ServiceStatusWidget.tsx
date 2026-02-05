"use client";

import { motion } from "framer-motion";
import { Server, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceStatus } from "@/types/dashboard";

interface ServiceStatusWidgetProps {
  services: ServiceStatus[];
  className?: string;
}

const STATUS_CONFIG = {
  healthy: {
    icon: CheckCircle2,
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
    dotClass: "bg-emerald-500",
    label: "Healthy",
  },
  degraded: {
    icon: AlertTriangle,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
    dotClass: "bg-amber-500",
    label: "Degraded",
  },
  error: {
    icon: XCircle,
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10",
    dotClass: "bg-red-500",
    label: "Error",
  },
};

function formatLatency(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ServiceStatusWidget({ services, className }: ServiceStatusWidgetProps) {
  // Count services by status
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const errorCount = services.filter((s) => s.status === "error").length;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 min-h-[180px] flex flex-col",
        className
      )}
      data-testid="service-status-widget"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="size-4" />
          <span>Services</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {healthyCount > 0 && (
            <span className="text-emerald-500">{healthyCount} healthy</span>
          )}
          {degradedCount > 0 && (
            <span className="text-amber-500">{degradedCount} degraded</span>
          )}
          {errorCount > 0 && (
            <span className="text-red-500">{errorCount} error</span>
          )}
        </div>
      </div>

      {/* Service list */}
      <div className="flex-1 overflow-auto">
        {services.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No services detected
          </div>
        ) : (
          <div className="space-y-2">
            {services.map((service) => {
              const config = STATUS_CONFIG[service.status];
              const StatusIcon = config.icon;

              return (
                <motion.div
                  key={service.name}
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2",
                    config.bgClass
                  )}
                  data-testid={`service-${service.name}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Animated status dot */}
                    <span className="relative flex h-2 w-2 shrink-0">
                      {service.status !== "healthy" && (
                        <span
                          className={cn(
                            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                            config.dotClass
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "relative inline-flex h-2 w-2 rounded-full",
                          config.dotClass
                        )}
                      />
                    </span>
                    <span className="font-medium truncate text-sm" title={service.name}>
                      {service.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="text-muted-foreground tabular-nums">
                      {service.request_rate.toFixed(1)}/min
                    </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        service.error_rate >= 5 && "text-red-500",
                        service.error_rate >= 1 && service.error_rate < 5 && "text-amber-500"
                      )}
                    >
                      {service.error_rate.toFixed(1)}%
                    </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        service.p95_latency >= 2000 && "text-red-500",
                        service.p95_latency >= 500 && service.p95_latency < 2000 && "text-amber-500"
                      )}
                    >
                      {formatLatency(service.p95_latency)}
                    </span>
                    <StatusIcon className={cn("size-4", config.colorClass)} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
