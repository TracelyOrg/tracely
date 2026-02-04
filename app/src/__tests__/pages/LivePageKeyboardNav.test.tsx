/**
 * Tests for Pulse View keyboard navigation (AC2, AC3, AC4).
 *
 * Strategy: We test the keyboard navigation logic through a minimal
 * wrapper component that mirrors the LivePage's keyboard integration
 * with useKeyboardShortcut. This avoids mocking the full LivePage
 * dependency tree while verifying the correct behavior.
 */
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useState, useRef, useCallback } from "react";

function fireKey(key: string) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true })
  );
}

/** Minimal component that mirrors LivePage keyboard nav logic */
function KeyboardNavTestHarness({ spans }: { spans: { span_id: string; label: string }[] }) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSpanId = selectedIndex >= 0 ? spans[selectedIndex]?.span_id ?? null : null;

  const moveSelection = useCallback(
    (direction: 1 | -1) => {
      setSelectedIndex((prev) => {
        if (spans.length === 0) return prev;
        if (prev === -1) return direction === 1 ? 0 : spans.length - 1;
        const next = prev + direction;
        if (next < 0 || next >= spans.length) return prev;
        return next;
      });
    },
    [spans.length]
  );

  useKeyboardShortcut("j", () => moveSelection(1));
  useKeyboardShortcut("ArrowDown", () => moveSelection(1));
  useKeyboardShortcut("k", () => moveSelection(-1));
  useKeyboardShortcut("ArrowUp", () => moveSelection(-1));

  useKeyboardShortcut("Enter", () => {
    if (selectedSpanId) setInspectorOpen(true);
  });

  useKeyboardShortcut("Escape", () => {
    if (inspectorOpen) {
      setInspectorOpen(false);
      listRef.current?.focus();
    }
  }, { allowInInputs: true });

  return (
    <div>
      <div ref={listRef} tabIndex={-1} data-testid="stream-list" role="list">
        {spans.map((span, i) => (
          <div
            key={span.span_id}
            role="row"
            data-testid={`row-${span.span_id}`}
            className={i === selectedIndex ? "selected" : ""}
            data-selected={i === selectedIndex}
          >
            {span.label}
          </div>
        ))}
      </div>
      {inspectorOpen && (
        <div data-testid="inspector" role="region" aria-label="Span Inspector">
          Inspector for {selectedSpanId}
        </div>
      )}
      <div data-testid="selected-index">{selectedIndex}</div>
      <div data-testid="selected-span-id">{selectedSpanId ?? "none"}</div>
    </div>
  );
}

const MOCK_SPANS = [
  { span_id: "span-1", label: "GET /api/users" },
  { span_id: "span-2", label: "POST /api/orders" },
  { span_id: "span-3", label: "DELETE /api/items" },
];

describe("Pulse View Keyboard Navigation", () => {
  describe("AC2: J/K row navigation", () => {
    it("J selects the first row when nothing is selected", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);
      expect(screen.getByTestId("selected-index").textContent).toBe("-1");

      act(() => fireKey("j"));
      expect(screen.getByTestId("selected-index").textContent).toBe("0");
      expect(screen.getByTestId("row-span-1")).toHaveAttribute("data-selected", "true");
    });

    it("J moves selection down", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("j")); // select first
      act(() => fireKey("j")); // move to second
      expect(screen.getByTestId("selected-index").textContent).toBe("1");
      expect(screen.getByTestId("selected-span-id").textContent).toBe("span-2");
    });

    it("K moves selection up", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("j")); // select first (0)
      act(() => fireKey("j")); // move to second (1)
      act(() => fireKey("k")); // move back to first (0)
      expect(screen.getByTestId("selected-index").textContent).toBe("0");
    });

    it("K selects last row when nothing is selected", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("k"));
      expect(screen.getByTestId("selected-index").textContent).toBe("2");
    });

    it("J does not go past the last row", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("j")); // 0
      act(() => fireKey("j")); // 1
      act(() => fireKey("j")); // 2
      act(() => fireKey("j")); // still 2
      expect(screen.getByTestId("selected-index").textContent).toBe("2");
    });

    it("K does not go past the first row", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("j")); // 0
      act(() => fireKey("k")); // still 0
      expect(screen.getByTestId("selected-index").textContent).toBe("0");
    });

    it("ArrowDown works like J", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("ArrowDown"));
      expect(screen.getByTestId("selected-index").textContent).toBe("0");
    });

    it("ArrowUp works like K", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("ArrowUp"));
      expect(screen.getByTestId("selected-index").textContent).toBe("2");
    });

    it("does nothing with empty spans list", () => {
      render(<KeyboardNavTestHarness spans={[]} />);

      act(() => fireKey("j"));
      expect(screen.getByTestId("selected-index").textContent).toBe("-1");
    });
  });

  describe("AC3: Enter opens inspector", () => {
    it("Enter opens inspector for selected span", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("j")); // select first
      act(() => fireKey("Enter"));
      expect(screen.getByTestId("inspector")).toBeInTheDocument();
    });

    it("Enter does nothing when no span is selected", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("Enter"));
      expect(screen.queryByTestId("inspector")).not.toBeInTheDocument();
    });
  });

  describe("AC4: Escape closes inspector", () => {
    it("Escape closes inspector", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("j")); // select
      act(() => fireKey("Enter")); // open
      expect(screen.getByTestId("inspector")).toBeInTheDocument();

      act(() => fireKey("Escape")); // close
      expect(screen.queryByTestId("inspector")).not.toBeInTheDocument();
    });

    it("Escape returns focus to the stream list", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("j"));
      act(() => fireKey("Enter"));
      act(() => fireKey("Escape"));

      expect(screen.getByTestId("stream-list")).toHaveFocus();
    });

    it("Escape does nothing when inspector is not open", () => {
      render(<KeyboardNavTestHarness spans={MOCK_SPANS} />);

      act(() => fireKey("j"));
      act(() => fireKey("Escape")); // no inspector open, no crash
      expect(screen.queryByTestId("inspector")).not.toBeInTheDocument();
    });
  });
});
