import type { NotificationDispatchPayload } from "../../modules/notifications/notification.types";

export const NOTIFICATION_DISPATCH_JOB_NAME = "dispatch";

export function buildNotificationDispatchJobId(
  payload: Pick<NotificationDispatchPayload, "notificationId" | "channel" | "userId" | "adminUserId">,
): string {
  const recipient = payload.userId ?? payload.adminUserId ?? "broadcast";
  const channel = payload.channel ?? "push";
  const notificationId = payload.notificationId ?? "unknown";
  return `notify:${notificationId}:${channel}:${recipient}`;
}

export function buildNotificationIdempotencyKey(
  payload: Pick<NotificationDispatchPayload, "notificationId" | "channel" | "userId" | "adminUserId">,
): string {
  return buildNotificationDispatchJobId(payload);
}
