"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface AlertTabsProps {
  orgSlug: string;
  projectSlug: string;
}

export default function AlertTabs({ orgSlug, projectSlug }: AlertTabsProps) {
  const pathname = usePathname();
  const basePath = `/${orgSlug}/${projectSlug}/alerts`;

  const isHistory = pathname.includes("/history");

  const tabs = [
    { label: "Alerts", href: basePath, active: !isHistory },
    { label: "History", href: `${basePath}/history`, active: isHistory },
  ];

  return (
    <div className="inline-flex h-9 items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all",
            tab.active
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
