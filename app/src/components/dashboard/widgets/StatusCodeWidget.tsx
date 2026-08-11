"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { statusCodeChartColor } from "@/lib/dashboardChartTheme";
import { DASHBOARD_METRIC_HELP } from "@/lib/dashboardMetricHelp";
import { cn } from "@/lib/utils";

export interface StatusCodeData {
  code: string;
  count: number;
  color?: string;
}

interface StatusCodeWidgetProps {
  data: StatusCodeData[];
  className?: string;
}

const EMPTY_CODES = ["2xx", "3xx", "4xx", "5xx"];

export function StatusCodeWidget({ data, className }: StatusCodeWidgetProps) {
  const chartData =
    data.length > 0
      ? data.map((d) => ({ ...d, color: d.color ?? statusCodeChartColor(d.code) }))
      : EMPTY_CODES.map((code) => ({ code, count: 0, color: statusCodeChartColor(code) }));

  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <DashboardPanel
      title="Status codes"
      description={DASHBOARD_METRIC_HELP.statusCodes}
      testId="status-code-widget"
      className={className}
      action={
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {total.toLocaleString()}
        </span>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="mx-auto h-[140px] w-[140px] shrink-0 sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                dataKey="count"
                nameKey="code"
                stroke="var(--background)"
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.code} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                formatter={(value, name) => [
                  `${Number(value).toLocaleString()} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="flex-1 space-y-2.5">
          {chartData.map((entry) => {
            const pct = total > 0 ? (entry.count / total) * 100 : 0;
            return (
              <li
                key={entry.code}
                className="flex min-h-9 items-center justify-between gap-3 text-xs"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden
                  />
                  <span className="font-medium">{entry.code}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {pct.toFixed(1)}%
                  <span className={cn("ml-2 text-foreground")}>
                    {entry.count.toLocaleString()}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </DashboardPanel>
  );
}

export default StatusCodeWidget;
