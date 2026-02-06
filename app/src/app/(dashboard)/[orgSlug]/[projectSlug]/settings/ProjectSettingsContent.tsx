"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export default function ProjectSettingsClient() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { orgSlug, projectSlug } = params;

  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate key dialog
  const [showGenerate, setShowGenerate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [generating, setGenerating] = useState(false);

  // Show-once key dialog
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState("");
  const [revoking, setRevoking] = useState(false);

  const basePath = `/api/orgs/${orgSlug}/projects/${projectSlug}/api-keys`;

  const loadKeys = useCallback(async () => {
    try {
      const res = await apiFetch<DataEnvelope<ApiKeyItem[]>>(basePath);
      setKeys(res.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load API keys");
      }
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await apiFetch<DataEnvelope<ApiKeyCreatedResponse>>(
        basePath,
        {
          method: "POST",
          body: JSON.stringify({ name: keyName || null }),
        }
      );
      setCreatedKey(res.data.key);
      setShowGenerate(false);
      setKeyName("");
      await loadKeys();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await apiFetch(`${basePath}/${revokeTarget.id}`, {
        method: "DELETE",
      });
      setRevokeTarget(null);
      setRevokeConfirm("");
      await loadKeys();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const revokeLabel = revokeTarget?.name || revokeTarget?.prefix || "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Project Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {orgSlug} / {projectSlug}
      </p>

      {/* API Keys Section */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">API Keys</h2>
          <Button onClick={() => setShowGenerate(true)}>Generate API Key</Button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        )}

        {loading ? (
          <div className="mt-6 flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : keys.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No API keys yet. Generate one to start sending telemetry.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Prefix</th>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Created</th>
                  <th className="px-4 py-2 text-left font-medium">Last Used</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">
                      {k.prefix}...
                    </td>
                    <td className="px-4 py-2">
                      {k.name || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setRevokeTarget(k)}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>


      {/* Generate Key Dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for this project. The key will only be shown
              once.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label
              htmlFor="key-name"
              className="text-sm font-medium"
            >
              Key Name (optional)
            </label>
            <Input
              id="key-name"
              placeholder="e.g. Production, Staging"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGenerate(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show-Once Key Dialog */}
      <Dialog
        open={createdKey !== null}
        onOpenChange={() => {
          setCreatedKey(null);
          setCopied(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy this key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 rounded-md bg-muted p-3">
            <code className="break-all text-sm font-mono">{createdKey}</code>
          </div>
          <DialogFooter>
            <Button onClick={handleCopyKey}>
              {copied ? "Copied!" : "Copy Key"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreatedKey(null);
                setCopied(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog (UX5: type name to confirm) */}
      <Dialog
        open={revokeTarget !== null}
        onOpenChange={() => {
          setRevokeTarget(null);
          setRevokeConfirm("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Any services using this key will lose
              access immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              Type{" "}
              <span className="font-mono font-semibold">{revokeLabel}</span>{" "}
              to confirm:
            </p>
            <Input
              className="mt-2"
              value={revokeConfirm}
              onChange={(e) => setRevokeConfirm(e.target.value)}
              placeholder={revokeLabel}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevokeTarget(null);
                setRevokeConfirm("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revokeConfirm !== revokeLabel || revoking}
              onClick={handleRevoke}
            >
              {revoking ? "Revoking..." : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
