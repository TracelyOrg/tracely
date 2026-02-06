/**
 * Tests for G→A chord navigation to Alerts page (Story 5.1, AC1, Task 1.4).
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

/** Minimal component that mirrors the dashboard G→A chord logic */
function GAChordNavTestHarness() {
  const [navigatedTo, setNavigatedTo] = useState<string | null>(null);

  useKeyboardShortcut(["g", "a"], () => {
    setNavigatedTo("alerts");
  });

  return (
    <div>
      <div data-testid="navigated-to">{navigatedTo ?? "none"}</div>
    </div>
  );
}

describe("Dashboard G→A Chord Navigation (Story 5.1, AC1)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("G then A navigates to alerts page", () => {
    render(<GAChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => fireKey("a"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("alerts");
  });

  it("G then A within 500ms triggers navigation", () => {
    render(<GAChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    act(() => fireKey("a"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("alerts");
  });

  it("G then A after 500ms does NOT trigger navigation", () => {
    render(<GAChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    act(() => fireKey("a"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });

  it("G then wrong key does NOT trigger navigation", () => {
    render(<GAChordNavTestHarness />);

    act(() => fireKey("g"));
    act(() => fireKey("l")); // wrong key

    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });

  it("A alone does NOT trigger navigation", () => {
    render(<GAChordNavTestHarness />);

    act(() => fireKey("a"));

    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });

  it("G→A does not fire when input is focused", () => {
    function WithInput() {
      const [navigatedTo, setNavigatedTo] = useState<string | null>(null);

      useKeyboardShortcut(["g", "a"], () => {
        setNavigatedTo("alerts");
      });

      return (
        <div>
          <input type="text" data-testid="search-input" />
          <div data-testid="navigated-to">{navigatedTo ?? "none"}</div>
        </div>
      );
    }

    render(<WithInput />);

    // Focus the input
    const input = screen.getByTestId("search-input");
    input.focus();

    // Try the chord
    act(() => fireKey("g"));
    act(() => fireKey("a"));

    // Should not navigate when input is focused
    expect(screen.getByTestId("navigated-to").textContent).toBe("none");
  });
});
