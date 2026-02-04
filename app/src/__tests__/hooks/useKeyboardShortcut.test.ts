import { renderHook } from "@testing-library/react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

function fireKey(key: string, options?: Partial<KeyboardEvent>) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...options })
  );
}

describe("useKeyboardShortcut", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls handler on single key press", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("j", handler));

    fireKey("j");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("matches keys case-insensitively", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("j", handler));

    fireKey("J");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire when a different key is pressed", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("j", handler));

    fireKey("k");
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire when input element is focused", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("j", handler));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "j", bubbles: true })
    );
    // Also test via the element directly
    Object.defineProperty(document, "activeElement", {
      get: () => input,
      configurable: true,
    });
    fireKey("j");

    // Should not fire because input is focused
    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(input);
    // Restore activeElement
    Object.defineProperty(document, "activeElement", {
      get: () => document.body,
      configurable: true,
    });
  });

  it("does not fire when textarea element is focused", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("j", handler));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    Object.defineProperty(document, "activeElement", {
      get: () => textarea,
      configurable: true,
    });
    fireKey("j");

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
    Object.defineProperty(document, "activeElement", {
      get: () => document.body,
      configurable: true,
    });
  });

  it("does not fire when contentEditable element is focused", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("j", handler));

    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);
    div.focus();

    Object.defineProperty(document, "activeElement", {
      get: () => div,
      configurable: true,
    });
    fireKey("j");

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(div);
    Object.defineProperty(document, "activeElement", {
      get: () => document.body,
      configurable: true,
    });
  });

  it("does not fire when select element is focused", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("j", handler));

    const select = document.createElement("select");
    document.body.appendChild(select);
    select.focus();

    Object.defineProperty(document, "activeElement", {
      get: () => select,
      configurable: true,
    });
    fireKey("j");

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(select);
    Object.defineProperty(document, "activeElement", {
      get: () => document.body,
      configurable: true,
    });
  });

  it("supports chord shortcuts (e.g., g then l within 500ms)", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut(["g", "l"], handler));

    fireKey("g");
    expect(handler).not.toHaveBeenCalled();

    fireKey("l");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire chord if second key exceeds 500ms timeout", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut(["g", "l"], handler));

    fireKey("g");
    jest.advanceTimersByTime(600);
    fireKey("l");

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire chord if wrong second key is pressed", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut(["g", "l"], handler));

    fireKey("g");
    fireKey("d");

    expect(handler).not.toHaveBeenCalled();
  });

  it("supports Escape key (special key)", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("Escape", handler));

    fireKey("Escape");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports Enter key", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("Enter", handler));

    fireKey("Enter");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("j", handler, { enabled: false }));

    fireKey("j");
    expect(handler).not.toHaveBeenCalled();
  });

  it("cleans up event listeners on unmount", () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useKeyboardShortcut("j", handler));

    unmount();
    fireKey("j");
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the keyboard event to the handler", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcut("j", handler));

    fireKey("j");
    expect(handler).toHaveBeenCalledWith(expect.any(KeyboardEvent));
  });

  it("supports multiple shortcuts registered simultaneously", () => {
    const jHandler = jest.fn();
    const kHandler = jest.fn();
    renderHook(() => {
      useKeyboardShortcut("j", jHandler);
      useKeyboardShortcut("k", kHandler);
    });

    fireKey("j");
    expect(jHandler).toHaveBeenCalledTimes(1);
    expect(kHandler).not.toHaveBeenCalled();

    fireKey("k");
    expect(kHandler).toHaveBeenCalledTimes(1);
  });

  it("Escape fires even when input is focused when allowInInputs is true", () => {
    const handler = jest.fn();
    renderHook(() =>
      useKeyboardShortcut("Escape", handler, { allowInInputs: true })
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    Object.defineProperty(document, "activeElement", {
      get: () => input,
      configurable: true,
    });
    fireKey("Escape");

    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(input);
    Object.defineProperty(document, "activeElement", {
      get: () => document.body,
      configurable: true,
    });
  });
});
