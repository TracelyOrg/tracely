export type TrendDirection = "up" | "down" | "neutral";

export interface MetricTrend {
  direction: TrendDirection;
  label: string;
  /** When true, an increase uses warning/danger styling (error rate, latency). */
  invertColors: boolean;
  /** Volume-style metrics — show change without good/bad coloring. */
  neutralColor?: boolean;
}

const NEUTRAL_THRESHOLD = {
  requests: 0.01,
  errorRate: 0.05,
  /** Success/error rate deltas below this show as Stable (e.g. ±0.2 pts). */
  ratePoints: 0.25,
  latency: 5,
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function stableTrend(invertColors: boolean): MetricTrend {
  return { direction: "neutral", label: "Stable", invertColors };
}

function formatPercentTrend(
  change: number | null,
  invertColors: boolean,
  threshold: number
): MetricTrend | null {
  if (change === null) return null;
  if (Math.abs(change) < threshold) return stableTrend(invertColors);
  const sign = change > 0 ? "+" : "";
  return {
    direction: change > 0 ? "up" : "down",
    label: `${sign}${change.toFixed(0)}%`,
    invertColors,
  };
}

export function computeRequestTrend(
  current: number,
  previous: number | null | undefined
): MetricTrend | null {
  if (!isFiniteNumber(previous)) return null;
  const safeCurrent = isFiniteNumber(current) ? current : 0;
  const trend = formatPercentTrend(
    pctChange(safeCurrent, previous),
    false,
    NEUTRAL_THRESHOLD.requests
  );
  if (!trend) return null;
  return { ...trend, neutralColor: true };
}

export function computeErrorRateTrend(
  current: number,
  previous: number | null | undefined
): MetricTrend | null {
  if (!isFiniteNumber(previous)) return null;
  const safeCurrent = isFiniteNumber(current) ? current : 0;
  const delta = safeCurrent - previous;
  if (Math.abs(delta) < NEUTRAL_THRESHOLD.ratePoints) return stableTrend(true);
  const sign = delta > 0 ? "+" : "";
  return {
    direction: delta > 0 ? "up" : "down",
    label: `${sign}${delta.toFixed(1)} pts`,
    invertColors: true,
  };
}

export function computeLatencyTrend(
  current: number,
  previous: number | null | undefined
): MetricTrend | null {
  if (!isFiniteNumber(previous)) return null;
  const safeCurrent = isFiniteNumber(current) ? current : 0;
  return formatPercentTrend(
    pctChange(safeCurrent, previous),
    true,
    NEUTRAL_THRESHOLD.latency
  );
}

export function computeSuccessRateTrend(
  currentErrorRate: number,
  previousErrorRate: number | null | undefined
): MetricTrend | null {
  if (!isFiniteNumber(previousErrorRate)) return null;
  const safeCurrent = isFiniteNumber(currentErrorRate) ? currentErrorRate : 0;
  const delta = previousErrorRate - safeCurrent;
  if (Math.abs(delta) < NEUTRAL_THRESHOLD.ratePoints) return stableTrend(false);
  const sign = delta > 0 ? "+" : "";
  return {
    direction: delta > 0 ? "up" : "down",
    label: `${sign}${delta.toFixed(1)} pts`,
    invertColors: false,
  };
}

export function formatSuccessRate(errorRate: number): string {
  const safeRate = isFiniteNumber(errorRate) ? errorRate : 0;
  return `${Math.max(0, 100 - safeRate).toFixed(2)}%`;
}
