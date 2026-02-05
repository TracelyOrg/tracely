export type HealthStatus = "healthy" | "degraded" | "error";

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  request_rate: number;
  error_rate: number;
  p95_latency: number;
}

export interface HealthResponse {
  services: ServiceHealth[];
}
