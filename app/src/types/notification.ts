export type ChannelType = "email" | "slack" | "discord";

export interface NotificationChannel {
  id: string;
  org_id: string;
  project_id: string;
  channel_type: ChannelType;
  config: Record<string, unknown>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationChannelCreate {
  channel_type: ChannelType;
  config: Record<string, unknown>;
  is_enabled?: boolean;
}

export interface NotificationChannelUpdate {
  config?: Record<string, unknown>;
  is_enabled?: boolean;
}

export interface NotificationTestResponse {
  success: boolean;
  error?: string | null;
}

export const CHANNEL_CONFIG: Record<
  ChannelType,
  { label: string; description: string; icon: string; tierRequired?: string }
> = {
  email: {
    label: "Email",
    description: "Send notifications to org admins via email",
    icon: "Mail",
  },
  slack: {
    label: "Slack",
    description: "Post alerts to a Slack channel via webhook",
    icon: "MessageSquare",
    tierRequired: "Pro",
  },
  discord: {
    label: "Discord",
    description: "Post alerts to a Discord channel via webhook",
    icon: "MessagesSquare",
    tierRequired: "Pro",
  },
};
