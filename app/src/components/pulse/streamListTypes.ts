import type { SpanEvent } from "@/types/span";

export type DisplayItem =
  | { type: "root"; span: SpanEvent; childCount: number; hasErrorChildren: boolean; isExpanded: boolean }
  | { type: "child"; span: SpanEvent; depth: number; childCount: number; isLast: boolean };

export function itemKey(item: DisplayItem): string {
  return `${item.type}-${item.span.span_id}`;
}

export const STREAM_ROW_HEIGHT = 40;

export const STREAM_SKELETON_WIDTHS = [55, 42, 68, 47, 60, 50, 63, 45, 57, 52, 65, 48];
