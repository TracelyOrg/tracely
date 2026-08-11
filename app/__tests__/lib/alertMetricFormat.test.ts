import {
  formatAlertBreachSummary,
  formatAlertMetricValue,
} from "@/lib/alertMetricFormat";
import type { AlertEvent } from "@/types/alert";

describe("alertMetricFormat", () => {
  it("formats error rate alerts as percentage", () => {
    expect(formatAlertMetricValue(12.4, "high_error_rate", "availability")).toBe("12.4%");
    expect(formatAlertMetricValue(5, "high_error_rate", "availability")).toBe("5.0%");
  });

  it("formats latency alerts in ms or seconds", () => {
    expect(formatAlertMetricValue(3500, "slow_responses", "performance")).toBe("3.5s");
    expect(formatAlertMetricValue(450, "slow_responses", "performance")).toBe("450ms");
  });

  it("formats traffic change alerts as percentage", () => {
    expect(formatAlertMetricValue(60, "traffic_drop", "volume")).toBe("60.0%");
  });

  it("builds breach summary with units", () => {
    const event = {
      metric_value: 12.4,
      threshold_value: 5,
      rule_preset_key: "high_error_rate",
      rule_category: "availability",
    } as AlertEvent;

    expect(formatAlertBreachSummary(event)).toBe("12.4% (threshold 5.0%)");
  });
});
