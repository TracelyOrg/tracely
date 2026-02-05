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

export interface LiveDashboardResponse {
  requests_per_minute: DataPoint[];
  error_rate: number;
  p95_latency: number;
  services: ServiceStatus[];
}
