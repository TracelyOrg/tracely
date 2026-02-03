"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";

interface OrgResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    created_at: string;
  };
  member: {
    id: string;
    user_id: string;
    role: string;
    created_at: string;
  };
}

export default function CreateOrgPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await apiFetch<DataEnvelope<OrgResponse>>("/api/orgs", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const slug = res.data.organization.slug;
      router.push(`/${slug}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const errors: Record<string, string> = {};
          for (const d of err.details) {
            errors[d.field] = d.message;
          }
          setFieldErrors(errors);
        } else {
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Create your organization
          </h1>
          <p className="text-sm text-muted-foreground">
            An organization is your workspace to manage projects and team
            members.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Organization name
            </label>
            <input
              id="name"
              type="text"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="My Company"
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || name.trim().length === 0}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create organization"}
          </button>
        </form>
      </div>
    </div>
  );
}
