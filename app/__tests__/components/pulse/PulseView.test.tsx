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

import LivePage from "@/app/(dashboard)/[orgSlug]/[projectSlug]/live/page";

describe("PulseView Page", () => {
  beforeEach(() => {
    useLiveStreamStore.getState().reset();
    mockApiFetch.mockReset();
    mockUseEventStream.mockReturnValue({
      status: "disconnected",
      firstEventReceived: false,
    });
  });

  it("shows skeleton loading state during initial project load (AC4, UX7)", () => {
    // apiFetch never resolves → loading stays true
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    render(<LivePage />);

    // Skeleton has multiple animate-pulse divs
    const pulsingElements = document.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("shows empty state when connected with no spans (AC4, UX6)", async () => {
    mockApiFetch.mockResolvedValue({
      data: { id: "proj-uuid", name: "Test", slug: "test-project", org_id: "org-1", created_at: "" },
    });
    mockUseEventStream.mockReturnValue({
      status: "connected",
      firstEventReceived: false,
    });

    render(<LivePage />);

    // Wait for project load to complete
    await screen.findByText("No requests yet");

    expect(screen.getByText("No requests yet")).toBeInTheDocument();
    expect(screen.getByText("Go to setup guide")).toBeInTheDocument();
    expect(
      screen.getByText("Go to setup guide").getAttribute("href")
    ).toBe("/test-org/test-project/onboarding");
  });

  it("renders live header with connection status", async () => {
    mockApiFetch.mockResolvedValue({
      data: { id: "proj-uuid", name: "Test", slug: "test-project", org_id: "org-1", created_at: "" },
    });
    mockUseEventStream.mockReturnValue({
      status: "connected",
      firstEventReceived: false,
    });

    render(<LivePage />);

    await screen.findByText("Pulse View");
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

    render(<LivePage />);

    await screen.findByText("Pulse View");
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

    render(<LivePage />);

    await screen.findByText("Pulse View");
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("passes projectId and onSpan to useEventStream", async () => {
    mockApiFetch.mockResolvedValue({
      data: { id: "proj-123", name: "Test", slug: "test-project", org_id: "org-1", created_at: "" },
    });

    render(<LivePage />);

    // Wait for effect to trigger
    await screen.findByText("Pulse View");

    expect(mockUseEventStream).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-123",
        enabled: true,
        onSpan: expect.any(Function),
      })
    );
  });
});
