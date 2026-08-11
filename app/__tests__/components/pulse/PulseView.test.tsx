/**
 * Tests for PulseView page sub-components (EmptyState, PulseSkeleton, LiveHeader).
 *
 * These are extracted as standalone components in the page file. We test them
 * via the page's rendering behavior rather than importing private functions.
 * We mock the heavy dependencies (SSE, apiFetch, virtualizer) to focus on
 * display logic.
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "test-org", projectSlug: "test-project" }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock apiFetch to simulate loading states
const mockApiFetch = jest.fn();
jest.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  ApiError: class extends Error {
    code: string;
    status: number;
    constructor(s: number, b: { error: { code: string; message: string } }) {
      super(b.error.message);
      this.code = b.error.code;
      this.status = s;
    }
  },
}));

// Mock useEventStream
const mockUseEventStream = jest.fn().mockReturnValue({
  status: "disconnected",
  firstEventReceived: false,
});
jest.mock("@/hooks/useEventStream", () => ({
  useEventStream: (...args: unknown[]) => mockUseEventStream(...args),
}));

jest.mock("@/hooks/useHealthData", () => ({
  useHealthData: () => ({ data: undefined, isLoading: false }),
}));

// Mock framer-motion to avoid animation complexities in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => <div {...props}>{children}</div>,
    button: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock @tanstack/react-virtual
jest.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: jest.fn(),
  }),
}));

// Reset store before each test
import { useLiveStreamStore } from "@/stores/liveStreamStore";

import LivePageClient from "@/app/(dashboard)/[orgSlug]/[projectSlug]/live/LivePageContent";

const defaultProps = {
  orgSlug: "test-org",
  projectSlug: "test-project",
  projectId: "proj-uuid",
  initialSpans: [] as import("@/types/span").SpanEvent[],
  initialHasMoreHistory: false,
};

function renderLivePage(overrides: Partial<typeof defaultProps> = {}) {
  return render(<LivePageClient {...defaultProps} {...overrides} />);
}

describe("PulseView Page", () => {
  beforeEach(() => {
    useLiveStreamStore.getState().reset();
    mockApiFetch.mockReset();
    mockUseEventStream.mockReturnValue({
      status: "disconnected",
      firstEventReceived: false,
    });
  });

  it("shows skeleton loading state while re-fetching after leaving historical mode (AC4, UX7)", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/spans")) {
        return new Promise(() => {});
      }
      return Promise.resolve({ data: [] });
    });

    renderLivePage();

    const { useFilterStore } = await import("@/stores/filterStore");
    useFilterStore.setState((state) => ({
      filters: {
        ...state.filters,
        timeRange: {
          preset: "custom",
          start: "2026-01-01T00:00:00.000Z",
          end: "2026-01-02T00:00:00.000Z",
        },
      },
    }));

    await screen.findByText("No requests in this time range");

    useFilterStore.setState((state) => ({
      filters: { ...state.filters, timeRange: { preset: "5m" } },
    }));

    const pulsingElements = document.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("shows empty state with SDK install instructions when connected with no spans (AC4, UX6)", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/api-keys")) {
        return Promise.resolve({ data: [{ id: "k1", prefix: "trly_abc", name: null, last_used_at: null, created_at: "" }] });
      }
      return Promise.resolve({
        data: { id: "proj-uuid", name: "Test", slug: "test-project", org_id: "org-1", created_at: "" },
      });
    });
    mockUseEventStream.mockReturnValue({
      status: "connected",
      firstEventReceived: false,
    });

    renderLivePage();

    await screen.findByText("Get started");

    expect(screen.getByText(/pip install tracely-sdk/)).toBeInTheDocument();
    expect(screen.getByText("Full setup guide")).toBeInTheDocument();
    expect(
      screen.getByText("Full setup guide").getAttribute("href")
    ).toBe("https://tracely.sh/docs");
  });

  it("renders live header with connection status", async () => {
    mockApiFetch.mockResolvedValue({
      data: { id: "proj-uuid", name: "Test", slug: "test-project", org_id: "org-1", created_at: "" },
    });
    mockUseEventStream.mockReturnValue({
      status: "connected",
      firstEventReceived: false,
    });

    renderLivePage();

    await screen.findByTestId("header-time-range");
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows connecting status in header", async () => {
    mockApiFetch.mockResolvedValue({
      data: { id: "proj-uuid", name: "Test", slug: "test-project", org_id: "org-1", created_at: "" },
    });
    mockUseEventStream.mockReturnValue({
      status: "connecting",
      firstEventReceived: false,
    });

    renderLivePage();

    await screen.findByTestId("header-time-range");
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows disconnected status in header", async () => {
    mockApiFetch.mockResolvedValue({
      data: { id: "proj-uuid", name: "Test", slug: "test-project", org_id: "org-1", created_at: "" },
    });
    mockUseEventStream.mockReturnValue({
      status: "disconnected",
      firstEventReceived: false,
    });

    renderLivePage();

    await screen.findByTestId("header-time-range");
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("passes projectId and onSpan to useEventStream", async () => {
    renderLivePage({ projectId: "proj-123" });

    await screen.findByTestId("header-time-range");

    expect(mockUseEventStream).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-123",
        enabled: true,
        onSpan: expect.any(Function),
      })
    );
  });

  // --- Story 3.2: Back to Live button ---

  it("shows 'Back to Live' button when scrolled away from bottom with spans (AC2, UX17)", async () => {
    mockUseEventStream.mockReturnValue({
      status: "connected",
      firstEventReceived: true,
    });

    const testSpan = {
      trace_id: "t1",
      span_id: "s1",
      parent_span_id: "",
      span_name: "GET /api/test",
      span_type: "span" as const,
      service_name: "api",
      kind: "SERVER",
      start_time: "2026-02-03T10:00:00Z",
      duration_ms: 42,
      status_code: "OK",
      http_method: "GET",
      http_route: "/api/test",
      http_status_code: 200,
      environment: "",
    };

    renderLivePage({ initialSpans: [testSpan], initialHasMoreHistory: true });
    useLiveStreamStore.getState().setIsAtBottom(false);

    await screen.findByTestId("header-time-range");
    expect(screen.getByText("Back to Live")).toBeInTheDocument();
  });

  it("does NOT show 'Back to Live' button when at bottom (AC3)", async () => {
    mockUseEventStream.mockReturnValue({
      status: "connected",
      firstEventReceived: true,
    });

    const testSpan = {
      trace_id: "t1",
      span_id: "s1",
      parent_span_id: "",
      span_name: "GET /api/test",
      span_type: "span" as const,
      service_name: "api",
      kind: "SERVER",
      start_time: "2026-02-03T10:00:00Z",
      duration_ms: 42,
      status_code: "OK",
      http_method: "GET",
      http_route: "/api/test",
      http_status_code: 200,
      environment: "",
    };

    renderLivePage({ initialSpans: [testSpan], initialHasMoreHistory: true });

    await screen.findByTestId("header-time-range");
    expect(screen.queryByText("Back to Live")).not.toBeInTheDocument();
  });

  it("does NOT show 'Back to Live' button when no spans", async () => {
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (url.includes("/api-keys") && opts?.method === "POST") {
        return Promise.resolve({ data: { id: "k1", key: "trly_test_full_key", prefix: "trly_test", name: null, created_at: "" } });
      }
      if (url.includes("/api-keys")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({
        data: { id: "proj-uuid", name: "Test", slug: "test-project", org_id: "org-1", created_at: "" },
      });
    });
    mockUseEventStream.mockReturnValue({
      status: "connected",
      firstEventReceived: false,
    });

    // isAtBottom = false but no spans
    useLiveStreamStore.getState().setIsAtBottom(false);

    renderLivePage();

    await screen.findByText("Get started");
    expect(screen.queryByText("Back to Live")).not.toBeInTheDocument();
  });
});
