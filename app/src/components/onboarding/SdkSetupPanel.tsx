"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Code, RefreshCw, Terminal } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DataEnvelope } from "@/types/api";

interface ApiKeyItem {
  id: string;
  prefix: string;
  name: string;
}

interface ApiKeyCreatedResponse {
  key: string;
  prefix: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Non-blocking
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="min-h-11 rounded px-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:min-h-0"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="rounded-lg border bg-muted/50">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{language || "shell"}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-sm">{code}</code>
      </pre>
    </div>
  );
}

export interface SdkSetupPanelProps {
  orgSlug: string;
  projectSlug: string;
  title?: string;
  description?: string;
  className?: string;
}

export function SdkSetupPanel({
  orgSlug,
  projectSlug,
  title = "Get started",
  description = "Install the SDK and send your first event to see metrics here.",
  className,
}: SdkSetupPanelProps) {
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [keyPrefix, setKeyPrefix] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const initRef = useRef(false);

  const basePath = `/api/orgs/${orgSlug}/projects/${projectSlug}/api-keys`;

  const generateKey = useCallback(async () => {
    setRegenerating(true);
    try {
      const created = await apiFetch<DataEnvelope<ApiKeyCreatedResponse>>(basePath, {
        method: "POST",
        body: JSON.stringify({ name: "Default" }),
      });
      setFullKey(created.data.key);
      setKeyPrefix(created.data.prefix);
    } catch {
      // Non-blocking
    } finally {
      setRegenerating(false);
    }
  }, [basePath]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        const res = await apiFetch<DataEnvelope<ApiKeyItem[]>>(basePath);
        if (res.data.length > 0) {
          setKeyPrefix(res.data[0].prefix);
        }
      } catch {
        // Non-blocking
      }
    }
    init();
  }, [basePath]);

  const hasFullKey = fullKey !== null;
  const hasAnyKey = hasFullKey || keyPrefix !== null;
  const displayKey = fullKey ?? (keyPrefix ? `${keyPrefix}...` : "your_api_key_here");
  const installSnippet = `pip install tracely-sdk
export TRACELY_API_KEY="${displayKey}"`;
  const configSnippet = `import tracely

tracely.init()  # reads TRACELY_API_KEY from env`;

  return (
    <div className={cn("w-full max-w-lg space-y-5", className)}>
      <div className="text-center">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="size-4 text-muted-foreground" />
            1. Install &amp; configure
          </div>
          {!hasFullKey && keyPrefix && (
            <button
              type="button"
              onClick={generateKey}
              disabled={regenerating}
              className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50 sm:min-h-0"
            >
              <RefreshCw className={cn("size-3", regenerating && "animate-spin")} />
              {regenerating ? "Generating..." : "Regenerate key"}
            </button>
          )}
        </div>
        {hasAnyKey ? (
          <CodeBlock code={installSnippet} language="shell" />
        ) : (
          <div className="flex justify-center rounded-lg border bg-muted/50 p-4">
            <button
              type="button"
              onClick={generateKey}
              disabled={regenerating}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", regenerating && "animate-spin")} />
              {regenerating ? "Generating..." : "Generate API key"}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Code className="size-4 text-muted-foreground" />
          2. Add to your app
        </div>
        <CodeBlock code={configSnippet} language="python" />
      </div>

      <div className="text-center">
        <a
          href="https://tracely.sh/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline sm:min-h-0"
        >
          <BookOpen className="size-4" />
          Full setup guide
        </a>
      </div>
    </div>
  );
}
