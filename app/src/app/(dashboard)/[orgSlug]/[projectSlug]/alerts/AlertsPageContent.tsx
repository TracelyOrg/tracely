"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Gauge, TrendingUp, Bell, X, RotateCcw, Mail, MessageSquare, Check, ExternalLink, ChevronDown, ChevronUp, Square, CheckSquare, Trash2 } from "lucide-react";
import AlertTabs from "@/components/alerts/AlertTabs";
import BulkActionBar from "@/components/alerts/BulkActionBar";
import DeleteAlertDialog from "@/components/alerts/DeleteAlertDialog";
import { apiFetch, ApiError } from "@/lib/api";
import { addToast } from "@/hooks/useToast";
import type { DataEnvelope } from "@/types/api";
import type { AlertTemplate, AlertCategory, AlertRule, AlertRuleUpdate } from "@/types/alert";
import type { NotificationChannel, NotificationTestResponse } from "@/types/notification";
import { queryKeys } from "@/lib/queries";

// Category configuration with icons and colors
const CATEGORY_CONFIG: Record<AlertCategory, { label: string; colorClass: string; Icon: typeof Shield }> = {
  availability: { label: "Availability", colorClass: "text-red-500", Icon: Shield },
  performance: { label: "Performance", colorClass: "text-amber-500", Icon: Gauge },
  volume: { label: "Volume", colorClass: "text-blue-500", Icon: TrendingUp },
};

// Category display order
const CATEGORY_ORDER: AlertCategory[] = ["availability", "performance", "volume"];

// Duration options in seconds
const DURATION_OPTIONS = [
  { label: "1 min", value: 60 },
  { label: "3 min", value: 180 },
  { label: "5 min", value: 300 },
  { label: "10 min", value: 600 },
  { label: "15 min", value: 900 },
  { label: "30 min", value: 1800 },
];

// Skeleton for alert card
function AlertCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
      <div className="flex items-center gap-4">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="h-8 w-12 animate-pulse rounded bg-muted" />
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

// Edit Alert Modal
function AlertEditModal({
  template,
  orgSlug,
  projectSlug,
  onClose,
}: {
  template: AlertTemplate;
  orgSlug: string;
  projectSlug: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [threshold, setThreshold] = useState(
    template.custom_threshold ?? template.default_threshold
  );
  const [duration, setDuration] = useState(
    template.custom_duration ?? template.default_duration
  );

  const isCustom =
    threshold !== template.default_threshold ||
    duration !== template.default_duration;

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: AlertRuleUpdate) => {
      if (!template.rule_id) {
        // Create new rule with custom values
        return apiFetch<DataEnvelope<AlertRule>>(
          `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/rules`,
          {
            method: "POST",
            body: JSON.stringify({
              preset_key: template.key,
              threshold_value: data.threshold_value,
              duration_seconds: data.duration_seconds,
              is_active: true,
            }),
          }
        );
      }
      return apiFetch<DataEnvelope<AlertRule>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/rules/${template.rule_id}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alertTemplates(projectSlug) });
      addToast("Alert settings saved", "success");
      onClose();
    },
    onError: () => {
      addToast("Failed to save alert settings", "error");
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!template.rule_id) return;
      return apiFetch<DataEnvelope<AlertRule>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/rules/${template.rule_id}/reset`,
        { method: "POST" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alertTemplates(projectSlug) });
      addToast("Alert reset to defaults", "success");
      onClose();
    },
    onError: () => {
      addToast("Failed to reset alert", "error");
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      threshold_value: threshold,
      duration_seconds: duration,
    });
  };

  const handleReset = () => {
    resetMutation.mutate();
  };

  // Format threshold label based on metric type
  const getThresholdLabel = () => {
    if (template.metric === "error_rate") return "Error Rate (%)";
    if (template.metric === "p95_latency") return "P95 Latency (ms)";
    if (template.comparison.includes("pct")) return "Change (%)";
    return "Threshold";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Edit Alert</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Alert name */}
        <p className="text-sm text-muted-foreground mb-4">{template.name}</p>

        {/* Threshold input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            {getThresholdLabel()}
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            min={0}
            step={template.metric === "error_rate" ? 0.1 : 1}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Default: {template.default_threshold}
            {template.metric === "error_rate" ? "%" : ""}
            {template.metric === "p95_latency" ? "ms" : ""}
          </p>
        </div>

        {/* Duration select */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Duration Window
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Default: {template.default_duration >= 60
              ? `${template.default_duration / 60} min`
              : `${template.default_duration}s`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {template.rule_id && (template.custom_threshold !== null || template.custom_duration !== null) && (
              <button
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RotateCcw className="size-4" />
                Reset to defaults
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Custom indicator */}
        {isCustom && (
          <p className="text-xs text-amber-500 mt-4 text-center">
            These settings differ from the preset defaults
          </p>
        )}
      </div>
    </div>
  );
}

// Webhook Config Modal
function WebhookConfigModal({
  type,
  channel,
  orgId,
  projectId,
  onClose,
  onSaved,
}: {
  type: "slack" | "discord";
  channel?: NotificationChannel;
  orgId: string;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [webhookUrl, setWebhookUrl] = useState(
    (channel?.config?.webhook_url as string) || ""
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const basePath = `/api/orgs/${orgId}/projects/${projectId}/notifications`;

  async function handleSave() {
    setSaving(true);
    try {
      const config = { webhook_url: webhookUrl };

      if (channel) {
        await apiFetch(`${basePath}/${channel.id}`, {
          method: "PATCH",
          body: JSON.stringify({ config }),
        });
      } else {
        await apiFetch(basePath, {
          method: "POST",
          body: JSON.stringify({
            channel_type: type,
            config,
            is_enabled: true,
          }),
        });
      }

      addToast(`${type === "slack" ? "Slack" : "Discord"} webhook saved`, "success");
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        addToast(err.message, "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!channel) {
      addToast("Save the webhook first before testing", "error");
      return;
    }

    setTesting(true);
    try {
      const res = await apiFetch<DataEnvelope<NotificationTestResponse>>(
        `${basePath}/${channel.id}/test`,
        { method: "POST" }
      );

      if (res.data.success) {
        addToast("Test notification sent successfully!", "success");
      } else {
        addToast(res.data.error || "Test failed", "error");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        addToast(err.message, "error");
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Configure {type === "slack" ? "Slack" : "Discord"} Webhook
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {type === "slack" ? (
            <>
              Create an incoming webhook in Slack and paste the URL below.{" "}
              <a
                href="https://tracely.sh/docs/alerts/slack-integration"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                View setup guide <ExternalLink className="size-3" />
              </a>
            </>
          ) : (
            <>
              Create a webhook in your Discord server settings.{" "}
              <a
                href="https://tracely.sh/docs/alerts/discord-integration"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                View setup guide <ExternalLink className="size-3" />
              </a>
            </>
          )}
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Webhook URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={
              type === "slack"
                ? "https://hooks.slack.com/services/..."
                : "https://discord.com/api/webhooks/..."
            }
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            {channel && (
              <button
                onClick={handleTest}
                disabled={testing || !webhookUrl}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {testing ? "Testing..." : "Send Test"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !webhookUrl}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Alert template card component
function AlertTemplateCard({
  template,
  orgSlug,
  projectSlug,
  onEdit,
  isSelected,
  onToggleSelect,
}: {
  template: AlertTemplate;
  orgSlug: string;
  projectSlug: string;
  onEdit: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const queryClient = useQueryClient();
  const [isToggling, setIsToggling] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Check if template has custom values (deletable alerts)
  const hasCustomValues = template.custom_threshold !== null || template.custom_duration !== null;

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<DataEnvelope<AlertRule>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/rules/toggle`,
        {
          method: "POST",
          body: JSON.stringify({ preset_key: template.key }),
        }
      );
    },
    onMutate: () => {
      setIsToggling(true);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alertTemplates(projectSlug) });
      const newState = data.data.is_active;
      addToast(newState ? "Alert activated" : "Alert deactivated", "success");
    },
    onError: () => {
      addToast("Failed to toggle alert", "error");
    },
    onSettled: () => {
      setIsToggling(false);
    },
  });

  // Format threshold display based on metric type
  function formatThreshold(value: number, metric: string): string {
    if (metric === "error_rate") return `${value}%`;
    if (metric === "p95_latency") return value >= 1000 ? `${value / 1000}s` : `${value}ms`;
    if (metric === "request_count" && template.comparison.includes("pct")) return `${value}%`;
    return String(value);
  }

  // Format duration display
  function formatDuration(seconds: number): string {
    if (seconds >= 60) return `${seconds / 60} min`;
    return `${seconds}s`;
  }

  const handleToggle = () => {
    toggleMutation.mutate();
  };

  // Optimistic active state
  const displayActive = isToggling ? !template.is_active : template.is_active;

  return (
    <div className={`rounded-lg border bg-card p-4 space-y-3 hover:border-border/80 transition-colors ${
      isSelected ? "border-primary ring-1 ring-primary" : "border-border"
    }`}>
      {/* Header with checkbox, name, custom badge, and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Checkbox for selection */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isSelected ? "Deselect alert" : "Select alert"}
          >
            {isSelected ? (
              <CheckSquare className="size-5 text-primary" />
            ) : (
              <Square className="size-5" />
            )}
          </button>
          <h3 className="font-medium text-foreground">{template.name}</h3>
          {hasCustomValues && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Custom
            </span>
          )}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            displayActive
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {displayActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">{template.description}</p>

      {/* Threshold info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Threshold: {formatThreshold(template.custom_threshold ?? template.default_threshold, template.metric)}
        </span>
        <span>
          Duration: {formatDuration(template.custom_duration ?? template.default_duration)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggleMutation.isPending}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            displayActive ? "bg-primary" : "bg-muted"
          }`}
          role="switch"
          aria-checked={displayActive}
          data-state={displayActive ? "checked" : "unchecked"}
        >
          <span
            className={`pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
              displayActive ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Edit
          </button>
          {/* Delete button - only for custom alerts */}
          {hasCustomValues && (
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="text-xs text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
              aria-label="Delete alert"
            >
              <Trash2 className="size-3" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <DeleteAlertDialog
          alertName={template.name}
          presetKey={template.key}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          onClose={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}

// Category section component
function AlertCategorySection({
  category,
  templates,
  isLoading,
  orgSlug,
  projectSlug,
  onEditTemplate,
  selectedKeys,
  onToggleSelect,
}: {
  category: AlertCategory;
  templates: AlertTemplate[];
  isLoading: boolean;
  orgSlug: string;
  projectSlug: string;
  onEditTemplate: (template: AlertTemplate) => void;
  selectedKeys: string[];
  onToggleSelect: (key: string) => void;
}) {
  const config = CATEGORY_CONFIG[category];
  const { Icon, label, colorClass } = config;

  return (
    <section className="space-y-4">
      {/* Category header */}
      <div className="flex items-center gap-2">
        <Icon className={`size-5 ${colorClass}`} />
        <h2 className="text-lg font-semibold text-foreground">{label}</h2>
        <span className="text-sm text-muted-foreground">({templates.length})</span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <AlertCardSkeleton />
            <AlertCardSkeleton />
          </>
        ) : (
          templates.map((template) => (
            <AlertTemplateCard
              key={template.key}
              template={template}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              onEdit={() => onEditTemplate(template)}
              isSelected={selectedKeys.includes(template.key)}
              onToggleSelect={() => onToggleSelect(template.key)}
            />
          ))
        )}
      </div>
    </section>
  );
}

// Notification Channels Section
function NotificationChannelsSection({
  orgId,
  projectId,
}: {
  orgId: string | null;
  projectId: string | null;
}) {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [configModal, setConfigModal] = useState<{
    type: "slack" | "discord";
    channel?: NotificationChannel;
  } | null>(null);

  const basePath = orgId && projectId
    ? `/api/orgs/${orgId}/projects/${projectId}/notifications`
    : null;

  const loadChannels = useCallback(async () => {
    if (!basePath) return;
    try {
      const res = await apiFetch<DataEnvelope<NotificationChannel[]>>(basePath);
      setChannels(res.data);
    } catch {
      // Silently fail - channels are optional
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    if (basePath) {
      loadChannels();
    }
  }, [basePath, loadChannels]);

  const getChannel = (type: string) => channels.find((c) => c.channel_type === type);

  async function handleToggleChannel(channel: NotificationChannel) {
    if (!basePath) return;
    try {
      await apiFetch(`${basePath}/${channel.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_enabled: !channel.is_enabled }),
      });
      await loadChannels();
      addToast(channel.is_enabled ? "Channel disabled" : "Channel enabled", "success");
    } catch (err) {
      if (err instanceof ApiError) {
        addToast(err.message, "error");
      }
    }
  }

  const slackChannel = getChannel("slack");
  const discordChannel = getChannel("discord");

  // Count configured channels
  const configuredCount = [slackChannel, discordChannel].filter(Boolean).length;

  if (!orgId || !projectId) return null;

  return (
    <section className="space-y-4">
      {/* Section header - clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-foreground">Notification Channels</h2>
          <span className="text-sm text-muted-foreground">
            ({configuredCount} configured)
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronDown className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-border p-4 animate-pulse">
                  <div className="h-5 w-24 bg-muted rounded mb-2" />
                  <div className="h-4 w-full bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Email - Always On */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <Mail className="size-4 text-blue-500" />
                  </div>
                  <h3 className="font-medium text-foreground">Email</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Sent to all organization admins
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3" />
                  Always On
                </span>
              </div>

              {/* Slack */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-500/10 p-2">
                      <MessageSquare className="size-4 text-purple-500" />
                    </div>
                    <h3 className="font-medium text-foreground">Slack</h3>
                  </div>
                  {slackChannel && (
                    <button
                      onClick={() => handleToggleChannel(slackChannel)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                        slackChannel.is_enabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                          slackChannel.is_enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {slackChannel ? "Webhook configured" : "Post alerts to Slack"}
                </p>
                <button
                  onClick={() => setConfigModal({ type: "slack", channel: slackChannel })}
                  className="text-xs text-primary hover:underline"
                >
                  {slackChannel ? "Configure" : "Set Up"}
                </button>
              </div>

              {/* Discord */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-500/10 p-2">
                      <MessageSquare className="size-4 text-indigo-500" />
                    </div>
                    <h3 className="font-medium text-foreground">Discord</h3>
                  </div>
                  {discordChannel && (
                    <button
                      onClick={() => handleToggleChannel(discordChannel)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                        discordChannel.is_enabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                          discordChannel.is_enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {discordChannel ? "Webhook configured" : "Post alerts to Discord"}
                </p>
                <button
                  onClick={() => setConfigModal({ type: "discord", channel: discordChannel })}
                  className="text-xs text-primary hover:underline"
                >
                  {discordChannel ? "Configure" : "Set Up"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Webhook Config Modal */}
      {configModal && orgId && projectId && (
        <WebhookConfigModal
          type={configModal.type}
          channel={configModal.channel}
          orgId={orgId}
          projectId={projectId}
          onClose={() => setConfigModal(null)}
          onSaved={loadChannels}
        />
      )}
    </section>
  );
}

// Empty alerts state component
function EmptyAlertsState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Bell className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No active alerts</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        Alerts help you stay informed when your application experiences issues.
        Activate preset templates below to get started with monitoring.
      </p>
      <p className="text-xs text-muted-foreground">
        Get started by activating a preset template
      </p>
    </div>
  );
}

export default function AlertsPageClient() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { orgSlug, projectSlug } = params;
  const [editingTemplate, setEditingTemplate] = useState<AlertTemplate | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Toggle selection for a single alert
  const handleToggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  // Clear all selections
  const handleClearSelection = useCallback(() => {
    setSelectedKeys([]);
  }, []);

  // Load org and project IDs for notification channels
  useEffect(() => {
    async function loadIds() {
      try {
        const orgRes = await apiFetch<DataEnvelope<{ id: string }>>(`/api/orgs/${orgSlug}`);
        setOrgId(orgRes.data.id);

        const projRes = await apiFetch<DataEnvelope<{ id: string }>>(`/api/orgs/${orgSlug}/projects/${projectSlug}`);
        setProjectId(projRes.data.id);
      } catch {
        // IDs not critical for alert templates
      }
    }
    loadIds();
  }, [orgSlug, projectSlug]);

  // Fetch alert templates from API
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.alertTemplates(projectSlug),
    queryFn: async () => {
      const res = await apiFetch<DataEnvelope<{ templates: AlertTemplate[] }>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/templates`
      );
      return res.data.templates;
    },
    enabled: !!orgSlug && !!projectSlug,
    retry: false,
    staleTime: 30_000,
  });

  // Group templates by category
  const templatesByCategory = CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = (data ?? []).filter((t) => t.category === category);
      return acc;
    },
    {} as Record<AlertCategory, AlertTemplate[]>
  );

  // Check if any alerts are active
  const hasActiveAlerts = (data ?? []).some((t) => t.is_active);

  // Show empty state if no active alerts (AC2)
  const showEmptyState = !isLoading && !error && !hasActiveAlerts;

  return (
    <div className="p-4 space-y-8">
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

      {/* Empty state when no active alerts */}
      {showEmptyState && <EmptyAlertsState />}

      {/* Category sections */}
      {CATEGORY_ORDER.map((category) => (
        <AlertCategorySection
          key={category}
          category={category}
          templates={templatesByCategory[category]}
          isLoading={isLoading}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          onEditTemplate={setEditingTemplate}
          selectedKeys={selectedKeys}
          onToggleSelect={handleToggleSelect}
        />
      ))}

      {/* Notification Channels Section */}
      <NotificationChannelsSection orgId={orgId} projectId={projectId} />

      {/* Error state */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load alert templates. Please try again later.
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {editingTemplate && (
        <AlertEditModal
          template={editingTemplate}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          onClose={() => setEditingTemplate(null)}
        />
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedKeys={selectedKeys}
        orgSlug={orgSlug}
        projectSlug={projectSlug}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
}
