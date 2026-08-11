/** Plain-language explanations for dashboard metrics and widgets. */
export const DASHBOARD_METRIC_HELP = {
  requests:
    "Total HTTP requests in the selected window. Trend compares to the preceding window — volume alone is neither good nor bad.",
  errorRate:
    "Share of requests that returned 4xx/5xx or failed spans. Trend shows change in percentage points vs the previous window.",
  p95Latency:
    "95th percentile response time — 95% of requests were faster than this value. Trend compares to the previous window.",
  successRate:
    "100% minus error rate. Trend shows change in percentage points vs the previous window.",
  healthOverview:
    "Overall score from service health (healthy = 100, degraded = 55, error = 15), weighted by request volume. The bar shows HTTP status code mix for the window.",
  needsAttention:
    "Endpoints and services with high error rates or slow p95 latency. Click a row to inspect in Live.",
  throughput:
    "Request volume over time, aggregated into buckets that adapt to the selected window.",
  statusCodes:
    "Distribution of HTTP response families (2xx success, 3xx redirect, 4xx client error, 5xx server error).",
  errorsTimeline:
    "Error count per time bucket. Bars highlight periods with elevated failures.",
  latencyDistribution:
    "Histogram of response times with p50, p95, and p99 markers for the window.",
  endpoints:
    "Top routes by volume, error rate, or p95 latency. Click a row to filter Live.",
  services:
    "Per-service error rate and p95 latency with health status. Click a row to filter Live.",
} as const;
