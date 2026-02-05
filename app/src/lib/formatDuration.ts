/**
 * Format duration for display.
 * - < 1ms: shows as microseconds (e.g., "500µs")
 * - < 1000ms: shows as milliseconds (e.g., "42.5ms")
 * - >= 1000ms: shows as seconds (e.g., "1.50s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
