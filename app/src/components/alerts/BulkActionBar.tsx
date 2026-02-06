"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Power, PowerOff, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { addToast } from "@/hooks/useToast";
import { queryKeys } from "@/lib/queries";
import type { DataEnvelope } from "@/types/api";
import type { AlertRule } from "@/types/alert";

interface BulkActionBarProps {
  selectedKeys: string[];
  orgSlug: string;
  projectSlug: string;
  onClearSelection: () => void;
}

interface BulkToggleResponse {
  rules: AlertRule[];
  count: number;
}

export default function BulkActionBar({
  selectedKeys,
  orgSlug,
  projectSlug,
  onClearSelection,
}: BulkActionBarProps) {
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState<"activate" | "deactivate" | null>(null);

  const bulkToggleMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      return apiFetch<DataEnvelope<BulkToggleResponse>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/bulk-toggle`,
        {
          method: "POST",
          body: JSON.stringify({
            preset_keys: selectedKeys,
            is_active: isActive,
          }),
        }
      );
    },
    onSuccess: (data, isActive) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alertTemplates(projectSlug) });
      addToast(
        `${data.data.count} alert(s) ${isActive ? "activated" : "deactivated"}`,
        "success"
      );
      onClearSelection();
      setShowConfirm(null);
    },
    onError: () => {
      addToast("Failed to update alerts", "error");
      setShowConfirm(null);
    },
  });

  const handleActivate = () => {
    if (showConfirm === "activate") {
      bulkToggleMutation.mutate(true);
    } else {
      setShowConfirm("activate");
    }
  };

  const handleDeactivate = () => {
    if (showConfirm === "deactivate") {
      bulkToggleMutation.mutate(false);
    } else {
      setShowConfirm("deactivate");
    }
  };

  if (selectedKeys.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg shadow-lg">
        {/* Selection count */}
        <span className="text-sm text-foreground font-medium">
          {selectedKeys.length} selected
        </span>

        <div className="h-4 w-px bg-border" />

        {/* Confirmation state */}
        {showConfirm && (
          <>
            <span className="text-sm text-muted-foreground">
              {showConfirm === "activate" ? "Activate" : "Deactivate"} {selectedKeys.length} alert(s)?
            </span>
            <button
              onClick={() => bulkToggleMutation.mutate(showConfirm === "activate")}
              disabled={bulkToggleMutation.isPending}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {bulkToggleMutation.isPending ? "Updating..." : "Confirm"}
            </button>
            <button
              onClick={() => setShowConfirm(null)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </>
        )}

        {/* Action buttons */}
        {!showConfirm && (
          <>
            <button
              onClick={handleActivate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-500/20 transition-colors"
            >
              <Power className="size-4" />
              Activate
            </button>
            <button
              onClick={handleDeactivate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
            >
              <PowerOff className="size-4" />
              Deactivate
            </button>
          </>
        )}

        <div className="h-4 w-px bg-border" />

        {/* Clear selection */}
        <button
          onClick={onClearSelection}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
