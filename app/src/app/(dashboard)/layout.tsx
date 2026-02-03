"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import BreadcrumbPicker from "@/components/layout/BreadcrumbPicker";

interface AuthUser {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    created_at: string;
  };
}

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  const onOnboarding = pathname.startsWith("/onboarding");

  // Extract org slug from URL — first path segment (e.g. /my-org/...)
  const segments = pathname.split("/").filter(Boolean);
  const currentOrgSlug =
    !onOnboarding && segments.length > 0 ? segments[0] : undefined;

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        await apiFetch<DataEnvelope<AuthUser>>("/api/auth/me");
        if (cancelled) return;

        const orgsRes = await apiFetch<DataEnvelope<OrgItem[]>>("/api/orgs");
        if (cancelled) return;

        setAuthenticated(true);

        if (orgsRes.data.length === 0 && !onOnboarding) {
          router.replace("/onboarding/create-org");
        }
      } catch {
        if (!cancelled) router.replace("/login");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, onOnboarding]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <div className="min-h-screen">
      {!onOnboarding && (
        <header className="flex h-14 items-center border-b px-4">
          <BreadcrumbPicker currentOrgSlug={currentOrgSlug} />
        </header>
      )}
      <main>{children}</main>
    </div>
  );
}
