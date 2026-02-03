"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

// UX9 animation tokens
const FAST = 0.15;
const NORMAL = 0.25;
const SMOOTH = 0.4;

interface IntegrationWidgetProps {
  connected: boolean;
}

function PulsingDot() {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      aria-label="Waiting for connection"
    >
      {/* Outer pulse ring */}
      <motion.div
        className="absolute size-10 rounded-full bg-emerald-500/20"
        animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Inner dot */}
      <motion.div
        className="size-4 rounded-full bg-emerald-500"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

function GreenCheckmark() {
  return (
    <motion.div
      className="flex items-center justify-center"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
        duration: SMOOTH,
      }}
      aria-label="Connected"
    >
      <motion.div
        className="flex size-12 items-center justify-center rounded-full bg-emerald-500"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
      >
        <motion.div
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: NORMAL, duration: NORMAL }}
        >
          <Check className="size-6 text-white" strokeWidth={3} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function IntegrationWidget({
  connected,
}: IntegrationWidgetProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
      <AnimatePresence mode="wait">
        {connected ? (
          <motion.div
            key="connected"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FAST }}
          >
            <GreenCheckmark />
          </motion.div>
        ) : (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FAST }}
          >
            <PulsingDot />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {connected ? (
          <motion.div
            key="connected-text"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: NORMAL }}
            className="mt-4 text-center"
          >
            <p className="text-sm font-medium text-emerald-600">
              Connection verified
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your app is sending telemetry data.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="waiting-text"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: NORMAL }}
            className="mt-4 text-center"
          >
            <p className="text-sm font-medium">Waiting for first event...</p>
            {/* UX6: empty state — explain WHY empty + offer clear action */}
            <p className="mt-1 text-xs text-muted-foreground">
              Run your app with the SDK installed to see data appear here.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
