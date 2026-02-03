"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useToast, dismissToast } from "@/hooks/useToast";
import type { ToastVariant } from "@/hooks/useToast";

const ICON_MAP: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const STYLE_MAP: Record<ToastVariant, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-border bg-background text-foreground",
};

export default function Toaster() {
  const { toasts } = useToast();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICON_MAP[toast.variant];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className={`pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-3 shadow-lg ${STYLE_MAP[toast.variant]}`}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1 text-sm">{toast.message}</p>
              <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
