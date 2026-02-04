import { useEffect, useRef, useCallback } from "react";

const CHORD_TIMEOUT_MS = 500;

const INPUT_TAG_NAMES = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  if (INPUT_TAG_NAMES.has(el.tagName)) return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  return false;
}

interface UseKeyboardShortcutOptions {
  enabled?: boolean;
  allowInInputs?: boolean;
}

/**
 * Registers a keyboard shortcut that fires a handler on key press.
 *
 * @param keys - A single key string (e.g. "j") or an array for chord shortcuts (e.g. ["g", "l"])
 * @param handler - Called when the shortcut fires. Receives the triggering KeyboardEvent.
 * @param options - Optional configuration: `enabled` (default true), `allowInInputs` (default false)
 */
export function useKeyboardShortcut(
  keys: string | string[],
  handler: (e: KeyboardEvent) => void,
  options: UseKeyboardShortcutOptions = {}
): void {
  const { enabled = true, allowInInputs = false } = options;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const chordIndexRef = useRef(0);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keySequence = Array.isArray(keys) ? keys : [keys];
  const isChord = keySequence.length > 1;

  const resetChord = useCallback(() => {
    chordIndexRef.current = 0;
    if (chordTimerRef.current !== null) {
      clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (!allowInInputs && isEditableElement(document.activeElement)) {
        return;
      }

      const pressedKey = e.key.toLowerCase();
      const expectedKey = keySequence[chordIndexRef.current].toLowerCase();

      if (pressedKey === expectedKey) {
        if (isChord) {
          chordIndexRef.current += 1;

          if (chordIndexRef.current >= keySequence.length) {
            // Full chord matched
            resetChord();
            handlerRef.current(e);
          } else {
            // Waiting for next key in chord — set timeout
            if (chordTimerRef.current !== null) {
              clearTimeout(chordTimerRef.current);
            }
            chordTimerRef.current = setTimeout(() => {
              chordIndexRef.current = 0;
              chordTimerRef.current = null;
            }, CHORD_TIMEOUT_MS);
          }
        } else {
          // Single key match
          handlerRef.current(e);
        }
      } else {
        // Wrong key — reset chord
        if (isChord) {
          resetChord();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      resetChord();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, allowInInputs, resetChord, ...keySequence]);
}
