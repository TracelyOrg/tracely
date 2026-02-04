/**
 * Tests for G→L chord navigation to Pulse View (AC5).
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

/** Minimal component that mirrors the dashboard G→L chord logic */
function ChordNavTestHarness() {
  const [navigatedTo, setNavigatedTo] = useState<string | null>(null);

  useKeyboardShortcut(["g", "l"], () => {
    setNavigatedTo("live");
  });

  return (
    <div>
      <div data-testid="navigated-to">{navigatedTo ?? "none"}</div>
    </div>
  );
}

describe("Dashboard G→L Chord Navigation (AC5)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("G then L navigates to live view", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => fireKey("l"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("live");
  });

  it("G then L within 500ms triggers navigation", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    act(() => fireKey("l"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("live");
  });

  it("G then L after 500ms does NOT trigger navigation", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    act(() => fireKey("l"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });

  it("G then wrong key does NOT trigger navigation", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => fireKey("d"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });

  it("L alone does NOT trigger navigation", () => {
    render(<ChordNavTestHarness />);

    act(() => fireKey("l"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });
});
