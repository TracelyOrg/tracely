export type AlertCategory = "availability" | "performance" | "volume";

export type ComparisonOperator = "gt" | "lt" | "eq" | "gte" | "lte" | "pct_increase" | "pct_decrease";

export type MetricType = "error_rate" | "request_count" | "p95_latency";

export interface AlertTemplate {
  key: string;
  name: string;
  category: AlertCategory;
  description: string;
  default_threshold: number;
  default_duration: number;
  comparison: ComparisonOperator;
  metric: MetricType;
  is_active: boolean;
  custom_threshold?: number | null;
  custom_duration?: number | null;
  rule_id?: string | null;
}

export interface AlertRule {
  id: string;
  org_id: string;
  project_id: string;
  preset_key: string;
  name: string;
  category: string;
  description: string | null;
  threshold_value: number;
  duration_seconds: number;
  comparison_operator: string;
  is_active: boolean;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertToggleRequest {
  preset_key: string;
}

export interface AlertRuleUpdate {
  threshold_value?: number;
  duration_seconds?: number;
  is_active?: boolean;
}

export interface AlertTemplatesResponse {
  templates: AlertTemplate[];
}

export type AlertEventStatus = "active" | "resolved" | "acknowledged";

export interface AlertEvent {
  id: string;
  rule_id: string;
  org_id: string;
  project_id: string;
  triggered_at: string;
  resolved_at: string | null;
  metric_value: number;
  threshold_value: number;
  status: AlertEventStatus;
  notification_sent: boolean;
  rule_snapshot?: AlertRule | null;
  // Joined from alert_rules
  rule_name: string;
  rule_category: AlertCategory;
  rule_preset_key: string;
  created_at: string;
  updated_at: string;
}

export interface AlertHistoryResponse {
  events: AlertEvent[];
  total: number;
  offset: number;
  limit: number;
}

export interface AlertHistoryFilters {
  status?: AlertEventStatus;
  start_date?: string;
  end_date?: string;
}

export const CATEGORY_CONFIG: Record<AlertCategory, { label: string; color: string; icon: string }> = {
  availability: { label: "Availability", color: "red", icon: "Shield" },
  performance: { label: "Performance", color: "amber", icon: "Gauge" },
  volume: { label: "Volume", color: "blue", icon: "TrendingUp" },
};
