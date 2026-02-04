"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import { Button } from "@/components/ui/button";

interface InviteInfo {
  org_name: string;
  org_slug: string;
  role: string;
  inviter_name: string | null;
  status: string;
}

type PageState = "loading" | "show_info" | "accepting" | "accepted" | "error" | "expired" | "logged_out";

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [state, setState] = useState<PageState>(token ? "loading" : "error");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState(
    token ? "" : "No invitation token provided"
  );

  useEffect(() => {
    if (!token) return;

    async function loadInfo() {
      try {
        const res = await apiFetch<DataEnvelope<InviteInfo>>(
          `/api/invitations/info?token=${encodeURIComponent(token!)}`
        );
        const data = res.data;
        setInfo(data);

        if (data.status === "expired") {
          setState("expired");
          return;
        }

        if (data.status !== "pending") {
          setState("error");
          setErrorMsg("This invitation is no longer valid");
          return;
        }

        // Try to accept if user is logged in
        try {
          const acceptRes = await apiFetch<
            DataEnvelope<{ org_slug: string; org_name: string }>
          >("/api/invitations/accept", {
            method: "POST",
            body: JSON.stringify({ token }),
          });
          setState("accepted");
          setTimeout(() => {
            router.push(`/${acceptRes.data.org_slug}`);
          }, 1500);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            // Not logged in — show options
            sessionStorage.setItem("invitation_token", token!);
            setState("logged_out");
          } else if (err instanceof ApiError) {
            setState("error");
            setErrorMsg(err.message);
          }
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setState("error");
          setErrorMsg(err.message);
        } else {
          setState("error");
          setErrorMsg("Something went wrong");
        }
      }
    }

    loadInfo();
  }, [token, router]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Invitation expired
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This invitation has expired — ask your admin for a new one.
        </p>
        <Link href="/login" className="mt-6">
          <Button variant="outline">Go to Login</Button>
        </Link>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Invalid invitation
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {errorMsg}
        </p>
        <Link href="/login" className="mt-6">
          <Button variant="outline">Go to Login</Button>
        </Link>
      </div>
    );
  }

  if (state === "accepting") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (state === "accepted") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome to {info?.org_name}!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Redirecting you to the organization...
        </p>
      </div>
    );
  }

  // state === "logged_out"
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <h1 className="text-xl font-semibold tracking-tight">
        You&apos;ve been invited to {info?.org_name}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {info?.inviter_name
          ? `${info.inviter_name} invited you to join as ${info.role}.`
          : `You've been invited to join as ${info?.role}.`}
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/login">
          <Button>Log in</Button>
        </Link>
        <Link href="/register">
          <Button variant="outline">Create account</Button>
        </Link>
      </div>
    </div>
  );
}
