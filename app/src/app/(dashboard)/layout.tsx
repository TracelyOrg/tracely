"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Sun, Moon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DataEnvelope } from "@/types/api";
import BreadcrumbPicker from "@/components/layout/BreadcrumbPicker";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  onboarding_completed: boolean;
  email_verified: boolean;
  created_at: string;
}

interface AuthUser {
  user: UserData;
}

/** Get user initials from full name or email */
function getInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
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
  const [user, setUser] = useState<UserData | null>(null);

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

  // G→D navigates to Dashboard when org/project context is available (Story 4.2, AC3)
  useKeyboardShortcut(
    ["g", "d"],
    useCallback(() => {
      if (currentOrgSlug && currentProjectSlug) {
        router.push(`/${currentOrgSlug}/${currentProjectSlug}/dashboard`);
      }
    }, [currentOrgSlug, currentProjectSlug, router])
  );

  // G→A navigates to Alerts when org/project context is available (Story 5.1, AC1)
  useKeyboardShortcut(
    ["g", "a"],
    useCallback(() => {
      if (currentOrgSlug && currentProjectSlug) {
        router.push(`/${currentOrgSlug}/${currentProjectSlug}/alerts`);
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
        setUser(authRes.data.user);

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
          <div className="ml-auto flex items-center gap-4">
            {/* Top bar navigation menu (Story 4.2) */}
            {currentOrgSlug && currentProjectSlug && (
              <nav className="flex items-center gap-6" aria-label="Main navigation">
                <Link
                  href={`/${currentOrgSlug}/${currentProjectSlug}/live`}
                  className={cn(
                    "relative py-3 text-sm font-medium transition-colors",
                    pathname.endsWith("/live")
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Live
                  {pathname.endsWith("/live") && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </Link>
                <Link
                  href={`/${currentOrgSlug}/${currentProjectSlug}/dashboard`}
                  className={cn(
                    "relative py-3 text-sm font-medium transition-colors",
                    pathname.includes("/dashboard")
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Dashboard
                  {pathname.includes("/dashboard") && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </Link>
                <Link
                  href={`/${currentOrgSlug}/${currentProjectSlug}/alerts`}
                  className={cn(
                    "relative py-3 text-sm font-medium transition-colors",
                    pathname.includes("/alerts")
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Alerts
                  {pathname.includes("/alerts") && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </Link>
                <Link
                  href={`/${currentOrgSlug}/${currentProjectSlug}/settings`}
                  className={cn(
                    "relative py-3 text-sm font-medium transition-colors",
                    pathname.endsWith("/settings")
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Settings
                  {pathname.endsWith("/settings") && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </Link>
              </nav>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {/* User avatar */}
            {user && (
              <div
                className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium"
                title={user.full_name || user.email}
              >
                {getInitials(user.full_name, user.email)}
              </div>
            )}
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
}
