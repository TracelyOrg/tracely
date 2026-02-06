"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  CheckCircle,
  Bell,
  Mail,
  MessageSquare,
  ExternalLink,
  Settings,
  Activity,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import type { DataEnvelope } from "@/types/api";
import type { AlertEvent, AlertCategory, AlertEventStatus } from "@/types/alert";
import MetricBreachChart from "@/components/alerts/MetricBreachChart";

// Status colors
const STATUS_COLORS: Record<AlertEventStatus, string> = {
  active: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
  acknowledged: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
};

// Category to severity mapping
const CATEGORY_SEVERITY: Record<AlertCategory, { icon: typeof AlertTriangle; colorClass: string; label: string }> = {
  availability: { icon: AlertTriangle, colorClass: "text-red-500", label: "Critical" },
  performance: { icon: AlertCircle, colorClass: "text-amber-500", label: "Warning" },
  volume: { icon: Info, colorClass: "text-blue-500", label: "Info" },
};

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMetricValue(value: number, category: AlertCategory): string {
  if (category === "availability") {
    return `${value.toFixed(2)}%`;
  }
  if (category === "performance") {
    return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value.toFixed(0)}ms`;
  }
  return value.toFixed(0);
}

function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)} min`;
  }
  return `${seconds}s`;
}

// Loading skeleton
function DetailSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

// Section card component
function SectionCard({ title, icon: Icon, children }: { title: string; icon: typeof Settings; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/50">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="font-medium text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Info row component
function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-border/50 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default function AlertEventDetailContent() {
  const params = useParams<{ orgSlug: string; projectSlug: string; eventId: string }>();
  const { orgSlug, projectSlug, eventId } = params;
  const router = useRouter();

  // Fetch event details
  const { data: eventData, isLoading, error } = useQuery({
    queryKey: queryKeys.alertEvent(projectSlug, eventId),
    queryFn: async () => {
      const res = await apiFetch<DataEnvelope<AlertEvent>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/history/${eventId}`
      );
      return res.data;
    },
    retry: false,
  });

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !eventData) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load alert event. The event may not exist or you may not have access.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const event = eventData;
  const severity = CATEGORY_SEVERITY[event.rule_category];
  const SeverityIcon = severity.icon;

  // Calculate trace time range (5 min around trigger)
  const triggerTime = new Date(event.triggered_at);
  const startTime = new Date(triggerTime.getTime() - 5 * 60 * 1000);
  const endTime = event.resolved_at
    ? new Date(event.resolved_at)
    : new Date(triggerTime.getTime() + 5 * 60 * 1000);

  const tracesUrl = `/${orgSlug}/${projectSlug}/pulse?start=${startTime.toISOString()}&end=${endTime.toISOString()}`;

  return (
    <div className="p-4 space-y-6">
      {/* Back link */}
      <Link
        href={`/${orgSlug}/${projectSlug}/alerts/history`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Alert History
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <SeverityIcon className={`size-6 ${severity.colorClass}`} />
          <h1 className="text-xl font-semibold text-foreground">{event.rule_name}</h1>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_COLORS[event.status]}`}
          >
            {event.status === "active" && <Bell className="size-3" />}
            {event.status}
          </span>
        </div>
        <p className="text-sm text-muted-foreground capitalize">{event.rule_category} Alert</p>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Event Details */}
        <div className="space-y-6">
          {/* Timing */}
          <SectionCard title="Event Timeline" icon={Clock}>
            <InfoRow label="Triggered At" value={formatTimestamp(event.triggered_at)} />
            <InfoRow
              label="Resolved At"
              value={event.resolved_at ? formatTimestamp(event.resolved_at) : "Still active"}
            />
            {event.resolved_at && (
              <InfoRow
                label="Duration"
                value={formatDuration(
                  Math.round((new Date(event.resolved_at).getTime() - new Date(event.triggered_at).getTime()) / 1000)
                )}
              />
            )}
          </SectionCard>

          {/* Metric Values */}
          <SectionCard title="Metric Values" icon={Activity}>
            <InfoRow
              label="Value at Trigger"
              value={formatMetricValue(event.metric_value, event.rule_category)}
              mono
            />
            <InfoRow
              label="Threshold"
              value={formatMetricValue(event.threshold_value, event.rule_category)}
              mono
            />
            <InfoRow
              label="Breach"
              value={
                <span className="text-red-500">
                  {((event.metric_value / event.threshold_value - 1) * 100).toFixed(1)}% over threshold
                </span>
              }
            />
          </SectionCard>

          {/* Rule Configuration */}
          <SectionCard title="Rule Configuration" icon={Settings}>
            {event.rule_snapshot ? (
              <>
                <InfoRow label="Rule Name" value={event.rule_snapshot.name} />
                <InfoRow label="Category" value={event.rule_snapshot.category} />
                <InfoRow label="Threshold" value={event.rule_snapshot.threshold_value} mono />
                <InfoRow label="Duration Window" value={formatDuration(event.rule_snapshot.duration_seconds)} />
                <InfoRow label="Comparison" value={event.rule_snapshot.comparison_operator} mono />
              </>
            ) : (
              <>
                <InfoRow label="Rule Name" value={event.rule_name} />
                <InfoRow label="Category" value={event.rule_category} />
                <InfoRow label="Preset Key" value={event.rule_preset_key} mono />
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                  Rule snapshot not available. Showing current rule info.
                </p>
              </>
            )}
          </SectionCard>
        </div>

        {/* Right column - Chart and Actions */}
        <div className="space-y-6">
          {/* Metric Breach Chart */}
          <SectionCard title="Metric Trend" icon={Activity}>
            <MetricBreachChart
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              triggeredAt={event.triggered_at}
              resolvedAt={event.resolved_at}
              threshold={event.threshold_value}
              category={event.rule_category}
            />
          </SectionCard>

          {/* Notification Status */}
          <SectionCard title="Notification Status" icon={Bell}>
            <div className="space-y-3">
              {/* Email notification */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <Mail className="size-4 text-blue-500" />
                  </div>
                  <span className="text-sm text-foreground">Email</span>
                </div>
                <span className={`text-xs ${event.notification_sent ? "text-green-500" : "text-muted-foreground"}`}>
                  {event.notification_sent ? "Sent" : "Pending"}
                </span>
              </div>

              {/* Slack placeholder */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-500/10 p-2">
                    <MessageSquare className="size-4 text-purple-500" />
                  </div>
                  <span className="text-sm text-foreground">Slack</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {event.notification_sent ? "Sent" : "Not configured"}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Related Traces */}
          <SectionCard title="Related Traces" icon={ExternalLink}>
            <p className="text-sm text-muted-foreground mb-4">
              View traces from around the time this alert was triggered to investigate the root cause.
            </p>
            <Link
              href={tracesUrl}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="size-4" />
              View Related Traces
            </Link>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
