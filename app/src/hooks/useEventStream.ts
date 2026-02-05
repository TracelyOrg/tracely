import { useEffect, useRef, useCallback, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Reconnect backoff: 100ms → 1s → 5s max
const INITIAL_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 5000;
const BACKOFF_MULTIPLIER = 2;

// Heartbeat timeout: if no heartbeat in 15s (3x the 5s interval), reconnect
const HEARTBEAT_TIMEOUT_MS = 15_000;

export type StreamStatus = "connecting" | "connected" | "disconnected";

interface UseEventStreamOptions {
  projectId: string;
  enabled?: boolean;
  onSpan?: (data: Record<string, unknown>) => void;
}

interface UseEventStreamResult {
  status: StreamStatus;
  firstEventReceived: boolean;
}

export function useEventStream({
  projectId,
  enabled = true,
  onSpan,
}: UseEventStreamOptions): UseEventStreamResult {
  const [status, setStatus] = useState<StreamStatus>("disconnected");
  const [firstEventReceived, setFirstEventReceived] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSpanRef = useRef(onSpan);
  const connectRef = useRef<(() => void) | null>(null);

  const clearTimers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const resetHeartbeatTimer = useCallback(
    (reconnect: () => void) => {
      if (heartbeatTimerRef.current) {
        clearTimeout(heartbeatTimerRef.current);
      }
      heartbeatTimerRef.current = setTimeout(() => {
        // No heartbeat received — connection likely stale
        eventSourceRef.current?.close();
        reconnect();
      }, HEARTBEAT_TIMEOUT_MS);
    },
    []
  );

  const connect = useCallback(() => {
    if (!projectId || !enabled) return;

    // Close existing connection
    eventSourceRef.current?.close();
    clearTimers();

    const url = `${API_BASE}/api/stream/${projectId}`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    function scheduleReconnect() {
      const delay = backoffRef.current;
      backoffRef.current = Math.min(
        delay * BACKOFF_MULTIPLIER,
        MAX_BACKOFF_MS
      );
      setStatus("disconnected");
      reconnectTimerRef.current = setTimeout(() => connectRef.current?.(), delay);
    }

    es.onopen = () => {
      setStatus("connected");
      backoffRef.current = INITIAL_BACKOFF_MS;
      resetHeartbeatTimer(scheduleReconnect);
    };

    es.addEventListener("heartbeat", () => {
      resetHeartbeatTimer(scheduleReconnect);
    });

    es.addEventListener("span", (event) => {
      resetHeartbeatTimer(scheduleReconnect);
      setFirstEventReceived(true);
      try {
        const data = JSON.parse(event.data);
        onSpanRef.current?.(data);
      } catch {
        // Ignore malformed data
      }
    });

    es.onerror = () => {
      es.close();
      scheduleReconnect();
    };
  }, [projectId, enabled, clearTimers, resetHeartbeatTimer]);

  useEffect(() => {
    onSpanRef.current = onSpan;
    connectRef.current = connect;
  });

  useEffect(() => {
    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      clearTimers();
    };
  }, [connect, clearTimers]);

  // Reconnect immediately when tab becomes visible (handles browser throttling)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Check if connection is stale or closed
        const es = eventSourceRef.current;
        if (!es || es.readyState === EventSource.CLOSED) {
          backoffRef.current = INITIAL_BACKOFF_MS; // Reset backoff for fresh start
          connectRef.current?.();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { status, firstEventReceived };
}
