"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";
import BreadcrumbPicker from "@/components/layout/BreadcrumbPicker";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

interface AuthUser {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    onboarding_completed: boolean;
    email_verified: boolean;
    created_at: string;
  };
}

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  org_id: string;
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

  const onOnboarding =
    pathname.startsWith("/onboarding") || pathname.includes("/onboarding");

  // Extract org and project slugs from URL (e.g. /my-org/my-project/...)
  const segments = pathname.split("/").filter(Boolean);
  const currentOrgSlug =
    !onOnboarding && segments.length > 0 ? segments[0] : undefined;
  const currentProjectSlug =
    !onOnboarding && segments.length > 1 ? segments[1] : undefined;

  // --- Theme toggle ---
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  // --- Keyboard chord navigation (Story 3.6, AC5, UX3) ---
  // G→L navigates to Pulse View (Live) when org/project context is available
  useKeyboardShortcut(
    ["g", "l"],
    useCallback(() => {
      if (currentOrgSlug && currentProjectSlug) {
        router.push(`/${currentOrgSlug}/${currentProjectSlug}/live`);
      }
    }, [currentOrgSlug, currentProjectSlug, router])
  );

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const authRes = await apiFetch<DataEnvelope<AuthUser>>("/api/auth/me");
        if (cancelled) return;

        if (!authRes.data.user.email_verified) {
          router.replace(
            `/verify-email?email=${encodeURIComponent(authRes.data.user.email)}`
          );
          return;
        }

        setAuthenticated(true);

        // Auto-accept pending invitation from sessionStorage (Story 6-5)
        const pendingToken = sessionStorage.getItem("invitation_token");
        if (pendingToken) {
          sessionStorage.removeItem("invitation_token");
          try {
            const acceptRes = await apiFetch<
              DataEnvelope<{ org_slug: string; org_name: string }>
            >("/api/invitations/accept", {
              method: "POST",
              body: JSON.stringify({ token: pendingToken }),
            });
            if (!cancelled) {
              router.replace(`/${acceptRes.data.org_slug}`);
              return;
            }
          } catch {
            // Non-blocking — if accept fails, continue normally
          }
        }

        // Redirect to onboarding wizard if not completed and on a specific org/project page
        if (
          !authRes.data.user.onboarding_completed &&
          !onOnboarding &&
          pathname !== "/"
        ) {
          try {
            const orgsRes = await apiFetch<DataEnvelope<OrgItem[]>>("/api/orgs");
            if (cancelled) return;
            if (orgsRes.data.length > 0) {
              const firstOrg = orgsRes.data[0];
              const projRes = await apiFetch<DataEnvelope<ProjectItem[]>>(
                `/api/orgs/${firstOrg.slug}/projects`
              );
              if (cancelled) return;
              if (projRes.data.length > 0) {
                const firstProject = projRes.data[0];
                router.replace(
                  `/${firstOrg.slug}/${firstProject.slug}/onboarding`
                );
              } else {
                router.replace(
                  `/onboarding/create-project?org=${firstOrg.slug}`
                );
              }
            }
          } catch {
            // Non-blocking — if loading fails, don't redirect
          }
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
        <header className="flex h-12 items-center border-b px-4">
          <BreadcrumbPicker currentOrgSlug={currentOrgSlug} currentProjectSlug={currentProjectSlug} />
          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
}
