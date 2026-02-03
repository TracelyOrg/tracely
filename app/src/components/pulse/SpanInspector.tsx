"use client";

import { useMemo, useState } from "react";
import {
  X,
  Copy,
  Check,
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpanDetail } from "@/types/span";

// --- Types ---

interface SpanInspectorProps {
  detail: SpanDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

type TabId = "request" | "response" | "exceptions";

// --- Helpers ---

function CopyValue({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return "text-emerald-500";
  if (code >= 400 && code < 500) return "text-amber-500";
  if (code >= 500) return "text-red-500";
  return "text-muted-foreground";
}

function StatusIcon({ code }: { code: number }) {
  if (code >= 200 && code < 300)
    return <CheckCircle className="size-4 text-emerald-500" />;
  if (code >= 400 && code < 500)
    return <AlertTriangle className="size-4 text-amber-500" />;
  if (code >= 500)
    return <XCircle className="size-4 text-red-500" />;
  return null;
}

/** Format a JSON string for display. Returns formatted string or original if not valid JSON. */
function formatBody(raw: string): string {
  if (!raw || !raw.trim()) return "";
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

/** Render a value, replacing [REDACTED] with a lock icon indicator. */
function RedactedValue({ value }: { value: string }) {
  if (value === "[REDACTED]") {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <ShieldAlert className="size-3" />
        <span className="text-xs italic">[REDACTED]</span>
      </span>
    );
  }
  return <span className="break-all">{value}</span>;
}

// --- Skeleton ---

function InspectorSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${70 - i * 10}%` }} />
        ))}
      </div>
    </div>
  );
}

// --- Headers Table ---

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No headers</p>;
  }
  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Header</th>
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Value</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {entries.map(([key, val]) => (
            <tr key={key} className="border-b last:border-0">
              <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">{key}</td>
              <td className="px-3 py-1.5">
                <RedactedValue value={val} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Body Display ---

function BodyBlock({ body, label }: { body: string; label: string }) {
  const formatted = useMemo(() => formatBody(body), [body]);

  if (!formatted) {
    return <p className="text-xs text-muted-foreground italic">No {label.toLowerCase()}</p>;
  }

  // Check for redacted values within the body
  const lines = formatted.split("\n");

  return (
    <div className="rounded border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <CopyValue text={formatted} />
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed font-mono">
        {lines.map((line, i) => {
          const hasRedacted = line.includes("[REDACTED]");
          return (
            <div key={i}>
              {hasRedacted ? (
                <span>
                  {line.split("[REDACTED]").map((part, j, arr) => (
                    <span key={j}>
                      {part}
                      {j < arr.length - 1 && (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                          <ShieldAlert className="inline size-3" />
                          <span className="italic">[REDACTED]</span>
                        </span>
                      )}
                    </span>
                  ))}
                </span>
              ) : (
                line
              )}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

// --- Request Tab (AC2) ---

function RequestTab({ detail }: { detail: SpanDetail }) {
  // Extract query params from attributes (keys starting with "http.request.query.")
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    for (const [key, val] of Object.entries(detail.attributes)) {
      if (key.startsWith("http.request.query.")) {
        params[key.replace("http.request.query.", "")] = val;
      }
    }
    return params;
  }, [detail.attributes]);

  return (
    <div className="space-y-4 p-4">
      {/* Method + URL */}
      <div className="flex items-center gap-2">
        <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600">
          {detail.http_method}
        </span>
        <span className="font-mono text-sm break-all">{detail.http_route}</span>
        <CopyValue text={`${detail.http_method} ${detail.http_route}`} />
      </div>

      {/* Query Parameters */}
      {Object.keys(queryParams).length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Query Parameters
          </h4>
          <HeadersTable headers={queryParams} />
        </div>
      )}

      {/* Request Headers */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Request Headers
        </h4>
        <HeadersTable headers={detail.request_headers} />
      </div>

      {/* Request Body */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Request Body
        </h4>
        <BodyBlock body={detail.request_body} label="Request Body" />
      </div>
    </div>
  );
}

// --- Response Tab (AC3) ---

function ResponseTab({ detail }: { detail: SpanDetail }) {
  return (
    <div className="space-y-4 p-4">
      {/* Status + Timing */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <StatusIcon code={detail.http_status_code} />
          <span className={cn("text-lg font-semibold font-mono", statusColor(detail.http_status_code))}>
            {detail.http_status_code}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-3.5" />
          <span className="font-mono">{detail.duration_ms.toFixed(1)}ms</span>
        </div>
      </div>

      {/* Timing Breakdown */}
      <div className="rounded border bg-muted/30 p-3">
        <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Timing
        </h4>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total duration</span>
            <span>{detail.duration_ms.toFixed(1)}ms</span>
          </div>
          {detail.start_time && detail.end_time && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start</span>
              <span>{new Date(detail.start_time).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Response Headers */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Response Headers
        </h4>
        <HeadersTable headers={detail.response_headers} />
      </div>

      {/* Response Body */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Response Body
        </h4>
        <BodyBlock body={detail.response_body} label="Response Body" />
      </div>
    </div>
  );
}

// --- Exceptions Tab (AC4) ---

function ExceptionsTab({ detail }: { detail: SpanDetail }) {
  const hasError =
    detail.status_code === "ERROR" || detail.http_status_code >= 500;

  if (!hasError && !detail.status_message) {
    return (
      <div className="flex h-32 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">No exceptions recorded for this span.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Error Summary */}
      <div className="rounded border border-red-500/30 bg-red-500/5 p-3">
        <div className="flex items-center gap-2">
          <XCircle className="size-4 text-red-500" />
          <span className="text-sm font-medium text-red-600">
            {detail.http_status_code >= 500
              ? `HTTP ${detail.http_status_code} Server Error`
              : "Error"}
          </span>
        </div>
        {detail.status_message && (
          <p className="mt-2 font-mono text-sm">{detail.status_message}</p>
        )}
      </div>

      {/* Error details from attributes */}
      {detail.attributes["exception.type"] && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Exception Type
          </h4>
          <p className="font-mono text-sm">{detail.attributes["exception.type"]}</p>
        </div>
      )}

      {detail.attributes["exception.message"] && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Message
          </h4>
          <p className="font-mono text-sm">{detail.attributes["exception.message"]}</p>
        </div>
      )}

      {detail.attributes["exception.stacktrace"] && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Stack Trace
          </h4>
          <pre className="overflow-x-auto rounded border bg-muted/30 p-3 text-xs leading-relaxed font-mono">
            {detail.attributes["exception.stacktrace"]}
          </pre>
        </div>
      )}

      {/* Response body for context */}
      {detail.response_body && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Error Response
          </h4>
          <BodyBlock body={detail.response_body} label="Error Response" />
        </div>
      )}
    </div>
  );
}

// --- Main Inspector Component ---

const TABS: { id: TabId; label: string }[] = [
  { id: "request", label: "Request" },
  { id: "response", label: "Response" },
  { id: "exceptions", label: "Exceptions" },
];

export function SpanInspector({ detail, loading, error, onClose }: SpanInspectorProps) {
  const isError = detail
    ? detail.status_code === "ERROR" || detail.http_status_code >= 500
    : false;

  const [activeTab, setActiveTab] = useState<TabId>(
    isError ? "exceptions" : "request"
  );

  // Update default tab when detail changes (auto-select exceptions for errors)
  const prevSpanId = useMemo(() => detail?.span_id, [detail?.span_id]);
  if (detail && detail.span_id !== prevSpanId) {
    const shouldAutoSelectExceptions =
      detail.status_code === "ERROR" || detail.http_status_code >= 500;
    if (shouldAutoSelectExceptions && activeTab !== "exceptions") {
      setActiveTab("exceptions");
    }
  }

  return (
    <div className="flex h-full flex-col border-l bg-background">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          isError && "border-red-500/30 bg-red-500/5"
        )}
      >
        <div className="min-w-0 flex-1">
          {detail ? (
            <>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600">
                  {detail.http_method}
                </span>
                <span className="truncate font-mono text-sm font-medium">
                  {detail.span_name}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">{detail.service_name}</span>
                {detail.environment && (
                  <span className="rounded bg-muted px-1.5 py-0.5">{detail.environment}</span>
                )}
                <span className="font-mono">
                  <Clock className="mr-0.5 inline size-3" />
                  {detail.duration_ms.toFixed(1)}ms
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span>trace: {detail.trace_id.slice(-8)}</span>
                <CopyValue text={detail.trace_id} />
                <span>span: {detail.span_id.slice(-8)}</span>
                <CopyValue text={detail.span_id} />
              </div>
            </>
          ) : loading ? (
            <div className="space-y-1">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
          ) : null}
        </div>
        <button
          onClick={onClose}
          className="ml-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Close inspector"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.id === "exceptions" && isError && (
              <span className="ml-1 inline-flex size-1.5 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {loading && <InspectorSkeleton />}
        {error && (
          <div className="flex h-32 items-center justify-center p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {detail && !loading && (
          <>
            {activeTab === "request" && <RequestTab detail={detail} />}
            {activeTab === "response" && <ResponseTab detail={detail} />}
            {activeTab === "exceptions" && <ExceptionsTab detail={detail} />}
          </>
        )}
      </div>
    </div>
  );
}
