"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { addToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GeneralTabProps {
  orgSlug: string;
  orgName: string;
  orgSlugValue: string;
  createdAt: string;
}

export default function GeneralTab({
  orgSlug,
  orgName,
  orgSlugValue,
  createdAt,
}: GeneralTabProps) {
  const [name, setName] = useState(orgName);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const isDirty = name.trim() !== orgName;

  const updateOrg = useMutation({
    mutationFn: async (newName: string) => {
      return apiFetch(`/api/orgs/${orgSlug}/settings`, {
        method: "PUT",
        body: JSON.stringify({ name: newName }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      addToast("Organization updated", "success");
      setError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      setError("Name must be 1-50 characters");
      return;
    }

    updateOrg.mutate(trimmed);
  }

  async function copySlug() {
    await navigator.clipboard.writeText(orgSlugValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Org Name */}
      <div className="space-y-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          type="text"
          required
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Organization"
        />
      </div>

      {/* Slug (read-only) */}
      <div className="space-y-2">
        <Label>Slug</Label>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm font-mono text-muted-foreground">
            {orgSlugValue}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copySlug}
            className="shrink-0"
            aria-label="Copy slug"
          >
            {copied ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The slug is permanent and cannot be changed.
        </p>
      </div>

      {/* Created date (read-only) */}
      <div className="space-y-2">
        <Label>Created</Label>
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
      </div>

      {/* Save */}
      <Button type="submit" disabled={!isDirty || updateOrg.isPending}>
        {updateOrg.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
