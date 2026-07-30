import type { NotificationDispatchPayload } from "../../modules/notifications/notification.types";
import { buildBullJobId } from "./bull-job-id";

export const NOTIFICATION_DISPATCH_JOB_NAME = "dispatch";
export const BROADCAST_AUTO_DISPATCH_JOB_NAME = "auto-dispatch";
export const DANGER_ZONE_TARGET_JOB_NAME = "danger-zone-target";

export function buildNotificationDispatchJobId(
  payload: Pick<
    NotificationDispatchPayload,
    "notificationId" | "channel" | "userId" | "adminUserId" | "phone" | "email"
  >,
): string {
  const recipient = payload.userId ?? payload.adminUserId ?? payload.phone ?? payload.email ?? "broadcast";
  const channel = payload.channel ?? "push";
  const notificationId = payload.notificationId ?? "unknown";
  return buildBullJobId("notify", notificationId, channel, recipient);
}

export function buildNotificationIdempotencyKey(
  payload: Pick<
    NotificationDispatchPayload,
    "notificationId" | "channel" | "userId" | "adminUserId" | "phone" | "email"
  >,
): string {
  return buildNotificationDispatchJobId(payload);
}

export function buildBroadcastAutoDispatchJobId(broadcastId: string): string {
  return buildBullJobId("broadcast", "auto-dispatch", broadcastId);
}

export function buildDangerZoneActivateJobId(dangerZoneId: string): string {
  return buildBullJobId("danger-zone-activate", dangerZoneId);
}

export const WATCH_DANGER_ALERT_JOB_NAME = "watch-danger-alert";

export function buildWatchDangerAlertJobId(alertId: string, userId: string): string {
  return buildBullJobId("watch-danger-alert", alertId, userId);
}

export const VOICE_TRANSCRIPTION_JOB_NAME = "transcribe";

export function buildVoiceTranscriptionJobId(attachmentId: string): string {
  return buildBullJobId("voice-transcription", attachmentId);
}

export type BroadcastAutoDispatchJobPayload = {
  broadcastId: string;
  idempotencyKey: string;
};
