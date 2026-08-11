/** Shared panel shell for dashboard widgets — elevated surface, flat border. */
export const DASHBOARD_PANEL_CLASS =
  "dashboard-panel rounded-xl border border-border bg-card p-4 h-full";

/** Muted semantic fills for charts (OKLCH, works in light + dark via CSS vars). */
export const STATUS_CODE_CHART_COLORS: Record<string, string> = {
  "2xx": "var(--dash-status-2xx)",
  "3xx": "var(--dash-status-3xx)",
  "4xx": "var(--dash-status-4xx)",
  "5xx": "var(--dash-status-5xx)",
};

export function statusCodeChartColor(code: string): string {
  return STATUS_CODE_CHART_COLORS[code] ?? "var(--dash-chart-neutral)";
}

export const DASHBOARD_CHART = {
  bar: "var(--dash-chart-bar)",
  barActive: "var(--dash-chart-bar-active)",
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
  margin: { top: 8, right: 4, left: 0, bottom: 0 },
  heightClass: "h-[144px] sm:h-[168px]",
  /** Recharts Tooltip defaults to a full-height gray column on hover/click. */
  tooltipCursor: false as const,
  activeBar: { fill: "var(--dash-chart-bar-active)" },
  activeBarError: { fill: "var(--dash-status-5xx)", fillOpacity: 0.88 },
} as const;

export function formatAggregatedAxisTick(
  chartData: { showTick: boolean; label: string }[],
  label: string,
  index: number
): string {
  return chartData[index]?.showTick ? label : "";
}
