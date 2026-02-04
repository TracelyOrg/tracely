"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";

export default function VerifyTokenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token provided.");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        await apiFetch<DataEnvelope<{ user: unknown }>>(
          "/api/auth/verify-email",
          {
            method: "POST",
            body: JSON.stringify({ token }),
          }
        );
        if (!cancelled) {
          setStatus("success");
          setTimeout(() => router.replace("/"), 1500);
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage("Something went wrong. Please try again.");
        }
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="space-y-4 text-center">
      {status === "loading" && (
        <>
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Verifying your email...
          </h1>
        </>
      )}

      {status === "success" && (
        <>
          <h1 className="text-2xl font-bold tracking-tight">
            Email verified successfully
          </h1>
          <p className="text-sm text-muted-foreground">
            Redirecting you to the dashboard...
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-2xl font-bold tracking-tight">
            Verification failed
          </h1>
          <p className="text-sm text-destructive">{errorMessage}</p>
          <Link
            href="/verify-email"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Resend verification email
          </Link>
        </>
      )}
    </div>
  );
}
