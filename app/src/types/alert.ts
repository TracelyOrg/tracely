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

export const CATEGORY_CONFIG: Record<AlertCategory, { label: string; color: string; icon: string }> = {
  availability: { label: "Availability", color: "red", icon: "Shield" },
  performance: { label: "Performance", color: "amber", icon: "Gauge" },
  volume: { label: "Volume", color: "blue", icon: "TrendingUp" },
};
