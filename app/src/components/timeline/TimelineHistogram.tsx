"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { formatBucketTimestamp, type TimeBucket } from "@/lib/timelineUtils";
import { cn } from "@/lib/utils";

const MARGIN = { top: 4, right: 8, bottom: 20, left: 32 };

function formatYAxis(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(value);
}

interface TimelineHistogramProps {
  buckets: TimeBucket[];
  granularity: number;
  rangeStart: number;
  rangeEnd: number;
  isLive: boolean;
  onRangeSelect?: (start: number, end: number) => void;
}

function timestampToX(
  ts: number,
  rangeStart: number,
  rangeEnd: number,
  chartWidth: number
): number {
  if (rangeEnd <= rangeStart || chartWidth <= 0) return 0;
  return ((ts - rangeStart) / (rangeEnd - rangeStart)) * chartWidth;
}

export function TimelineHistogram({
  buckets,
  granularity,
  rangeStart,
  rangeEnd,
  isLive,
  onRangeSelect,
}: TimelineHistogramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize({ width, height });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chartWidth = Math.max(0, size.width - MARGIN.left - MARGIN.right);
  const chartHeight = Math.max(0, size.height - MARGIN.top - MARGIN.bottom);

  const maxTotal = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.successCount + b.errorCount)),
    [buckets]
  );

  const yTicks = useMemo(() => {
    if (maxTotal <= 1) return [0, 1];
    const step = maxTotal <= 5 ? 1 : Math.ceil(maxTotal / 4);
    const ticks: number[] = [];
    for (let v = 0; v <= maxTotal; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== maxTotal) ticks.push(maxTotal);
    return ticks;
  }, [maxTotal]);

  const xAxisTicks = useMemo(() => {
    if (buckets.length === 0) return [];
    const step = Math.max(1, Math.floor(buckets.length / 6));
    const ticks: number[] = [];
    for (let i = 0; i < buckets.length; i += step) {
      ticks.push(buckets[i].timestamp);
    }
    if (ticks[ticks.length - 1] !== buckets[buckets.length - 1].timestamp) {
      ticks.push(buckets[buckets.length - 1].timestamp);
    }
    return ticks;
  }, [buckets]);

  const clientXToTimestamp = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || chartWidth <= 0) return rangeStart;
      const x = clientX - rect.left - MARGIN.left;
      const ratio = Math.max(0, Math.min(1, x / chartWidth));
      return rangeStart + ratio * (rangeEnd - rangeStart);
    },
    [chartWidth, rangeStart, rangeEnd]
  );

  // Pointer events (not mouse events) so drag-to-select works with touch and
  // pen input, not just a mouse — this is the only way to set a custom range
  // from the chart on mobile.
  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!onRangeSelect) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const ts = clientXToTimestamp(e.clientX);
      setDragStart(ts);
      setDragEnd(ts);
    },
    [onRangeSelect, clientXToTimestamp]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || chartWidth <= 0) return;

      const x = e.clientX - rect.left - MARGIN.left;
      const ratio = Math.max(0, Math.min(1, x / chartWidth));
      const hoverTs = rangeStart + ratio * (rangeEnd - rangeStart);
      const bucketIndex = buckets.findIndex(
        (b, i) =>
          hoverTs >= b.timestamp &&
          (i === buckets.length - 1 || hoverTs < buckets[i + 1].timestamp)
      );
      setHoveredIndex(bucketIndex >= 0 ? bucketIndex : null);

      if (dragStart !== null) {
        setDragEnd(clientXToTimestamp(e.clientX));
      }
    },
    [buckets, chartWidth, clientXToTimestamp, dragStart, rangeStart, rangeEnd]
  );

  const commitDrag = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && onRangeSelect) {
      const start = Math.min(dragStart, dragEnd);
      const end = Math.max(dragStart, dragEnd);
      if (end - start >= granularity) {
        onRangeSelect(start, end);
      }
    }
    setDragStart(null);
    setDragEnd(null);
  }, [dragStart, dragEnd, granularity, onRangeSelect]);

  const handlePointerLeave = useCallback(() => {
    setHoveredIndex(null);
    // Pointer capture (touch/pen drags) keeps events targeted at this element
    // even once the pointer leaves it, so a real drag is still resolved by
    // commitDrag on pointerup/cancel rather than being abandoned here.
    if (dragStart === null) {
      setDragEnd(null);
    }
  }, [dragStart]);

  if (buckets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data in selected time range
      </div>
    );
  }

  const hovered = hoveredIndex !== null ? buckets[hoveredIndex] : null;
  const dragX1 =
    dragStart !== null && dragEnd !== null
      ? timestampToX(Math.min(dragStart, dragEnd), rangeStart, rangeEnd, chartWidth)
      : null;
  const dragX2 =
    dragStart !== null && dragEnd !== null
      ? timestampToX(Math.max(dragStart, dragEnd), rangeStart, rangeEnd, chartWidth)
      : null;

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full select-none", onRangeSelect && "cursor-crosshair")}
      style={{ touchAction: onRangeSelect ? "none" : undefined }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={commitDrag}
      onPointerCancel={commitDrag}
      onPointerLeave={handlePointerLeave}
    >
      {size.width > 0 && size.height > 0 && (
        <svg
          width={size.width}
          height={size.height}
          className="overflow-visible"
          role="img"
          aria-label="Request timeline histogram"
        >
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {/* Y-axis grid + labels */}
            {yTicks.map((tick) => {
              const y = chartHeight - (tick / maxTotal) * chartHeight;
              return (
                <g key={tick}>
                  <line
                    x1={0}
                    y1={y}
                    x2={chartWidth}
                    y2={y}
                    stroke="var(--border)"
                    strokeOpacity={0.85}
                  />
                  <text
                    x={-6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize={10}
                    fill="var(--muted-foreground)"
                  >
                    {formatYAxis(tick)}
                  </text>
                </g>
              );
            })}

            {/* Stacked bars */}
            {buckets.map((bucket, i) => {
              const x = timestampToX(bucket.timestamp, rangeStart, rangeEnd, chartWidth);
              const nextX = timestampToX(
                bucket.timestamp + granularity,
                rangeStart,
                rangeEnd,
                chartWidth
              );
              const barWidth = Math.max(1, nextX - x - 1);
              const total = bucket.successCount + bucket.errorCount;
              const totalHeight = (total / maxTotal) * chartHeight;
              const errorHeight = (bucket.errorCount / maxTotal) * chartHeight;
              const successHeight = totalHeight - errorHeight;
              const baseY = chartHeight;

              return (
                <g key={bucket.timestamp}>
                  {successHeight > 0 && (
                    <rect
                      x={x}
                      y={baseY - totalHeight}
                      width={barWidth}
                      height={successHeight}
                      fill="var(--success)"
                    />
                  )}
                  {errorHeight > 0 && (
                    <rect
                      x={x}
                      y={baseY - totalHeight + successHeight}
                      width={barWidth}
                      height={errorHeight}
                      fill="var(--destructive)"
                      rx={successHeight <= 0 ? 2 : 0}
                      ry={successHeight <= 0 ? 2 : 0}
                    />
                  )}
                  {hoveredIndex === i && (
                    <rect
                      x={x}
                      y={0}
                      width={barWidth}
                      height={chartHeight}
                      fill="var(--foreground)"
                      fillOpacity={0.06}
                    />
                  )}
                </g>
              );
            })}

            {/* Live marker */}
            {isLive && (
              <line
                x1={timestampToX(rangeEnd, rangeStart, rangeEnd, chartWidth)}
                y1={0}
                x2={timestampToX(rangeEnd, rangeStart, rangeEnd, chartWidth)}
                y2={chartHeight}
                stroke="var(--success)"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            )}

            {/* Drag selection */}
            {dragX1 !== null && dragX2 !== null && dragX2 - dragX1 > 1 && (
              <rect
                x={dragX1}
                y={0}
                width={dragX2 - dragX1}
                height={chartHeight}
                fill="var(--foreground)"
                fillOpacity={0.08}
                stroke="var(--foreground)"
                strokeOpacity={0.25}
              />
            )}

            {/* X-axis baseline */}
            <line
              x1={0}
              y1={chartHeight}
              x2={chartWidth}
              y2={chartHeight}
              stroke="var(--border)"
            />

            {/* X-axis ticks */}
            {xAxisTicks.map((ts) => {
              const x = timestampToX(ts, rangeStart, rangeEnd, chartWidth);
              return (
                <g key={ts}>
                  <line
                    x1={x}
                    y1={chartHeight}
                    x2={x}
                    y2={chartHeight + 4}
                    stroke="var(--border)"
                  />
                  <text
                    x={x}
                    y={chartHeight + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--muted-foreground)"
                  >
                    {formatBucketTimestamp(ts, granularity)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {/* Tooltip */}
      {hovered && hoveredIndex !== null && dragStart === null && (
        <div className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 rounded border border-border bg-popover px-2 py-1 text-xs shadow-md">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-foreground">{hovered.successCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <span className="text-foreground">{hovered.errorCount}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
