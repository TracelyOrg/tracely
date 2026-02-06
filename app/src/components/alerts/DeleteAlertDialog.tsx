"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { addToast } from "@/hooks/useToast";
import { queryKeys } from "@/lib/queries";
import type { DataEnvelope } from "@/types/api";

interface DeleteAlertDialogProps {
  alertName: string;
  presetKey: string;
  orgSlug: string;
  projectSlug: string;
  onClose: () => void;
}

const CONFIRM_TEXT = "DELETE";

export default function DeleteAlertDialog({
  alertName,
  presetKey,
  orgSlug,
  projectSlug,
  onClose,
}: DeleteAlertDialogProps) {
  const queryClient = useQueryClient();
  const [confirmInput, setConfirmInput] = useState("");

  const isConfirmValid = confirmInput === CONFIRM_TEXT;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<DataEnvelope<{ deleted: boolean }>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/rules/${presetKey}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alertTemplates(projectSlug) });
      addToast("Alert deleted successfully", "success");
      onClose();
    },
    onError: () => {
      addToast("Failed to delete alert", "error");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmValid && !deleteMutation.isPending) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-500/10 p-2">
              <AlertTriangle className="size-5 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Delete Alert</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Warning message */}
        <div className="mb-6">
          <p className="text-sm text-foreground mb-2">
            Are you sure you want to delete <strong>&quot;{alertName}&quot;</strong>?
          </p>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All associated alert events and history will be permanently removed.
          </p>
        </div>

        {/* Confirmation form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Type <span className="font-mono text-red-500">{CONFIRM_TEXT}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={CONFIRM_TEXT}
              autoComplete="off"
              autoFocus
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-muted-foreground"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isConfirmValid || deleteMutation.isPending}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
