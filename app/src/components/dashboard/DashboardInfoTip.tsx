"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

const TIP_MAX_WIDTH = 280;
const VIEWPORT_PAD = 12;

function subscribeNever() {
  return () => {};
}

/** True once mounted on the client — avoids portaling during SSR without an effect+setState. */
function useIsMounted(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
}

interface DashboardInfoTipProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

function clampTooltipPosition(trigger: DOMRect): { top: number; left: number; width: number } {
  const width = Math.min(TIP_MAX_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);

  let left = trigger.right - width;
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - VIEWPORT_PAD - width));

  const top = trigger.bottom + 6;
  return { top, left, width };
}

export function DashboardInfoTip({ label, children, className }: DashboardInfoTipProps) {
  const [open, setOpen] = useState(false);
  const mounted = useIsMounted();
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      // Resets the DOM-measured position when closed; the rest of this
      // effect measures rootRef/tipRef (legitimate DOM sync the linter
      // can't see past this guard clause).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition(null);
      return;
    }

    function updatePosition() {
      if (!rootRef.current) return;
      setPosition(clampTooltipPosition(rootRef.current.getBoundingClientRect()));
    }

    updatePosition();

    const tipEl = tipRef.current;
    if (tipEl && rootRef.current) {
      const measured = tipEl.getBoundingClientRect();
      const trigger = rootRef.current.getBoundingClientRect();
      let top = trigger.bottom + 6;
      if (top + measured.height > window.innerHeight - VIEWPORT_PAD) {
        top = Math.max(VIEWPORT_PAD, trigger.top - measured.height - 6);
      }
      setPosition((prev) => (prev ? { ...prev, top } : null));
    }
  }, [open, children]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || tipRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const tooltip =
    open && position && mounted ? (
      <span
        ref={tipRef}
        id={tipId}
        role="tooltip"
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          width: position.width,
          zIndex: 50,
        }}
        className="rounded-md border border-border bg-popover px-3 py-2 text-[11px] leading-relaxed text-popover-foreground shadow-md"
      >
        {children}
      </span>
    ) : null;

  return (
    <>
      <span ref={rootRef} className={cn("relative inline-flex shrink-0", className)}>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          aria-controls={open ? tipId : undefined}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:min-h-7 sm:min-w-7"
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </button>
      </span>
      {mounted && tooltip ? createPortal(tooltip, document.body) : null}
    </>
  );
}
