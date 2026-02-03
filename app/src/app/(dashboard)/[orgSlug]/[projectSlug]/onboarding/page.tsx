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
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
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
  { label: "Add to App", icon: Code },
  { label: "Verify Connection", icon: Wifi },
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
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground font-mono">
          {language || "shell"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4">
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

// --- Step 1: Install SDK (AC #2) ---

function InstallStep() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Install the Tracely SDK</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the Tracely SDK to your Python project using pip.
        </p>
      </div>
      <CodeBlock code="pip install tracely" language="shell" />
      <p className="text-sm text-muted-foreground">
        The SDK has zero runtime dependencies beyond{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          httpx
        </code>
        .
      </p>
    </div>
  );
}

// --- Step 2: Configure (AC #3) ---

function ConfigureStep({
  apiKey,
  existingKeys,
  generating,
  error,
  onGenerate,
}: {
  apiKey: string | null;
  existingKeys: ApiKeyItem[];
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  const snippet = `import tracely

# Set your API key as an environment variable:
# export TRACELY_API_KEY="${apiKey || "your_api_key_here"}"

tracely.init()  # reads TRACELY_API_KEY from env`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Add Tracely to your app</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Initialize the SDK in your application entry point.
        </p>
      </div>

      {!apiKey && existingKeys.length === 0 && (
        <div className="rounded-lg border border-dashed p-4">
          {generating ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Generating your API key...
              </p>
            </div>
          ) : error ? (
            <div>
              <p className="text-sm text-destructive">{error}</p>
              <Button
                onClick={onGenerate}
                className="mt-3"
                size="sm"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Preparing your API key...
              </p>
            </div>
          )}
        </div>
      )}

      {apiKey && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Your API Key (shown once):</p>
            <CopyButton text={apiKey} />
          </div>
          <code className="mt-2 block break-all rounded bg-muted p-2 font-mono text-sm">
            {apiKey}
          </code>
        </div>
      )}

      {!apiKey && existingKeys.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm">
            API key already configured:{" "}
            <code className="font-mono text-xs">{existingKeys[0].prefix}...</code>
          </p>
        </div>
      )}

      <CodeBlock code={snippet} language="python" />

      <p className="text-sm text-muted-foreground">
        Set the{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          TRACELY_API_KEY
        </code>{" "}
        environment variable, then initialize the SDK.
      </p>
    </div>
  );
}

// --- Step 3: Verify (AC #4-5, uses IntegrationWidget) ---

function VerifyStep({
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
        <h2 className="text-lg font-semibold">Verify your connection</h2>
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
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [existingKeys, setExistingKeys] = useState<ApiKeyItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const loadKeys = useCallback(async () => {
    try {
      const res = await apiFetch<DataEnvelope<ApiKeyItem[]>>(basePath);
      setExistingKeys(res.data);
      return res.data;
    } catch {
      // Non-blocking — wizard can still proceed
      return null;
    }
  }, [basePath]);

  const generateKey = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await apiFetch<DataEnvelope<ApiKeyCreatedResponse>>(
        basePath,
        {
          method: "POST",
          body: JSON.stringify({ name: "Onboarding" }),
        }
      );
      setApiKey(res.data.key);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to generate API key");
      }
    } finally {
      setGenerating(false);
    }
  }, [basePath]);

  // Auto-generate API key on mount if none exist
  const autoGeneratedRef = useRef(false);
  useEffect(() => {
    async function init() {
      const keys = await loadKeys();
      if (keys && keys.length === 0 && !autoGeneratedRef.current) {
        autoGeneratedRef.current = true;
        generateKey();
      }
    }
    init();
  }, [loadKeys, generateKey]);

  // SSE connection — only active on verify step when we have a project_id
  const { firstEventReceived } = useEventStream({
    projectId: projectId ?? "",
    enabled: currentStep === 2 && projectId !== null,
  });

  // AC #8: success toast on first event
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
              {currentStep === 0 && <InstallStep />}
              {currentStep === 1 && (
                <ConfigureStep
                  apiKey={apiKey}
                  existingKeys={existingKeys}
                  generating={generating}
                  error={error}
                  onGenerate={generateKey}
                />
              )}
              {currentStep === 2 && (
                <VerifyStep
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

          {currentStep < 2 ? (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(2, s + 1))}
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
