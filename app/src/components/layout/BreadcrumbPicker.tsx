"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { DataEnvelope } from "@/types/api";

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface BreadcrumbPickerProps {
  currentOrgSlug?: string;
}

export default function BreadcrumbPicker({
  currentOrgSlug,
}: BreadcrumbPickerProps) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOrg = orgs.find((o) => o.slug === currentOrgSlug);

  useEffect(() => {
    let cancelled = false;

    async function loadOrgs() {
      try {
        const res = await apiFetch<DataEnvelope<OrgItem[]>>("/api/orgs");
        if (!cancelled) setOrgs(res.data);
      } catch {
        // Silently fail — orgs list is non-critical
      }
    }

    loadOrgs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSwitchOrg(slug: string) {
    setOpen(false);
    // Switching org resets everything (UX20) — navigate to org root
    router.push(`/${slug}`);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
      >
        <span className="max-w-[160px] truncate">
          {currentOrg?.name ?? "Select organization"}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && orgs.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => handleSwitchOrg(org.slug)}
              className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                org.slug === currentOrgSlug
                  ? "bg-accent font-medium"
                  : ""
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
