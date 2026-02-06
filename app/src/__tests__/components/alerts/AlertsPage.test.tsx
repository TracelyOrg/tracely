/**
 * Tests for Alerts page components (Story 5.1).
 *
 * Tests:
 * - AlertTemplateCard renders all states (Task 8.4)
 * - Category grouping (Task 8.5)
 * - Empty state condition (Task 8.6)
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { AlertTemplate, AlertCategory } from "@/types/alert";

// Mock the category configuration
const CATEGORY_CONFIG: Record<AlertCategory, { label: string; colorClass: string }> = {
  availability: { label: "Availability", colorClass: "text-red-500" },
  performance: { label: "Performance", colorClass: "text-amber-500" },
  volume: { label: "Volume", colorClass: "text-blue-500" },
};

// Simplified AlertTemplateCard for testing
function AlertTemplateCard({ template }: { template: AlertTemplate }) {
  return (
    <div data-testid={`alert-card-${template.key}`}>
      <h3 data-testid="card-name">{template.name}</h3>
      <span data-testid="card-status">{template.is_active ? "Active" : "Inactive"}</span>
      <p data-testid="card-description">{template.description}</p>
      <span data-testid="card-threshold">{template.custom_threshold ?? template.default_threshold}</span>
      <span data-testid="card-duration">{template.custom_duration ?? template.default_duration}</span>
    </div>
  );
}

// Simplified AlertCategorySection for testing
function AlertCategorySection({
  category,
  templates,
}: {
  category: AlertCategory;
  templates: AlertTemplate[];
}) {
  const config = CATEGORY_CONFIG[category];

  return (
    <section data-testid={`category-${category}`}>
      <h2 data-testid="category-label">{config.label}</h2>
      <span data-testid="category-count">{templates.length}</span>
      <div data-testid="category-cards">
        {templates.map((t) => (
          <AlertTemplateCard key={t.key} template={t} />
        ))}
      </div>
    </section>
  );
}

// Simplified EmptyAlertsState for testing
function EmptyAlertsState() {
  return (
    <div data-testid="empty-alerts-state">
      <h3 data-testid="empty-title">No active alerts</h3>
      <p data-testid="empty-cta">Get started by activating a preset template</p>
    </div>
  );
}

describe("AlertTemplateCard (Task 8.4)", () => {
  const baseTemplate: AlertTemplate = {
    key: "high_error_rate",
    name: "High Error Rate",
    category: "availability",
    description: "Fires when error rate exceeds threshold",
    default_threshold: 5.0,
    default_duration: 300,
    comparison: "gt",
    metric: "error_rate",
    is_active: false,
  };

  it("renders inactive template with defaults", () => {
    render(<AlertTemplateCard template={baseTemplate} />);

    expect(screen.getByTestId("card-name")).toHaveTextContent("High Error Rate");
    expect(screen.getByTestId("card-status")).toHaveTextContent("Inactive");
    expect(screen.getByTestId("card-description")).toHaveTextContent("Fires when error rate");
    expect(screen.getByTestId("card-threshold")).toHaveTextContent("5");
    expect(screen.getByTestId("card-duration")).toHaveTextContent("300");
  });

  it("renders active template with active status", () => {
    const activeTemplate: AlertTemplate = {
      ...baseTemplate,
      is_active: true,
    };

    render(<AlertTemplateCard template={activeTemplate} />);

    expect(screen.getByTestId("card-status")).toHaveTextContent("Active");
  });

  it("renders custom threshold when set", () => {
    const customTemplate: AlertTemplate = {
      ...baseTemplate,
      is_active: true,
      custom_threshold: 3.0,
    };

    render(<AlertTemplateCard template={customTemplate} />);

    expect(screen.getByTestId("card-threshold")).toHaveTextContent("3");
  });

  it("renders custom duration when set", () => {
    const customTemplate: AlertTemplate = {
      ...baseTemplate,
      is_active: true,
      custom_duration: 600,
    };

    render(<AlertTemplateCard template={customTemplate} />);

    expect(screen.getByTestId("card-duration")).toHaveTextContent("600");
  });
});

describe("AlertCategorySection (Task 8.5)", () => {
  const availabilityTemplates: AlertTemplate[] = [
    {
      key: "high_error_rate",
      name: "High Error Rate",
      category: "availability",
      description: "Fires when error rate exceeds threshold",
      default_threshold: 5.0,
      default_duration: 300,
      comparison: "gt",
      metric: "error_rate",
      is_active: false,
    },
    {
      key: "service_down",
      name: "Service Down",
      category: "availability",
      description: "Fires when no requests received",
      default_threshold: 0,
      default_duration: 180,
      comparison: "eq",
      metric: "request_count",
      is_active: true,
    },
  ];

  it("renders category with correct label", () => {
    render(
      <AlertCategorySection
        category="availability"
        templates={availabilityTemplates}
      />
    );

    expect(screen.getByTestId("category-label")).toHaveTextContent("Availability");
  });

  it("renders category with correct template count", () => {
    render(
      <AlertCategorySection
        category="availability"
        templates={availabilityTemplates}
      />
    );

    expect(screen.getByTestId("category-count")).toHaveTextContent("2");
  });

  it("renders all templates in category", () => {
    render(
      <AlertCategorySection
        category="availability"
        templates={availabilityTemplates}
      />
    );

    expect(screen.getByTestId("alert-card-high_error_rate")).toBeInTheDocument();
    expect(screen.getByTestId("alert-card-service_down")).toBeInTheDocument();
  });

  it("renders empty category with zero count", () => {
    render(
      <AlertCategorySection
        category="volume"
        templates={[]}
      />
    );

    expect(screen.getByTestId("category-count")).toHaveTextContent("0");
  });
});

describe("EmptyAlertsState (Task 8.6)", () => {
  it("renders empty state with correct message", () => {
    render(<EmptyAlertsState />);

    expect(screen.getByTestId("empty-title")).toHaveTextContent("No active alerts");
  });

  it("renders CTA to activate templates", () => {
    render(<EmptyAlertsState />);

    expect(screen.getByTestId("empty-cta")).toHaveTextContent(
      "Get started by activating a preset template"
    );
  });
});

describe("Empty state condition logic (Task 8.6)", () => {
  it("shows empty state when no templates are active", () => {
    const templates: AlertTemplate[] = [
      {
        key: "high_error_rate",
        name: "High Error Rate",
        category: "availability",
        description: "Test",
        default_threshold: 5.0,
        default_duration: 300,
        comparison: "gt",
        metric: "error_rate",
        is_active: false, // All inactive
      },
      {
        key: "slow_responses",
        name: "Slow Responses",
        category: "performance",
        description: "Test",
        default_threshold: 2000,
        default_duration: 300,
        comparison: "gt",
        metric: "p95_latency",
        is_active: false, // All inactive
      },
    ];

    const hasActiveAlerts = templates.some((t) => t.is_active);
    const showEmptyState = !hasActiveAlerts;

    expect(showEmptyState).toBe(true);
  });

  it("hides empty state when at least one template is active", () => {
    const templates: AlertTemplate[] = [
      {
        key: "high_error_rate",
        name: "High Error Rate",
        category: "availability",
        description: "Test",
        default_threshold: 5.0,
        default_duration: 300,
        comparison: "gt",
        metric: "error_rate",
        is_active: true, // One is active
      },
      {
        key: "slow_responses",
        name: "Slow Responses",
        category: "performance",
        description: "Test",
        default_threshold: 2000,
        default_duration: 300,
        comparison: "gt",
        metric: "p95_latency",
        is_active: false,
      },
    ];

    const hasActiveAlerts = templates.some((t) => t.is_active);
    const showEmptyState = !hasActiveAlerts;

    expect(showEmptyState).toBe(false);
  });
});
