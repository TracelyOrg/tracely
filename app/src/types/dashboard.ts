export interface DataPoint {
  timestamp: string;
  value: number;
}

export interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "error";
  request_rate: number;
  error_rate: number;
  p95_latency: number;
}

export interface StatusCodeStats {
  code: string; // "2xx", "3xx", "4xx", "5xx"
  count: number;
}

export interface EndpointStats {
  route: string;
  method: string;
  count: number;
  avg_latency: number;
  p95_latency: number;
  error_rate: number;
}

export interface LatencyBucket {
  range: string;
  label: string;
  count: number;
}

export interface LiveDashboardResponse {
  requests_per_minute: DataPoint[];
  error_rate: number;
  p95_latency: number;
  services: ServiceStatus[];
}

export interface PeriodSummary {
  total_requests: number;
  total_errors: number;
  error_rate: number;
  p95_latency: number;
}

export interface DashboardMetricsResponse {
  // Time series data
  requests_per_minute: DataPoint[];
  errors_per_minute: DataPoint[];

  // Summary metrics
  total_requests: number;
  total_errors: number;
  error_rate: number;
  p50_latency: number;
  p95_latency: number;
  p99_latency: number;
  avg_latency: number;

  // Distributions
  status_codes: StatusCodeStats[];
  top_endpoints: EndpointStats[];
  latency_distribution: LatencyBucket[];

  // Service health
  services: ServiceStatus[];

  /** Aggregates for the immediately preceding window of equal duration. */
  previous_period?: PeriodSummary | null;

  /** Distinct environments seen in the last 7 days. */
  available_environments?: string[];
}
