import { useEffect, useRef, useState } from "react";

/**
 * Hook that returns the previous value of a variable.
 * Useful for detecting value changes and computing trends.
 *
 * @param value - The current value to track
 * @returns The previous value (undefined on first render)
 */
export function usePrevious<T>(value: T): T | undefined {
  const [previous, setPrevious] = useState<T | undefined>(undefined);
  const currentRef = useRef<T>(value);

  useEffect(() => {
    setPrevious(currentRef.current);
    currentRef.current = value;
  }, [value]);

  return previous;
}
