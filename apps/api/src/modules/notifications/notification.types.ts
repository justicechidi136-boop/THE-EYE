import type { NotificationChannel } from "./dto/notification.dto";

export type NotificationDispatchPayload = {
  notificationId?: string;
  userId?: string;
  adminUserId?: string;
  recipientUserId?: string;
  pushTokenId?: string;
  channel?: NotificationChannel | string;
  title: string;
  body: string;
  type?: string;
  priority?: string;
  phone?: string;
  email?: string;
  broadcastId?: string;
  incidentId?: string;
  communityId?: string;
  postId?: string;
  deviceId?: string;
  targetToken?: string;
  sosEventId?: string;
  provider?: string;
  idempotencyKey?: string;
  createdAt?: string;
  enqueuedAt?: string;
  attempt?: number;
  maxAttempts?: number;
};

export type NotificationDispatchJobPayload = NotificationDispatchPayload & {
  idempotencyKey: string;
  createdAt: string;
};

export type NotificationDispatchResult = {
  status: "Sent" | "Delivered";
  provider: string;
  providerMessageId?: string;
  responsePayload?: Record<string, unknown>;
  recipientCount?: number;
};

export function isEmergencyPriority(priority?: string) {
  return priority === "Critical" || priority === "P1LifeThreatening";
}

export function bullJobPriority(priority?: string) {
  if (isEmergencyPriority(priority)) return 1;
  if (priority === "High" || priority === "P2ActiveCrimeAccident") return 2;
  if (priority === "Normal") return 5;
  return 10;
}

export function bullJobAttempts(priority?: string) {
  return isEmergencyPriority(priority) ? 8 : 5;
}
