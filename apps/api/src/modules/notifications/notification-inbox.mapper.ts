import type { NotificationPriority, NotificationType } from "./dto/notification.dto";
import {
  NOTIFICATION_SCHEMA_VERSION,
  resolveNotificationRoutingFromMetadata,
  type NotificationRoutingV1,
} from "./notification-routing.schema";

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
  "/active-emergencies",
  "/incident-detail",
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
  const routing = resolveNotificationRouting(notification);
  return routing.destination;
}

export function resolveNotificationRouting(notification: NotificationLike): NotificationRoutingV1 {
  const metadata = notification.metadata ?? {};
  const destination = sanitizeDeepLink(
    typeof metadata.destination === "string"
      ? metadata.destination
      : typeof metadata.route === "string"
        ? metadata.route
        : typeof metadata.deepLink === "string"
          ? metadata.deepLink
          : undefined,
  );
  if (destination) {
    return {
      schemaVersion: NOTIFICATION_SCHEMA_VERSION,
      routeType:
        (metadata.routeType as NotificationRoutingV1["routeType"]) ??
        (destination === "/active-emergency"
          ? "OWN_ACTIVE_INCIDENT"
          : destination === "/incident-detail"
            ? "OWN_INCIDENT_DETAILS"
            : "SYSTEM"),
      incidentId: notification.incidentId ?? undefined,
      status: typeof metadata.status === "string" ? metadata.status : undefined,
      notificationType: notification.type,
      destination,
    };
  }

  const type = notification.type.toLowerCase();
  if (type.includes("emergency") || type.includes("sos")) {
    return {
      schemaVersion: NOTIFICATION_SCHEMA_VERSION,
      routeType: "SYSTEM",
      notificationType: notification.type,
      destination: "/report/emergency",
    };
  }
  if (type.includes("missingperson")) {
    return {
      schemaVersion: NOTIFICATION_SCHEMA_VERSION,
      routeType: "SYSTEM",
      notificationType: notification.type,
      destination: "/missing-person",
    };
  }
  if (type.includes("stolenvehicle")) {
    return {
      schemaVersion: NOTIFICATION_SCHEMA_VERSION,
      routeType: "SYSTEM",
      notificationType: notification.type,
      destination: "/stolen-vehicle",
    };
  }
  if (type.includes("broadcast")) {
    return {
      schemaVersion: NOTIFICATION_SCHEMA_VERSION,
      routeType: "SYSTEM",
      notificationType: notification.type,
      destination: "/broadcasts",
    };
  }
  if (type.includes("neighborhood") || notification.metadata?.communityId) {
    return {
      schemaVersion: NOTIFICATION_SCHEMA_VERSION,
      routeType: "COMMUNITY_VERIFICATION",
      notificationType: notification.type,
      destination: "/neighborhood-watch",
    };
  }
  if (notification.incidentId) {
    return resolveNotificationRoutingFromMetadata(metadata, {
      incidentId: notification.incidentId,
      status: typeof metadata.status === "string" ? metadata.status : undefined,
      notificationType: notification.type,
    });
  }
  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    routeType: "SYSTEM",
    notificationType: notification.type,
    destination: "/notifications",
  };
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
  const routing = resolveNotificationRouting(notification);
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
    deepLink: routing.destination,
    routing,
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
