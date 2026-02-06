"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface EndpointStats {
  route: string;
  method: string;
  count: number;
  avgLatency: number;
  errorRate: number;
}

interface TopEndpointsWidgetProps {
  endpoints: EndpointStats[];
  className?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  POST: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  PUT: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  PATCH: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  DELETE: "bg-red-500/20 text-red-600 dark:text-red-400",
};

/**
 * Top endpoints widget showing the most requested routes.
 * Displays method, route, request count, avg latency, and error rate.
 */
export function TopEndpointsWidget({ endpoints, className }: TopEndpointsWidgetProps) {
  const maxCount = Math.max(...endpoints.map((e) => e.count), 1);

  return (
    <motion.div
      data-testid="top-endpoints-widget"
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="rounded-xl border bg-card p-4 h-full flex flex-col">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Top Endpoints</h3>

        {endpoints.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No endpoint data
          </div>
        ) : (
          <div className="space-y-2 flex-1 overflow-auto">
            {endpoints.slice(0, 5).map((endpoint, idx) => (
              <div key={`${endpoint.method}-${endpoint.route}-${idx}`} className="relative">
                {/* Background bar showing relative volume */}
                <div
                  className="absolute inset-0 bg-primary/5 rounded-lg"
                  style={{ width: `${(endpoint.count / maxCount) * 100}%` }}
                />

                <div className="relative flex items-center gap-2 p-2">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-bold rounded uppercase",
                      METHOD_COLORS[endpoint.method] || "bg-gray-500/20 text-gray-600"
                    )}
                  >
                    {endpoint.method}
                  </span>

                  <span className="flex-1 text-sm font-mono truncate" title={endpoint.route}>
                    {endpoint.route || "/"}
                  </span>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums">{endpoint.count.toLocaleString()}</span>
                    <span className="tabular-nums w-14 text-right">
                      {endpoint.avgLatency >= 1000
                        ? `${(endpoint.avgLatency / 1000).toFixed(1)}s`
                        : `${Math.round(endpoint.avgLatency)}ms`}
                    </span>
                    <span
                      className={cn(
                        "tabular-nums w-12 text-right",
                        endpoint.errorRate > 5 && "text-destructive"
                      )}
                    >
                      {endpoint.errorRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {endpoints.length > 5 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            +{endpoints.length - 5} more endpoints
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default TopEndpointsWidget;
