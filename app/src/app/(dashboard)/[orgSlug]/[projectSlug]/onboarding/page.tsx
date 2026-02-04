"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  Terminal,
  Code,
  Wifi,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import { Button } from "@/components/ui/button";
import IntegrationWidget from "@/components/onboarding/IntegrationWidget";
import { useEventStream } from "@/hooks/useEventStream";
import { addToast } from "@/hooks/useToast";

interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_at: string;
}

interface ApiKeyItem {
  id: string;
  prefix: string;
  name: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface ApiKeyCreatedResponse {
  id: string;
  key: string;
  prefix: string;
  name: string | null;
  created_at: string;
}

// Animation tokens (UX9)
const TRANSITION_NORMAL = { duration: 0.25 };
const STEP_VARIANTS = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const STEPS = [
  { label: "Install SDK", icon: Terminal },
  { label: "Check Connection", icon: Wifi },
];

// --- Helpers ---

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="rounded-lg border bg-muted/50">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground font-mono">
          {language || "shell"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="text-sm font-mono">{code}</code>
      </pre>
    </div>
  );
}

// --- Stepper ---

function StepperNav({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;
        return (
          <div key={step.label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-8 transition-colors ${
                  isCompleted ? "bg-emerald-500" : "bg-border"
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  isActive ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Step 1: Install SDK (same widget as /live empty state) ---

function InstallStep({
  fullKey,
  keyPrefix,
  regenerating,
  onRegenerate,
}: {
  fullKey: string | null;
  keyPrefix: string | null;
  regenerating: boolean;
  onRegenerate: () => void;
}) {
  const hasFullKey = fullKey !== null;
  const displayKey = fullKey ?? (keyPrefix ? `${keyPrefix}...` : "your_api_key_here");
  const installSnippet = `pip install tracely-sdk
export TRACELY_API_KEY="${displayKey}"`;

  const configSnippet = `import tracely

tracely.init()  # reads TRACELY_API_KEY from env`;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Get started</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Install the SDK and send your first event to see it in real time.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="size-4 text-muted-foreground" />
            1. Install &amp; configure
          </div>
          {!hasFullKey && keyPrefix && (
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${regenerating ? "animate-spin" : ""}`} />
              {regenerating ? "Generating..." : "Regenerate key"}
            </button>
          )}
        </div>
        <CodeBlock code={installSnippet} language="shell" />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Code className="size-4 text-muted-foreground" />
          2. Add to your app
        </div>
        <CodeBlock code={configSnippet} language="python" />
      </div>
    </div>
  );
}

// --- Step 2: Check Connection (uses IntegrationWidget) ---

function CheckConnectionStep({
  connected,
  onContinue,
  continuing,
}: {
  connected: boolean;
  onContinue: () => void;
  continuing: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Check your connection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run your application and we&apos;ll detect the first event.
        </p>
      </div>

      <IntegrationWidget connected={connected} />

      {connected && (
        <div className="flex justify-center pt-4">
          <Button onClick={onContinue} disabled={continuing} size="lg">
            {continuing ? "Saving..." : "Continue to Live View"}
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---

export default function OnboardingPage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const router = useRouter();
  const { orgSlug, projectSlug } = params;
  const [currentStep, setCurrentStep] = useState(0);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [keyPrefix, setKeyPrefix] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const basePath = `/api/orgs/${orgSlug}/projects/${projectSlug}/api-keys`;

  // Fetch project info to get project_id for SSE
  useEffect(() => {
    async function loadProject() {
      try {
        const res = await apiFetch<DataEnvelope<ProjectInfo>>(
          `/api/orgs/${orgSlug}/projects/${projectSlug}`
        );
        setProjectId(res.data.id);
      } catch {
        // Non-blocking
      }
    }
    loadProject();
  }, [orgSlug, projectSlug]);

  // Generate a new key and display the full value
  const generateKey = useCallback(async () => {
    setRegenerating(true);
    try {
      const res = await apiFetch<DataEnvelope<ApiKeyCreatedResponse>>(
        basePath,
        { method: "POST", body: JSON.stringify({ name: "Onboarding" }) }
      );
      setFullKey(res.data.key);
      setKeyPrefix(res.data.prefix);
    } catch {
      // Non-blocking
    } finally {
      setRegenerating(false);
    }
  }, [basePath]);

  // On mount: if no keys → auto-generate; if keys exist → show prefix
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        const res = await apiFetch<DataEnvelope<ApiKeyItem[]>>(basePath);
        if (res.data.length > 0) {
          setKeyPrefix(res.data[0].prefix);
        } else {
          generateKey();
        }
      } catch {
        // Non-blocking
      }
    }
    init();
  }, [basePath, generateKey]);

  // SSE connection — active on check connection step when we have a project_id
  const { firstEventReceived } = useEventStream({
    projectId: projectId ?? "",
    enabled: currentStep === 1 && projectId !== null,
  });

  // Success toast on first event
  const toastFiredRef = useRef(false);
  useEffect(() => {
    if (firstEventReceived && !toastFiredRef.current) {
      toastFiredRef.current = true;
      addToast("First event received! Your app is connected.", "success");
    }
  }, [firstEventReceived]);

  const [continuing, setContinuing] = useState(false);

  async function handleContinueToLive() {
    setContinuing(true);
    try {
      await apiFetch("/api/auth/onboarding-complete", { method: "POST" });
    } catch {
      // Non-blocking — navigate even if flag update fails
    }
    router.push(`/${orgSlug}/${projectSlug}/live`);
  }

  async function handleSkip() {
    try {
      await apiFetch("/api/auth/onboarding-complete", { method: "POST" });
    } catch {
      // Non-blocking
    }
    router.push(`/${orgSlug}/${projectSlug}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Set up your project
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your application to start monitoring in minutes.
          </p>
        </div>

        <StepperNav currentStep={currentStep} />

        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              variants={STEP_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={TRANSITION_NORMAL}
            >
              {currentStep === 0 && (
                <InstallStep
                  fullKey={fullKey}
                  keyPrefix={keyPrefix}
                  regenerating={regenerating}
                  onRegenerate={generateKey}
                />
              )}
              {currentStep === 1 && (
                <CheckConnectionStep
                  connected={firstEventReceived}
                  onContinue={handleContinueToLive}
                  continuing={continuing}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="mr-1 size-4" />
            Back
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            <SkipForward className="mr-1 size-4" />
            Skip setup
          </Button>

          {currentStep < 1 ? (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(1, s + 1))}
            >
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
