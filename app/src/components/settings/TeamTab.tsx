"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, RotateCw, X, UserPlus, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { addToast } from "@/hooks/useToast";
import type { DataEnvelope } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface MemberItem {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

interface InvitationItem {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by_name: string | null;
  created_at: string;
  expires_at: string;
}

interface TeamTabProps {
  orgSlug: string;
  isAdmin: boolean;
  orgName: string;
}

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  member: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function TeamTab({ orgSlug, isAdmin, orgName }: TeamTabProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberItem | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();

  const { data: membersData } = useQuery({
    queryKey: ["orgs", orgSlug, "members"],
    queryFn: () =>
      apiFetch<DataEnvelope<MemberItem[]>>(
        `/api/orgs/${orgSlug}/members`
      ),
  });

  const { data: invitationsData } = useQuery({
    queryKey: ["orgs", orgSlug, "invitations"],
    queryFn: () =>
      apiFetch<DataEnvelope<InvitationItem[]>>(
        `/api/orgs/${orgSlug}/invitations`
      ),
    enabled: isAdmin,
  });

  const members = membersData?.data ?? [];
  const invitations = invitationsData?.data ?? [];
  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  const sendInvite = useMutation({
    mutationFn: async () => {
      return apiFetch(`/api/orgs/${orgSlug}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "invitations"],
      });
      addToast(`Invitation sent to ${email}`, "success");
      setEmail("");
      setRole("member");
      setError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    },
  });

  const cancelInvite = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiFetch(
        `/api/orgs/${orgSlug}/invitations/${invitationId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "invitations"],
      });
      addToast("Invitation cancelled", "success");
    },
  });

  const resendInvite = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiFetch(
        `/api/orgs/${orgSlug}/invitations/${invitationId}/resend`,
        { method: "POST" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "invitations"],
      });
      addToast("Invitation resent", "success");
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: string }) => {
      return apiFetch(
        `/api/orgs/${orgSlug}/members/${memberId}/role`,
        {
          method: "PUT",
          body: JSON.stringify({ role: newRole }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "members"],
      });
      addToast("Role updated", "success");
    },
    onError: (err) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "members"],
      });
      if (err instanceof ApiError) {
        addToast(err.message, "error");
      } else {
        addToast("Failed to update role", "error");
      }
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      return apiFetch(
        `/api/orgs/${orgSlug}/members/${memberId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "members"],
      });
      addToast("Member removed from organization", "success");
      setRemoveTarget(null);
      setConfirmText("");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        addToast(err.message, "error");
      } else {
        addToast("Failed to remove member", "error");
      }
      setRemoveTarget(null);
      setConfirmText("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    sendInvite.mutate();
  }

  const removeConfirmName = removeTarget?.full_name || removeTarget?.email || "";

  return (
    <div className="space-y-8">
      {/* Invite form — admin only */}
      {isAdmin && (
        <div>
          <h3 className="text-base font-semibold tracking-tight mb-4">
            Invite team member
          </h3>
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>
            <div className="w-36 space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={sendInvite.isPending}>
              <UserPlus className="mr-2 size-4" />
              {sendInvite.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </form>
          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Pending invitations — admin only */}
      {isAdmin && pendingInvitations.length > 0 && (
        <div>
          <h3 className="text-base font-semibold tracking-tight mb-4">
            Pending invitations
          </h3>
          <div className="rounded-lg border">
            {pendingInvitations.map((inv, i) => (
              <div
                key={inv.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < pendingInvitations.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <Mail className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent{" "}
                      {new Date(inv.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      ROLE_BADGE[inv.role] ?? ROLE_BADGE.viewer
                    }`}
                  >
                    {inv.role}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resendInvite.mutate(inv.id)}
                    disabled={resendInvite.isPending}
                  >
                    <RotateCw className="mr-1 size-3" />
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelInvite.mutate(inv.id)}
                    disabled={cancelInvite.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="mr-1 size-3" />
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current members */}
      <div>
        <h3 className="text-base font-semibold tracking-tight mb-4">
          Members ({members.length})
        </h3>
        <div className="rounded-lg border">
          {members.map((member, i) => (
            <div
              key={member.id}
              className={`flex items-center justify-between px-4 py-3 ${
                i < members.length - 1 ? "border-b" : ""
              }`}
            >
              <div>
                <p className="text-sm font-medium">
                  {member.full_name || member.email}
                </p>
                {member.full_name && (
                  <p className="text-xs text-muted-foreground">
                    {member.email}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isAdmin ? (
                  <Select
                    value={member.role}
                    onValueChange={(newRole) =>
                      updateRole.mutate({ memberId: member.id, newRole })
                    }
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      ROLE_BADGE[member.role] ?? ROLE_BADGE.viewer
                    }`}
                  >
                    {member.role}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  Joined{" "}
                  {new Date(member.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoveTarget(member)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Remove confirmation dialog */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
            setConfirmText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              This will remove <strong>{removeConfirmName}</strong> from{" "}
              {orgName}. They will lose all access to this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-remove">
              Type <span className="font-mono font-semibold">{removeConfirmName}</span> to
              confirm
            </Label>
            <Input
              id="confirm-remove"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={removeConfirmName}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveTarget(null);
                setConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                confirmText !== removeConfirmName || removeMember.isPending
              }
              onClick={() => {
                if (removeTarget) {
                  removeMember.mutate(removeTarget.id);
                }
              }}
            >
              {removeMember.isPending ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
