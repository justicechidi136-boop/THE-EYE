import type { NotificationPriority, NotificationType } from "./dto/notification.dto";

export type CanonicalDeliveryStatus =
  | "Created"
  | "Queued"
  | "Processing"
  | "ProviderAccepted"
  | "Delivered"
  | "DeviceReceived"
  | "Read"
  | "Failed"
  | "RetryScheduled"
  | "InvalidToken"
  | "Cancelled"
  | "Expired";

type DeliveryLogLike = {
  status?: string | null;
  error?: string | null;
};

type NotificationLike = {
  id: string;
  userId?: string | null;
  adminUserId?: string | null;
  incidentId?: string | null;
  broadcastId?: string | null;
  type: string;
  priority: string;
  channel: string;
  title: string;
  body: string;
  status: string;
  error?: string | null;
  readAt?: Date | null;
  createdAt: Date;
  sentAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  broadcast?: { expiresAt?: Date | null; status?: string | null } | null;
  deliveryLogs?: DeliveryLogLike[];
};

const ALLOWED_DEEP_LINKS = new Set([
  "/home",
  "/notifications",
  "/broadcasts",
  "/tracking",
  "/missing-person",
  "/stolen-vehicle",
  "/neighborhood-watch",
  "/neighborhood-watch/alerts",
  "/live-video",
  "/report/emergency",
  "/active-emergency",
]);

export function mapCanonicalDeliveryStatus(notification: NotificationLike): CanonicalDeliveryStatus {
  if (notification.readAt) return "Read";
  if (isExpiredNotification(notification)) return "Expired";

  const latestLog = notification.deliveryLogs?.[0];
  if (latestLog?.status === "Retrying") return "RetryScheduled";
  if (latestLog?.status === "Queued") return "Queued";
  if (latestLog?.status === "Processing") return "Processing";

  if (notification.status === "Pending") {
    return latestLog?.status === "Queued" ? "Queued" : "Created";
  }
  if (notification.status === "Sent") return "ProviderAccepted";
  if (notification.status === "Delivered") return "Delivered";
  if (notification.status === "Read") return "Read";
  if (notification.status === "Failed") {
    const errorText = `${notification.error ?? ""} ${latestLog?.error ?? ""}`.toLowerCase();
    if (errorText.includes("invalid token") || errorText.includes("unregistered") || errorText.includes("not_found")) {
      return "InvalidToken";
    }
    return "Failed";
  }
  return "Created";
}

export function isExpiredNotification(notification: NotificationLike): boolean {
  const expiresAt = notification.broadcast?.expiresAt;
  if (expiresAt && expiresAt.getTime() <= Date.now()) return true;
  if (notification.broadcast?.status === "Expired") return true;
  return false;
}

export function buildNotificationDeepLink(notification: NotificationLike): string {
  const metadataRoute = sanitizeDeepLink(
    typeof notification.metadata?.route === "string"
      ? notification.metadata.route
      : typeof notification.metadata?.deepLink === "string"
        ? notification.metadata.deepLink
        : undefined,
  );
  if (metadataRoute) return metadataRoute;

  const type = notification.type.toLowerCase();
  if (type.includes("emergency") || type.includes("sos")) return "/report/emergency";
  if (type.includes("missingperson")) return "/missing-person";
  if (type.includes("stolenvehicle")) return "/stolen-vehicle";
  if (type.includes("broadcast")) return "/broadcasts";
  if (type.includes("neighborhood") || notification.metadata?.communityId) return "/neighborhood-watch";
  if (notification.incidentId && type.includes("incidentstatus")) return "/active-emergency";
  if (notification.incidentId) return "/tracking";
  return "/notifications";
}

export function sanitizeDeepLink(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.includes("..") || trimmed.includes("://")) return null;
  const route = trimmed.split("?")[0];
  return ALLOWED_DEEP_LINKS.has(route) ? route : null;
}

export function mapNotificationInboxItem(notification: NotificationLike) {
  const expired = isExpiredNotification(notification);
  return {
    id: notification.id,
    type: notification.type as NotificationType,
    priority: notification.priority as NotificationPriority,
    channel: notification.channel,
    title: notification.title,
    body: notification.body,
    deliveryStatus: mapCanonicalDeliveryStatus(notification),
    read: Boolean(notification.readAt),
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    sentAt: notification.sentAt,
    incidentId: notification.incidentId,
    broadcastId: notification.broadcastId,
    deepLink: buildNotificationDeepLink(notification),
    expired,
    metadata: sanitizeInboxMetadata(notification.metadata ?? {}),
  };
}

function sanitizeInboxMetadata(metadata: Record<string, unknown>) {
  const safe = { ...metadata };
  delete safe.route;
  delete safe.deepLink;
  delete safe.token;
  delete safe.phone;
  delete safe.email;
  return safe;
}
