/**
 * Tests for G→D chord navigation to Dashboard (Story 4.2, AC3).
 *
 * Strategy: Test the chord navigation behavior through a minimal
 * component that uses useKeyboardShortcut with the same chord pattern
 * used in the dashboard layout.
 */
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useState } from "react";

function fireKey(key: string) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true })
  );
}

/** Minimal component that mirrors the dashboard G→D chord logic */
function ChordNavTestHarness() {
  const [navigatedTo, setNavigatedTo] = useState<string | null>(null);

  // G→L chord (existing)
  useKeyboardShortcut(["g", "l"], () => {
    setNavigatedTo("live");
  });

  // G→D chord (Story 4.2)
  useKeyboardShortcut(["g", "d"], () => {
    setNavigatedTo("dashboard");
  });

  return (
    <div>
      <div data-testid="navigated-to">{navigatedTo ?? "none"}</div>
    </div>
  );
}

describe("Dashboard G→D Chord Navigation (Story 4.2 AC3)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("G then D navigates to dashboard view", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => fireKey("d"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("dashboard");
  });

  it("G then D within 500ms triggers navigation", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    act(() => fireKey("d"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("dashboard");
  });

  it("G then D after 500ms does NOT trigger navigation (Task 5.3)", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    act(() => fireKey("d"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });

  it("G then wrong key does NOT trigger navigation", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => fireKey("x"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });

  it("D alone does NOT trigger navigation", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("d"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });

  it("G then L navigates to live (not dashboard)", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => fireKey("l"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("live");
  });
});
