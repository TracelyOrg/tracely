import { useCallback, useSyncExternalStore } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

// UX4: success auto-dismiss 4s, errors persist
const AUTO_DISMISS_MS = 4000;
const MAX_VISIBLE = 3;

let toasts: Toast[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Toast[] {
  return toasts;
}

export function addToast(message: string, variant: ToastVariant = "info") {
  const id = String(++nextId);
  const toast: Toast = { id, message, variant };

  toasts = [...toasts, toast];

  // Enforce max visible
  if (toasts.length > MAX_VISIBLE) {
    toasts = toasts.slice(-MAX_VISIBLE);
  }

  emit();

  // Auto-dismiss for non-error toasts (UX4)
  if (variant !== "error") {
    setTimeout(() => {
      dismissToast(id);
    }, AUTO_DISMISS_MS);
  }

  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToast() {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => addToast(message, variant),
    []
  );

  const dismiss = useCallback((id: string) => dismissToast(id), []);

  return { toasts: currentToasts, toast, dismiss };
}
