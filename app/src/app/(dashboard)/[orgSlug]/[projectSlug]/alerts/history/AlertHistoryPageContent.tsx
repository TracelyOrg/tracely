"use client";

import { useParams } from "next/navigation";
import AlertTabs from "@/components/alerts/AlertTabs";
import AlertHistoryList from "@/components/alerts/AlertHistoryList";

export default function AlertHistoryPageContent() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { orgSlug, projectSlug } = params;

  return (
    <div className="p-4 space-y-6">
      {/* Page header with tabs */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">G</kbd> then{" "}
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">A</kbd> to navigate here
          </p>
        </div>
        <AlertTabs orgSlug={orgSlug} projectSlug={projectSlug} />
      </div>

      {/* Alert history list */}
      <AlertHistoryList orgSlug={orgSlug} projectSlug={projectSlug} />
    </div>
  );
}
